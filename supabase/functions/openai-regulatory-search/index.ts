import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RuleSuggestion {
  change_type: 'new' | 'update' | 'deprecate';
  suggested_name: string;
  suggested_description: string;
  suggested_category: string;
  suggested_severity: string;
  suggested_citation: string;
  suggested_source_url: string;
  suggested_validation_prompt: string;
  ai_reasoning: string;
  source_excerpt: string;
  existing_rule_id?: string;
}

interface Citation {
  url: string;
  title: string;
  text: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { stateId, stateName, stateAbbreviation, existingRules, regulatorySources } = await req.json();

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    console.log(`Starting OpenAI deep search for ${stateName} (${stateAbbreviation})`);

    // Build domain filter from regulatory sources
    const allowedDomains = regulatorySources
      ?.filter((s: any) => s.source_url)
      .map((s: any) => {
        try {
          const url = new URL(s.source_url);
          return url.hostname;
        } catch {
          return null;
        }
      })
      .filter(Boolean) || [];

    // Add common government domains for the state
    const stateGovDomains = [
      `${stateAbbreviation.toLowerCase()}.gov`,
      `state.${stateAbbreviation.toLowerCase()}.us`,
    ];
    
    // State-specific regulatory domains
    const stateSpecificDomains: Record<string, string[]> = {
      'MT': ['rules.mt.gov', 'revenue.mt.gov', 'dphhs.mt.gov', 'mtrules.org'],
      'CO': ['med.colorado.gov', 'colorado.gov', 'sos.state.co.us'],
      'CA': ['cannabis.ca.gov', 'cdph.ca.gov', 'bcc.ca.gov'],
    };

    const finalDomains = [
      ...new Set([
        ...allowedDomains,
        ...stateGovDomains,
        ...(stateSpecificDomains[stateAbbreviation] || [])
      ])
    ];

    console.log(`Domain filter: ${finalDomains.join(', ')}`);

    // Build the search query
    const existingRulesSummary = existingRules
      ?.slice(0, 10)
      .map((r: any) => `- ${r.name}: ${r.description}`)
      .join('\n') || 'No existing rules';

    const searchPrompt = `Search for the latest ${stateName} cannabis labeling and packaging regulations.

Focus on finding:
1. Required warning statements and their exact wording
2. THC/CBD content labeling requirements
3. Required symbols or icons (universal symbol, etc.)
4. Font size and placement requirements
5. Ingredient and allergen disclosure rules
6. Net weight and serving size requirements
7. Child-resistant packaging requirements
8. Any recent regulatory updates or proposed changes

Current rules we have on file:
${existingRulesSummary}

Compare what you find online against these existing rules and identify:
- NEW rules we don't have
- CHANGES to existing rules (updated requirements)
- Rules that may be DEPRECATED or no longer apply

For each finding, provide the exact regulatory citation (e.g., "ARM 37.107.406") and the source URL where you found it.`;

    console.log('Calling OpenAI Responses API with web search...');

    // Use the Responses API with web_search tool
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        tools: [{
          type: 'web_search',
          search_context_size: 'high',
          user_location: {
            type: 'approximate',
            country: 'US',
            region: stateAbbreviation,
          }
        }],
        input: searchPrompt,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          error: 'Rate limit exceeded. Please try again in a few minutes.' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('OpenAI response received, processing...');

    // Extract the response content and citations
    let responseText = '';
    const citations: Citation[] = [];

    // Process the output array
    for (const item of data.output || []) {
      if (item.type === 'message') {
        for (const content of item.content || []) {
          if (content.type === 'output_text') {
            responseText = content.text;
            
            // Extract citations from annotations
            for (const annotation of content.annotations || []) {
              if (annotation.type === 'url_citation') {
                citations.push({
                  url: annotation.url,
                  title: annotation.title || '',
                  text: responseText.substring(annotation.start_index, annotation.end_index),
                });
              }
            }
          }
        }
      }
    }

    console.log(`Found ${citations.length} verified citations`);

    // Now parse the response to extract rule suggestions
    const parsePrompt = `Based on this regulatory research about ${stateName} cannabis labeling requirements, extract structured rule suggestions.

Research findings:
${responseText}

Verified source URLs found:
${citations.map(c => `- ${c.url} (${c.title})`).join('\n')}

Existing rules for comparison:
${existingRulesSummary}

Return a JSON array of rule suggestions. Each suggestion should have:
- change_type: "new" | "update" | "deprecate"
- suggested_name: short descriptive name
- suggested_description: full requirement description
- suggested_category: one of "Warnings", "Content Labeling", "Symbols/Icons", "Format/Placement", "Ingredients", "Net Weight", "Packaging", "Other"
- suggested_severity: "error" | "warning" | "info"
- suggested_citation: the regulatory citation (e.g., "ARM 37.107.406")
- suggested_source_url: the verified URL from the citations above (MUST be from the verified URLs list)
- suggested_validation_prompt: a prompt to validate compliance with this rule
- ai_reasoning: why this rule should be added/updated/deprecated
- source_excerpt: relevant text from the source
- existing_rule_id: if this updates an existing rule, include the rule name to match

Only include suggestions where you have a verified source URL. Do not make up URLs.
Return ONLY the JSON array, no other text.`;

    // Use standard chat completion to parse the results
    const parseResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a regulatory compliance expert. Extract structured data from research findings. Return only valid JSON.' },
          { role: 'user', content: parsePrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    });

    if (!parseResponse.ok) {
      const errorText = await parseResponse.text();
      console.error('Parse API error:', parseResponse.status, errorText);
      throw new Error(`Failed to parse results: ${errorText}`);
    }

    const parseData = await parseResponse.json();
    const parseContent = parseData.choices?.[0]?.message?.content || '{"suggestions":[]}';
    
    let suggestions: RuleSuggestion[] = [];
    try {
      const parsed = JSON.parse(parseContent);
      suggestions = Array.isArray(parsed) ? parsed : (parsed.suggestions || []);
    } catch (e) {
      console.error('Failed to parse suggestions JSON:', e);
      suggestions = [];
    }

    // Validate that source URLs are from our verified citations
    const verifiedUrls = new Set(citations.map(c => c.url));
    suggestions = suggestions.filter(s => {
      if (!s.suggested_source_url) return false;
      // Check if URL matches any verified citation
      return verifiedUrls.has(s.suggested_source_url) || 
             citations.some(c => s.suggested_source_url.includes(new URL(c.url).hostname));
    });

    console.log(`Returning ${suggestions.length} verified suggestions`);

    // Store suggestions in database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let storedCount = 0;
    for (const suggestion of suggestions) {
      const { error } = await supabase
        .from('rule_change_suggestions')
        .insert({
          state_id: stateId,
          change_type: suggestion.change_type,
          suggested_name: suggestion.suggested_name,
          suggested_description: suggestion.suggested_description,
          suggested_category: suggestion.suggested_category || 'Other',
          suggested_severity: suggestion.suggested_severity || 'error',
          suggested_citation: suggestion.suggested_citation,
          suggested_source_url: suggestion.suggested_source_url,
          suggested_validation_prompt: suggestion.suggested_validation_prompt,
          ai_reasoning: suggestion.ai_reasoning,
          source_excerpt: suggestion.source_excerpt,
          status: 'pending',
        });

      if (error) {
        console.error('Failed to store suggestion:', error);
      } else {
        storedCount++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      suggestionsCount: storedCount,
      citationsCount: citations.length,
      citations: citations.slice(0, 10), // Return top 10 citations for reference
      rawResponse: responseText.substring(0, 500) + '...',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in openai-regulatory-search:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
