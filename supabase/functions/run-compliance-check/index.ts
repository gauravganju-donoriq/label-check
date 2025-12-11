import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ComplianceCheckRequest {
  complianceCheckId: string;
  extractedPanels: Array<{
    panelId: string;
    panelType: string;
    extractedData: Record<string, unknown>;
  }>;
  rules: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    severity: string;
    citation: string | null;
    validation_prompt: string;
  }>;
  customRules: Array<{
    id: string;
    name: string;
    description: string;
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { complianceCheckId, extractedPanels, rules, customRules }: ComplianceCheckRequest = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log(`Running compliance check ${complianceCheckId} with ${rules.length} rules and ${customRules.length} custom rules`);

    // Combine all extracted data for context
    const combinedExtraction = extractedPanels.map(p => ({
      panel: p.panelType,
      data: p.extractedData
    }));

    const systemPrompt = `You are a cannabis label compliance expert. Analyze the extracted label data against compliance rules and determine pass/warning/fail status for each rule.

For each rule, evaluate the extracted data and determine:
- "pass": The requirement is fully met
- "warning": The requirement is partially met or unclear
- "fail": The requirement is not met

Return a JSON array with this structure for each rule:
[
  {
    "ruleId": "uuid of the rule",
    "status": "pass" | "warning" | "fail",
    "foundValue": "what was found in the label data",
    "expectedValue": "what the rule requires",
    "explanation": "brief explanation of why this status was assigned",
    "panelFound": "which panel type contains the relevant info (or 'not found')"
  }
]

Be thorough but fair. If something is present but might not fully meet requirements, use "warning". Only use "fail" for clear violations or missing required elements.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `## Extracted Label Data (from all panels):
${JSON.stringify(combinedExtraction, null, 2)}

## Compliance Rules to Check:
${rules.map(r => `
Rule ID: ${r.id}
Name: ${r.name}
Category: ${r.category}
Description: ${r.description}
Validation Criteria: ${r.validation_prompt}
Citation: ${r.citation || 'N/A'}
Severity: ${r.severity}
---`).join('\n')}

${customRules.length > 0 ? `
## Custom/Internal Rules to Check:
${customRules.map(r => `
Custom Rule ID: ${r.id}
Name: ${r.name}
Description: ${r.description}
---`).join('\n')}` : ''}

Please analyze each rule against the extracted data and return the compliance results as a JSON array.`
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI usage limit reached. Please add credits to continue.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    console.log('Compliance check response received');

    // Parse the results
    let results;
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        results = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No valid JSON array found in response');
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return new Response(JSON.stringify({ 
        error: 'Failed to parse compliance results',
        rawResponse: content 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate summary
    const passCount = results.filter((r: { status: string }) => r.status === 'pass').length;
    const warningCount = results.filter((r: { status: string }) => r.status === 'warning').length;
    const failCount = results.filter((r: { status: string }) => r.status === 'fail').length;
    
    const overallStatus = failCount > 0 ? 'fail' : warningCount > 0 ? 'warning' : 'pass';

    return new Response(JSON.stringify({ 
      success: true, 
      results,
      summary: {
        passCount,
        warningCount,
        failCount,
        overallStatus
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in run-compliance-check function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
