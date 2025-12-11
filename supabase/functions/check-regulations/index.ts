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
  last_content_change: string | null;
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

// Generate a simple hash of content for change detection
async function generateContentHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Scrape a URL using Firecrawl
async function scrapeUrl(url: string, firecrawlApiKey: string): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    console.log(`Scraping URL with Firecrawl: ${url}`);
    
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 5000,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Firecrawl error:', data);
      return { success: false, error: data.error || `HTTP ${response.status}` };
    }

    const markdown = data.data?.markdown || data.markdown;
    if (!markdown) {
      return { success: false, error: 'No content returned from Firecrawl' };
    }

    console.log(`Successfully scraped ${url}, content length: ${markdown.length}`);
    return { success: true, content: markdown };
  } catch (error) {
    console.error('Firecrawl scrape error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    if (!firecrawlApiKey) {
      throw new Error('FIRECRAWL_API_KEY is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get optional state filter from request
    let stateFilter: string | null = null;
    let forceCheck = false;
    try {
      const body = await req.json();
      stateFilter = body.state_id || null;
      forceCheck = body.force || false;
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
        last_content_change,
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
      source_name: string;
      state: string;
      content_changed: boolean;
      suggestions_created: number;
      status: string;
      error?: string;
    }> = [];

    for (const source of (sources || []) as unknown as RegulatorySource[]) {
      try {
        console.log(`\n=== Checking: ${source.source_name} for ${source.states?.name || 'Unknown State'} ===`);

        // Step 1: Scrape the regulatory source URL using Firecrawl
        const scrapeResult = await scrapeUrl(source.source_url, firecrawlApiKey);
        
        if (!scrapeResult.success || !scrapeResult.content) {
          console.error(`Failed to scrape ${source.source_name}: ${scrapeResult.error}`);
          results.push({
            source_id: source.id,
            source_name: source.source_name,
            state: source.states?.name || 'Unknown',
            content_changed: false,
            suggestions_created: 0,
            status: 'scrape_error',
            error: scrapeResult.error
          });
          continue;
        }

        // Step 2: Generate content hash and check for changes
        const newContentHash = await generateContentHash(scrapeResult.content);
        const contentChanged = source.content_hash !== newContentHash;

        console.log(`Content hash: ${newContentHash.substring(0, 16)}...`);
        console.log(`Previous hash: ${source.content_hash?.substring(0, 16) || 'none'}...`);
        console.log(`Content changed: ${contentChanged}`);

        // If content hasn't changed and we're not forcing a check, skip AI analysis
        if (!contentChanged && !forceCheck) {
          // Just update last_checked timestamp
          await supabase
            .from('regulatory_sources')
            .update({ last_checked: new Date().toISOString() })
            .eq('id', source.id);

          results.push({
            source_id: source.id,
            source_name: source.source_name,
            state: source.states?.name || 'Unknown',
            content_changed: false,
            suggestions_created: 0,
            status: 'no_changes'
          });
          console.log(`No content changes detected, skipping AI analysis`);
          continue;
        }

        // Step 3: Get existing rules for this state
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

        // Step 4: Use AI to analyze the ACTUAL scraped content
        const analysisPrompt = `You are a cannabis compliance regulatory expert. Analyze the following ACTUAL regulatory content scraped from ${source.source_name} for ${source.states?.name || 'this state'}.

=== SCRAPED REGULATORY CONTENT ===
${scrapeResult.content.substring(0, 50000)}
=== END OF SCRAPED CONTENT ===

Source URL: ${source.source_url}

Here are the EXISTING compliance rules we have for this state:
${JSON.stringify(rulesContext, null, 2)}

Based on the ACTUAL REGULATORY CONTENT above, please identify:

1. Any rules that may be OUTDATED or need updating based on the current regulations
2. Any NEW requirements in the regulations that are missing from our current ruleset
3. Any rules that should be DEPRECATED because they're no longer in the regulations

Focus specifically on CANNABIS LABELING requirements including:
- Required warning statements
- Required symbols and icons (THC symbol, etc.)
- Ingredient panel requirements
- Net weight and quantity formats
- THC/CBD content display requirements
- Manufacturer/cultivator information
- Batch and testing information
- Placement and size requirements

For each suggestion, provide:
- change_type: "new", "update", or "deprecate"
- existing_rule_name: (for updates/deprecations) the name of the existing rule being modified
- suggested_name: clear, descriptive rule name
- suggested_description: detailed description of the requirement
- suggested_category: one of "Required Warnings", "Symbols & Icons", "Ingredient Panels", "Net Weight Format", "Placement Rules", "THC Content", "Manufacturer Info", "Batch & Testing", "General"
- suggested_severity: "error" (must have), "warning" (should have), or "info" (nice to have)
- suggested_citation: the specific regulation section/citation from the scraped content
- ai_reasoning: why you're suggesting this change based on the scraped content
- source_excerpt: the exact relevant text from the scraped regulations (keep brief, under 200 chars)

Respond with a JSON array of suggestions. If the scraped content doesn't contain labeling requirements or no changes are needed, respond with an empty array [].
Only suggest changes you can verify from the ACTUAL SCRAPED CONTENT above.`;

        console.log('Sending scraped content to AI for analysis...');

        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'You are a cannabis regulatory compliance expert. Analyze the provided regulatory content and respond only with valid JSON arrays. Focus on labeling requirements.' },
              { role: 'user', content: analysisPrompt }
            ],
          }),
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error(`AI analysis failed for ${source.source_name}: ${errorText}`);
          results.push({
            source_id: source.id,
            source_name: source.source_name,
            state: source.states?.name || 'Unknown',
            content_changed: contentChanged,
            suggestions_created: 0,
            status: 'ai_error',
            error: errorText
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
            source_name: source.source_name,
            state: source.states?.name || 'Unknown',
            content_changed: contentChanged,
            suggestions_created: 0,
            status: 'parse_error'
          });
          continue;
        }

        console.log(`AI returned ${suggestions.length} suggestions`);

        // Step 5: Store suggestions in database
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

        // Step 6: Update source with new hash and timestamps
        const updateData: Record<string, string> = {
          last_checked: new Date().toISOString(),
          content_hash: newContentHash,
        };
        
        if (contentChanged) {
          updateData.last_content_change = new Date().toISOString();
        }

        await supabase
          .from('regulatory_sources')
          .update(updateData)
          .eq('id', source.id);

        results.push({
          source_id: source.id,
          source_name: source.source_name,
          state: source.states?.name || 'Unknown',
          content_changed: contentChanged,
          suggestions_created: suggestionsCreated,
          status: 'success'
        });

        console.log(`Created ${suggestionsCreated} suggestions for ${source.states?.name || 'Unknown'}`);

      } catch (sourceError) {
        console.error(`Error processing source ${source.source_name}:`, sourceError);
        results.push({
          source_id: source.id,
          source_name: source.source_name,
          state: source.states?.name || 'Unknown',
          content_changed: false,
          suggestions_created: 0,
          status: 'error',
          error: sourceError instanceof Error ? sourceError.message : 'Unknown error'
        });
      }
    }

    const totalSuggestions = results.reduce((sum, r) => sum + r.suggestions_created, 0);
    const sourcesWithChanges = results.filter(r => r.content_changed).length;

    return new Response(JSON.stringify({
      success: true,
      sources_checked: results.length,
      sources_with_changes: sourcesWithChanges,
      total_suggestions_created: totalSuggestions,
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
