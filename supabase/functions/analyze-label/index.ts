import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalysisRequest {
  imageBase64: string;
  panelType: string;
  productType: string;
  stateName: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, panelType, productType, stateName }: AnalysisRequest = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log(`Analyzing ${panelType} panel for ${productType} in ${stateName}`);

    const systemPrompt = `You are an expert cannabis label compliance analyst. Your job is to meticulously extract ALL information from cannabis product labels and packaging for regulatory compliance verification.

For the ${panelType} panel of a ${productType} product in ${stateName}, extract:

1. **Text Content**: ALL visible text including:
   - Product name and brand
   - Warning statements (exact wording)
   - THC/THCa content and percentages
   - CBD content if present
   - Net weight (format: value and unit)
   - Ingredient lists
   - Manufacturer/distributor info
   - Batch/lot numbers
   - Testing dates and lab info
   - License numbers
   - "Keep out of reach of children" statement
   - Government warning text

2. **Visual Elements**:
   - Universal cannabis symbol (THC warning symbol) - present/absent, size estimate
   - Warning icons or symbols
   - Company logos
   - QR codes
   - Barcodes

3. **Layout & Formatting**:
   - Text sizes (relative: large, medium, small, very small)
   - Color contrasts (good, poor)
   - Font legibility
   - Warning text prominence

4. **Specific Compliance Items for ${stateName}**:
   - Required warning placements
   - Net weight format (ounces then grams, or grams then ounces)
   - Any state-specific required elements

Return a JSON object with this structure:
{
  "productName": "string or null",
  "brandName": "string or null",
  "thcContent": { "value": "string or null", "format": "percentage/mg", "prominent": true/false },
  "thcaContent": { "value": "string or null", "format": "percentage/mg" },
  "cbdContent": { "value": "string or null", "format": "percentage/mg" },
  "netWeight": { "value": "string or null", "unit": "string", "format": "oz then g / g then oz / other" },
  "ingredients": ["array of ingredients or empty"],
  "warnings": {
    "keepOutOfReach": { "present": true/false, "exactText": "string or null" },
    "governmentWarning": { "present": true/false, "exactText": "string or null" },
    "pregnancyWarning": { "present": true/false },
    "impairmentWarning": { "present": true/false },
    "otherWarnings": ["array of other warning texts"]
  },
  "universalSymbol": { "present": true/false, "sizeEstimate": "small/medium/large" },
  "manufacturerInfo": { "name": "string or null", "address": "string or null", "license": "string or null" },
  "batchInfo": { "lotNumber": "string or null", "testDate": "string or null", "labName": "string or null" },
  "qrCode": true/false,
  "barcode": true/false,
  "layoutQuality": {
    "textLegibility": "good/fair/poor",
    "warningProminence": "good/fair/poor",
    "overallContrast": "good/fair/poor"
  },
  "additionalNotes": "any other relevant observations",
  "rawTextExtracted": "all text visible on the label in reading order",
  "extractionConfidence": {
    "overall": 0.0-1.0,
    "thcContent": 0.0-1.0,
    "warnings": 0.0-1.0,
    "netWeight": 0.0-1.0,
    "manufacturerInfo": 0.0-1.0,
    "ingredients": 0.0-1.0
  },
  "flaggedForReview": true/false,
  "reviewReasons": ["array of reasons if flagged, e.g., 'Image quality poor', 'Text partially obscured'"]
}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Please analyze this ${panelType} panel image from a cannabis ${productType} product and extract all compliance-relevant information according to the structure provided.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageBase64
                }
              }
            ]
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
    
    console.log('AI response received, parsing...');
    
    // Try to extract JSON from the response
    let extractedData;
    try {
      // Look for JSON in the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        extractedData = { rawTextExtracted: content, parseError: true };
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      extractedData = { rawTextExtracted: content, parseError: true };
    }

    // Calculate if review is needed based on confidence scores
    const confidence = extractedData?.extractionConfidence || {};
    const lowConfidenceThreshold = 0.85;
    const flaggedForReview = extractedData?.flaggedForReview || 
      Object.values(confidence).some((v: unknown) => typeof v === 'number' && v < lowConfidenceThreshold);
    
    const reviewReasons = extractedData?.reviewReasons || [];
    if (!extractedData?.reviewReasons) {
      for (const [key, value] of Object.entries(confidence)) {
        if (typeof value === 'number' && value < lowConfidenceThreshold) {
          reviewReasons.push(`Low confidence in ${key}: ${(value * 100).toFixed(0)}%`);
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      extractedData: {
        ...extractedData,
        flaggedForReview,
        reviewReasons
      },
      panelType,
      confidence: {
        overall: confidence.overall || 0.9,
        details: confidence
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-label function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
