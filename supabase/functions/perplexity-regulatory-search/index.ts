import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExistingRule {
  id: string;
  name: string;
  description: string;
  category: string;
  citation?: string;
}

interface RegulatorySource {
  id: string;
  source_name: string;
  source_url: string;
  is_active: boolean;
}

interface SearchResult {
  title: string;
  url: string;
  snippet?: string;
}

interface RuleSuggestion {
  changeType: 'add' | 'update' | 'remove';
  existingRuleId?: string | null;
  suggestedName: string;
  suggestedDescription: string;
  suggestedCategory?: string;
  suggestedCitation?: string;
  suggestedSourceUrl?: string;
  suggestedSeverity?: string;
  suggestedValidationPrompt?: string;
  reasoning?: string;
  sourceExcerpt?: string;
}

// State-specific .gov domains for filtering
const STATE_DOMAINS: Record<string, string[]> = {
  'MT': ['rules.mt.gov', 'revenue.mt.gov', 'dphhs.mt.gov', 'leg.mt.gov'],
  'CO': ['med.colorado.gov', 'colorado.gov', 'sos.state.co.us'],
  'CA': ['cannabis.ca.gov', 'cdph.ca.gov', 'bcc.ca.gov', 'ca.gov'],
  // Default domains for other states
  'DEFAULT': ['.gov']
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    if (!PERPLEXITY_API_KEY) {
      throw new Error('PERPLEXITY_API_KEY is not configured');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const { stateId, stateName, stateAbbreviation, existingRules, regulatorySources } = await req.json() as {
      stateId: string;
      stateName: string;
      stateAbbreviation: string;
      existingRules: ExistingRule[];
      regulatorySources: RegulatorySource[];
    };

    console.log(`Starting Perplexity regulatory search for ${stateName} (${stateAbbreviation})`);

    // Get state-specific domains or use defaults
    const stateDomains = STATE_DOMAINS[stateAbbreviation] || STATE_DOMAINS['DEFAULT'];
    console.log(`Using domain filters: ${stateDomains.join(', ')}`);

    // Build the search prompt for Perplexity
    const searchPrompt = `Research the current cannabis product labeling requirements for ${stateName} (${stateAbbreviation}).

Focus on finding:
1. Required warning statements and their exact wording
2. THC/CBD content display requirements (format, font size, placement)
3. Required symbols or icons (universal symbol, etc.)
4. Net weight and serving size requirements
5. Ingredient listing requirements
6. Manufacturer/producer information requirements
7. Child-resistant packaging requirements
8. Any recent regulatory changes or updates (within last 6 months)

For each requirement found, provide:
- The specific requirement text
- The regulatory citation (e.g., ARM 37.107.XXX for Montana)
- The source URL where this was found

Be thorough and cite your sources with specific URLs.`;

    console.log('Calling Perplexity API with sonar-pro model...');

    // Phase 1: Perplexity search with domain filtering
    const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: `You are a regulatory compliance expert specializing in cannabis labeling requirements. Always cite specific regulations with their official citation format and provide verified source URLs. Focus on official .gov sources.`
          },
          {
            role: 'user',
            content: searchPrompt
          }
        ],
        search_domain_filter: stateDomains,
        search_recency_filter: 'month',
        temperature: 0.1,
        return_citations: true,
        return_related_questions: false
      }),
    });

    if (!perplexityResponse.ok) {
      const errorText = await perplexityResponse.text();
      console.error('Perplexity API error:', perplexityResponse.status, errorText);
      throw new Error(`Perplexity API error: ${perplexityResponse.status} - ${errorText}`);
    }

    const perplexityData = await perplexityResponse.json();
    console.log('Perplexity response received');

    const searchContent = perplexityData.choices?.[0]?.message?.content || '';
    const searchResults: SearchResult[] = perplexityData.citations || [];
    
    console.log(`Found ${searchResults.length} citations from Perplexity`);
    console.log('Citations:', JSON.stringify(searchResults, null, 2));

    if (!searchContent) {
      throw new Error('No content returned from Perplexity');
    }

    // Phase 2: Use Lovable AI (Gemini) to structure the findings
    console.log('Structuring findings with Lovable AI...');

    const existingRulesJson = JSON.stringify(existingRules.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      category: r.category,
      citation: r.citation
    })), null, 2);

    const verifiedUrls = searchResults.map(r => typeof r === 'string' ? r : r.url).filter(Boolean);

    const structuringPrompt = `Analyze this regulatory research about ${stateName} cannabis labeling requirements and compare it against existing compliance rules.

## Research Findings from Perplexity (with verified citations):
${searchContent}

## Verified Source URLs (use ONLY these URLs for citations):
${verifiedUrls.join('\n')}

## Existing Rules in Database:
${existingRulesJson}

## Task:
Compare the research findings against existing rules and identify:
1. NEW rules that should be added (requirements found in research but not in existing rules)
2. UPDATES to existing rules (if the requirement wording or citation has changed)
3. Rules that may need REMOVAL (if a requirement has been repealed)

## Output Format:
Return a JSON array of suggestions. Each suggestion must have:
- changeType: "add", "update", or "remove"
- existingRuleId: (only for update/remove, the ID from existing rules)
- suggestedName: Brief rule name
- suggestedDescription: Full requirement description
- suggestedCategory: One of "warnings", "content_labeling", "symbols", "packaging", "ingredients", "manufacturer", "other"
- suggestedCitation: Regulatory citation (e.g., "ARM 37.107.402")
- suggestedSourceUrl: URL from the verified sources list ONLY
- suggestedSeverity: "error", "warning", or "info"
- suggestedValidationPrompt: How to check if a label complies
- reasoning: Why this change is suggested
- sourceExcerpt: Relevant text from the research

IMPORTANT: 
- Only include suggestions where you have HIGH confidence the requirement is accurate
- Only use URLs from the verified sources list
- Do not make up citations - use exact citations from the research
- Return ONLY the JSON array, no other text`;

    const geminiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a regulatory compliance analyst. Output only valid JSON arrays, no markdown or explanation.'
          },
          {
            role: 'user',
            content: structuringPrompt
          }
        ],
        temperature: 0.1,
      }),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Lovable AI error:', geminiResponse.status, errorText);
      throw new Error(`Lovable AI error: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    const structuredContent = geminiData.choices?.[0]?.message?.content || '[]';
    
    console.log('Structured response received');

    // Parse the JSON response
    let suggestions: RuleSuggestion[] = [];
    try {
      // Extract JSON from potential markdown code blocks
      let jsonStr = structuredContent;
      const jsonMatch = structuredContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      suggestions = JSON.parse(jsonStr);
      
      if (!Array.isArray(suggestions)) {
        suggestions = [];
      }
    } catch (parseError) {
      console.error('Failed to parse structured response:', parseError);
      console.log('Raw response:', structuredContent);
      suggestions = [];
    }

    console.log(`Parsed ${suggestions.length} suggestions`);

    // Validate suggestions have verified URLs
    const validatedSuggestions = suggestions.filter(s => {
      // Keep suggestions that either have a verified URL or no URL requirement
      if (s.suggestedSourceUrl) {
        const isVerified = verifiedUrls.some(url => 
          s.suggestedSourceUrl?.includes(url) || url.includes(s.suggestedSourceUrl || '')
        );
        if (!isVerified) {
          console.log(`Filtering out suggestion with unverified URL: ${s.suggestedSourceUrl}`);
          return false;
        }
      }
      return true;
    });

    console.log(`${validatedSuggestions.length} suggestions with verified URLs`);

    // Save suggestions to database
    if (validatedSuggestions.length > 0) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const dbSuggestions = validatedSuggestions.map(s => ({
        state_id: stateId,
        change_type: s.changeType,
        existing_rule_id: s.existingRuleId || null,
        suggested_name: s.suggestedName,
        suggested_description: s.suggestedDescription,
        suggested_category: s.suggestedCategory || null,
        suggested_citation: s.suggestedCitation || null,
        suggested_source_url: s.suggestedSourceUrl || null,
        suggested_severity: s.suggestedSeverity || null,
        suggested_validation_prompt: s.suggestedValidationPrompt || null,
        ai_reasoning: s.reasoning || null,
        source_excerpt: s.sourceExcerpt || null,
        status: 'pending'
      }));

      const { error: insertError } = await supabase
        .from('rule_change_suggestions')
        .insert(dbSuggestions);

      if (insertError) {
        console.error('Failed to save suggestions:', insertError);
        throw new Error(`Failed to save suggestions: ${insertError.message}`);
      }

      console.log(`Saved ${dbSuggestions.length} suggestions to database`);
    }

    return new Response(JSON.stringify({
      success: true,
      stateId,
      stateName,
      suggestionsCount: validatedSuggestions.length,
      citationsCount: verifiedUrls.length,
      searchSummary: searchContent.substring(0, 500) + '...',
      verifiedUrls
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Perplexity regulatory search error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
