import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RegulatorySource {
  id: string;
  state_id: string;
  source_name: string;
  source_url: string;
  content_hash: string | null;
  last_checked: string | null;
  states: { name: string; abbreviation: string };
}

interface ExistingRule {
  id: string;
  name: string;
  description: string;
  category: string;
  severity: string;
  citation: string | null;
  validation_prompt: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get optional state filter from request
    let stateFilter: string | null = null;
    try {
      const body = await req.json();
      stateFilter = body.state_id || null;
    } catch {
      // No body provided, check all states
    }

    // Get active regulatory sources that need checking
    let query = supabase
      .from('regulatory_sources')
      .select(`
        id,
        state_id,
        source_name,
        source_url,
        content_hash,
        last_checked,
        check_frequency_days,
        states (name, abbreviation)
      `)
      .eq('is_active', true);

    if (stateFilter) {
      query = query.eq('state_id', stateFilter);
    }

    const { data: sources, error: sourcesError } = await query;

    if (sourcesError) {
      throw new Error(`Failed to fetch regulatory sources: ${sourcesError.message}`);
    }

    console.log(`Found ${sources?.length || 0} regulatory sources to check`);

    const results: Array<{
      source_id: string;
      state: string;
      suggestions_created: number;
      status: string;
    }> = [];

    for (const source of (sources || []) as unknown as RegulatorySource[]) {
      try {
        console.log(`Checking: ${source.source_name} for ${source.states?.name || 'Unknown State'}`);

        // Get existing rules for this state
        const { data: existingRules, error: rulesError } = await supabase
          .from('compliance_rules')
          .select('id, name, description, category, severity, citation, validation_prompt')
          .eq('state_id', source.state_id)
          .eq('is_active', true);

        if (rulesError) {
          console.error(`Failed to fetch rules for state: ${rulesError.message}`);
          continue;
        }

        // Build context for AI analysis
        const rulesContext = (existingRules as ExistingRule[] || []).map(r => ({
          name: r.name,
          description: r.description,
          category: r.category,
          severity: r.severity,
          citation: r.citation
        }));

        // Use AI to analyze regulatory requirements and suggest updates
        const analysisPrompt = `You are a cannabis compliance regulatory expert. Analyze the labeling requirements for ${source.states?.name || 'this state'} cannabis products.

Current regulatory source: ${source.source_name}
Source URL: ${source.source_url}

Here are the EXISTING compliance rules we have for this state:
${JSON.stringify(rulesContext, null, 2)}

Based on your knowledge of current cannabis labeling regulations for ${source.states?.name || 'this state'} (as of your knowledge cutoff), please identify:

1. Any rules that may be OUTDATED or need updating
2. Any NEW requirements that are missing from our current ruleset
3. Any rules that should be DEPRECATED because they're no longer required

For each suggestion, provide:
- change_type: "new", "update", or "deprecate"
- existing_rule_name: (for updates/deprecations) the name of the existing rule
- suggested_name: the rule name
- suggested_description: detailed description of the requirement
- suggested_category: one of "Required Warnings", "Symbols & Icons", "Ingredient Panels", "Net Weight Format", "Placement Rules", "THC Content", "Manufacturer Info", "Batch & Testing", "General"
- suggested_severity: "error" (must have), "warning" (should have), or "info" (nice to have)
- suggested_citation: the specific regulation citation if known
- ai_reasoning: why you're suggesting this change
- source_excerpt: relevant text from regulations

Respond with a JSON array of suggestions. If no changes are needed, respond with an empty array [].
Only suggest changes you're confident about based on actual regulatory requirements.`;

        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'You are a cannabis regulatory compliance expert. Respond only with valid JSON arrays.' },
              { role: 'user', content: analysisPrompt }
            ],
            temperature: 0.3,
          }),
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error(`AI analysis failed for ${source.source_name}: ${errorText}`);
          results.push({
            source_id: source.id,
            state: source.states?.name || 'Unknown',
            suggestions_created: 0,
            status: 'ai_error'
          });
          continue;
        }

        const aiData = await aiResponse.json();
        const responseContent = aiData.choices?.[0]?.message?.content || '[]';

        // Parse AI suggestions
        let suggestions: Array<{
          change_type: string;
          existing_rule_name?: string;
          suggested_name: string;
          suggested_description: string;
          suggested_category: string;
          suggested_severity: string;
          suggested_citation?: string;
          ai_reasoning: string;
          source_excerpt?: string;
        }> = [];

        try {
          // Extract JSON from response (handle markdown code blocks)
          const jsonMatch = responseContent.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            suggestions = JSON.parse(jsonMatch[0]);
          }
        } catch (parseError) {
          console.error(`Failed to parse AI response: ${parseError}`);
          results.push({
            source_id: source.id,
            state: source.states?.name || 'Unknown',
            suggestions_created: 0,
            status: 'parse_error'
          });
          continue;
        }

        // Store suggestions in database
        let suggestionsCreated = 0;
        for (const suggestion of suggestions) {
          // Find existing rule if this is an update/deprecation
          let existingRuleId: string | null = null;
          if (suggestion.change_type !== 'new' && suggestion.existing_rule_name) {
            const existingRule = (existingRules as ExistingRule[] || []).find(
              r => r.name.toLowerCase() === suggestion.existing_rule_name?.toLowerCase()
            );
            existingRuleId = existingRule?.id || null;
          }

          // Check for duplicate suggestions
          const { data: existingSuggestion } = await supabase
            .from('rule_change_suggestions')
            .select('id')
            .eq('state_id', source.state_id)
            .eq('suggested_name', suggestion.suggested_name)
            .eq('status', 'pending')
            .single();

          if (existingSuggestion) {
            console.log(`Skipping duplicate suggestion: ${suggestion.suggested_name}`);
            continue;
          }

          const { error: insertError } = await supabase
            .from('rule_change_suggestions')
            .insert({
              state_id: source.state_id,
              source_id: source.id,
              existing_rule_id: existingRuleId,
              change_type: suggestion.change_type,
              suggested_name: suggestion.suggested_name,
              suggested_description: suggestion.suggested_description,
              suggested_category: suggestion.suggested_category,
              suggested_severity: suggestion.suggested_severity,
              suggested_validation_prompt: `Verify compliance with: ${suggestion.suggested_description}`,
              suggested_citation: suggestion.suggested_citation,
              ai_reasoning: suggestion.ai_reasoning,
              source_excerpt: suggestion.source_excerpt,
              status: 'pending'
            });

          if (insertError) {
            console.error(`Failed to insert suggestion: ${insertError.message}`);
          } else {
            suggestionsCreated++;
          }
        }

        // Update last_checked timestamp
        await supabase
          .from('regulatory_sources')
          .update({ last_checked: new Date().toISOString() })
          .eq('id', source.id);

        results.push({
          source_id: source.id,
          state: source.states?.name || 'Unknown',
          suggestions_created: suggestionsCreated,
          status: 'success'
        });

        console.log(`Created ${suggestionsCreated} suggestions for ${source.states?.name || 'Unknown'}`);

      } catch (sourceError) {
        console.error(`Error processing source ${source.source_name}:`, sourceError);
        results.push({
          source_id: source.id,
          state: source.states?.name || 'Unknown',
          suggestions_created: 0,
          status: 'error'
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      sources_checked: results.length,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in check-regulations function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
