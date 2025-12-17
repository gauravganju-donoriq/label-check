import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RegulatoryCheckRequest {
  stateId: string;
  stateName: string;
  sourceUrl?: string;
  existingRules: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    citation: string | null;
  }>;
}

interface GroqCompoundResponse {
  id: string;
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  tool_results?: Array<{
    name: string;
    result: unknown;
  }>;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callGroqCompound(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  retryCount = 0
): Promise<{ content: string; sources: string[]; error?: string }> {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'compound-beta',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ]
        // compound-beta has built-in web search - no need to specify tools
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Groq API error: ${response.status}`, errorText);

      if (response.status === 429 && retryCount < MAX_RETRIES) {
        console.log(`Rate limited, retrying in ${RETRY_DELAY_MS * (retryCount + 1)}ms...`);
        await sleep(RETRY_DELAY_MS * (retryCount + 1));
        return callGroqCompound(apiKey, systemPrompt, userMessage, retryCount + 1);
      }

      return {
        content: '',
        sources: [],
        error: `Groq API error: ${response.status} - ${errorText}`
      };
    }

    const data: GroqCompoundResponse = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Extract sources from tool results if available
    const sources: string[] = [];
    if (data.tool_results) {
      for (const result of data.tool_results) {
        if (result.name === 'web_search' && Array.isArray(result.result)) {
          for (const item of result.result as Array<{ url?: string }>) {
            if (item.url) sources.push(item.url);
          }
        }
      }
    }

    return { content, sources };
  } catch (error) {
    console.error('Error calling Groq Compound:', error);
    
    if (retryCount < MAX_RETRIES) {
      console.log(`Request failed, retrying in ${RETRY_DELAY_MS * (retryCount + 1)}ms...`);
      await sleep(RETRY_DELAY_MS * (retryCount + 1));
      return callGroqCompound(apiKey, systemPrompt, userMessage, retryCount + 1);
    }

    return {
      content: '',
      sources: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { stateId, stateName, sourceUrl, existingRules }: RegulatoryCheckRequest = await req.json();

    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
    if (!GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not configured');
    }

    console.log(`Running Groq regulatory check for ${stateName} with ${existingRules.length} existing rules`);

    const systemPrompt = `You are an expert cannabis regulatory analyst. Your job is to search for the LATEST cannabis labeling and packaging requirements for the specified state and compare them against existing compliance rules.

IMPORTANT: 
- Search for official state regulatory sources (government .gov sites preferred)
- Focus on cannabis/marijuana labeling, packaging, and compliance requirements
- Look for recent changes, updates, or new requirements
- Be thorough but accurate - cite specific regulatory sections when possible

Return your findings as a JSON object with this structure:
{
  "searchSummary": "Brief summary of what was found",
  "sourcesUsed": ["array of URLs that were searched"],
  "currentRequirements": [
    {
      "requirement": "Description of the requirement",
      "citation": "Regulatory citation if available",
      "category": "Category (e.g., 'Required Warnings', 'THC Content', etc.)",
      "effectiveDate": "Date if known, otherwise null"
    }
  ],
  "suggestedChanges": [
    {
      "changeType": "new" | "update" | "removal",
      "existingRuleId": "ID of existing rule to update/remove, or null for new",
      "suggestedName": "Rule name",
      "suggestedDescription": "Detailed description",
      "suggestedCategory": "Category",
      "suggestedCitation": "Citation",
      "suggestedSeverity": "error" | "warning" | "info",
      "suggestedValidationPrompt": "Prompt for AI validation",
      "reasoning": "Why this change is suggested",
      "sourceExcerpt": "Relevant excerpt from source"
    }
  ],
  "confidence": {
    "overall": 0.0-1.0,
    "dataFreshness": "Recent/Moderate/Outdated/Unknown",
    "sourceReliability": "Official/Semi-official/Third-party"
  }
}`;

    const searchQuery = sourceUrl 
      ? `Search for the latest cannabis labeling and packaging requirements for ${stateName}. Also visit and analyze this specific regulatory source: ${sourceUrl}

Current existing rules to compare against:
${existingRules.map(r => `- ${r.name}: ${r.description} (Citation: ${r.citation || 'N/A'})`).join('\n')}

Identify any new requirements, changes to existing requirements, or outdated rules.`
      : `Search for the latest cannabis labeling and packaging requirements for ${stateName}.

Current existing rules to compare against:
${existingRules.map(r => `- ${r.name}: ${r.description} (Citation: ${r.citation || 'N/A'})`).join('\n')}

Identify any new requirements, changes to existing requirements, or outdated rules.`;

    const { content, sources, error: groqError } = await callGroqCompound(
      GROQ_API_KEY,
      systemPrompt,
      searchQuery
    );

    if (groqError) {
      console.error('Groq Compound error:', groqError);
      return new Response(JSON.stringify({
        success: false,
        error: groqError,
        fallbackRecommended: true
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Groq Compound response received, parsing...');

    // Parse the JSON response
    let parsedResult;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
      } else {
        parsedResult = {
          searchSummary: content,
          sourcesUsed: sources,
          currentRequirements: [],
          suggestedChanges: [],
          confidence: { overall: 0.5, dataFreshness: 'Unknown', sourceReliability: 'Unknown' },
          parseError: true,
          rawResponse: content
        };
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      parsedResult = {
        searchSummary: 'Failed to parse structured response',
        sourcesUsed: sources,
        currentRequirements: [],
        suggestedChanges: [],
        confidence: { overall: 0.3, dataFreshness: 'Unknown', sourceReliability: 'Unknown' },
        parseError: true,
        rawResponse: content
      };
    }

    // Add the sources from tool results if not already included
    if (sources.length > 0 && (!parsedResult.sourcesUsed || parsedResult.sourcesUsed.length === 0)) {
      parsedResult.sourcesUsed = sources;
    }

    return new Response(JSON.stringify({
      success: true,
      stateId,
      stateName,
      timestamp: new Date().toISOString(),
      ...parsedResult
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in groq-regulatory-check function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
