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

interface SuggestedChange {
  changeType: string;
  existingRuleId: string | null;
  suggestedName: string;
  suggestedDescription: string;
  suggestedCategory: string;
  suggestedCitation: string;
  suggestedSourceUrl: string | null;
  suggestedSeverity: string;
  suggestedValidationPrompt: string;
  reasoning: string;
  sourceExcerpt: string;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// Known valid regulatory URLs by state
const STATE_REGULATORY_URLS: Record<string, { base: string; name: string }> = {
  MT: { base: 'https://rules.mt.gov/', name: 'Montana Administrative Rules' },
  CO: { base: 'https://med.colorado.gov/rules', name: 'Colorado MED Rules' },
  CA: { base: 'https://cannabis.ca.gov/cannabis-laws/dcc-regulations/', name: 'California DCC Regulations' },
};

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

// Validate and filter suggestions - only keep those with valid URLs
function validateSuggestions(
  suggestions: SuggestedChange[], 
  stateAbbrev: string,
  fallbackSources: string[]
): { valid: SuggestedChange[]; rejected: number; reasons: string[] } {
  const valid: SuggestedChange[] = [];
  const reasons: string[] = [];
  let rejected = 0;

  const stateBaseUrl = STATE_REGULATORY_URLS[stateAbbrev]?.base;

  for (const suggestion of suggestions) {
    let sourceUrl = suggestion.suggestedSourceUrl;

    // Check if URL is valid
    if (!sourceUrl || sourceUrl.trim() === '' || sourceUrl === 'null') {
      // Try to find a fallback from sources
      if (fallbackSources.length > 0) {
        // Use first .gov source if available
        const govSource = fallbackSources.find(s => s.includes('.gov'));
        sourceUrl = govSource || fallbackSources[0];
        console.log(`Using fallback URL for "${suggestion.suggestedName}": ${sourceUrl}`);
      } else if (stateBaseUrl) {
        sourceUrl = stateBaseUrl;
        console.log(`Using state base URL for "${suggestion.suggestedName}": ${sourceUrl}`);
      } else {
        rejected++;
        reasons.push(`Rejected "${suggestion.suggestedName}": No valid source URL`);
        continue;
      }
    }

    // Basic URL validation
    try {
      new URL(sourceUrl);
    } catch {
      // URL is invalid, try to use fallback
      if (stateBaseUrl) {
        sourceUrl = stateBaseUrl;
      } else {
        rejected++;
        reasons.push(`Rejected "${suggestion.suggestedName}": Invalid URL format`);
        continue;
      }
    }

    valid.push({
      ...suggestion,
      suggestedSourceUrl: sourceUrl
    });
  }

  return { valid, rejected, reasons };
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

    // Determine state abbreviation from stateName
    const stateAbbrevMap: Record<string, string> = {
      'Montana': 'MT',
      'Colorado': 'CO', 
      'California': 'CA'
    };
    const stateAbbrev = stateAbbrevMap[stateName] || '';
    const stateRegInfo = STATE_REGULATORY_URLS[stateAbbrev];

    console.log(`Running Groq regulatory check for ${stateName} (${stateAbbrev}) with ${existingRules.length} existing rules`);

    const systemPrompt = `You are an expert cannabis regulatory analyst. Your job is to search for the LATEST cannabis labeling and packaging requirements for the specified state and compare them against existing compliance rules.

CRITICAL REQUIREMENTS:
1. You MUST search for official state government sources (.gov websites)
2. You MUST provide a VALID, WORKING URL for EVERY citation
3. DO NOT suggest any rule change without a verifiable source URL
4. Prefer official regulatory websites over third-party sources

${stateRegInfo ? `PRIMARY SOURCE FOR ${stateName.toUpperCase()}:
- ${stateRegInfo.name}: ${stateRegInfo.base}
You SHOULD visit this URL and extract regulations from it.` : ''}

VALID URL EXAMPLES:
- Montana: https://rules.mt.gov/gateway/RuleNo.asp?RN=37.107.402
- Colorado: https://med.colorado.gov/rules
- California: https://cannabis.ca.gov/cannabis-laws/dcc-regulations/

DO NOT use URLs like:
- Generic search pages without specific results
- Broken or hypothetical URLs
- Third-party legal databases (westlaw, lexis) unless absolutely necessary

Return your findings as a JSON object with this structure:
{
  "searchSummary": "Brief summary of what was found",
  "sourcesUsed": ["array of actual URLs that were searched and returned results"],
  "currentRequirements": [
    {
      "requirement": "Description of the requirement",
      "citation": "Specific regulatory citation (e.g., ARM 37.107.402)",
      "sourceUrl": "REQUIRED: Direct URL to the .gov page where this was found",
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
      "suggestedCitation": "Specific citation (e.g., 'ARM 37.107.402')",
      "suggestedSourceUrl": "REQUIRED: Direct .gov URL where this regulation can be verified. Must be a real, working URL you actually visited.",
      "suggestedSeverity": "error" | "warning" | "info",
      "suggestedValidationPrompt": "Prompt for AI validation",
      "reasoning": "Why this change is suggested with reference to the source",
      "sourceExcerpt": "Exact text quoted from the source document"
    }
  ],
  "confidence": {
    "overall": 0.0-1.0,
    "dataFreshness": "Recent/Moderate/Outdated/Unknown",
    "sourceReliability": "Official/Semi-official/Third-party"
  }
}

IMPORTANT: If you cannot find a valid source URL for a potential rule change, DO NOT include it in suggestedChanges. Only suggest changes you can verify with a real URL.`;

    const searchQuery = sourceUrl 
      ? `Search for the latest cannabis labeling and packaging requirements for ${stateName}. 

IMPORTANT: Visit and analyze this specific regulatory source: ${sourceUrl}

Also search for other official ${stateName} government sources about cannabis labeling requirements.

Current existing rules to compare against:
${existingRules.map(r => `- ${r.name}: ${r.description} (Citation: ${r.citation || 'N/A'})`).join('\n')}

Identify any new requirements, changes to existing requirements, or outdated rules. Remember: ONLY suggest changes if you have a valid source URL.`
      : `Search for the latest cannabis labeling and packaging requirements for ${stateName}.

${stateRegInfo ? `Start by visiting: ${stateRegInfo.base}` : ''}

Look for official ${stateName} government regulations about cannabis/marijuana labeling, packaging, and compliance requirements.

Current existing rules to compare against:
${existingRules.map(r => `- ${r.name}: ${r.description} (Citation: ${r.citation || 'N/A'})`).join('\n')}

Identify any new requirements, changes to existing requirements, or outdated rules. Remember: ONLY suggest changes if you have a valid source URL.`;

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
    console.log('Sources found:', sources);

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
    if (sources.length > 0) {
      if (!parsedResult.sourcesUsed || parsedResult.sourcesUsed.length === 0) {
        parsedResult.sourcesUsed = sources;
      } else {
        // Merge sources
        parsedResult.sourcesUsed = [...new Set([...parsedResult.sourcesUsed, ...sources])];
      }
    }

    // Validate and filter suggestions
    if (parsedResult.suggestedChanges && parsedResult.suggestedChanges.length > 0) {
      const allSources = parsedResult.sourcesUsed || sources;
      const { valid, rejected, reasons } = validateSuggestions(
        parsedResult.suggestedChanges,
        stateAbbrev,
        allSources
      );
      
      console.log(`Validated suggestions: ${valid.length} valid, ${rejected} rejected`);
      if (reasons.length > 0) {
        console.log('Rejection reasons:', reasons);
      }

      parsedResult.suggestedChanges = valid;
      parsedResult.validationInfo = {
        originalCount: valid.length + rejected,
        validCount: valid.length,
        rejectedCount: rejected,
        rejectionReasons: reasons
      };
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
