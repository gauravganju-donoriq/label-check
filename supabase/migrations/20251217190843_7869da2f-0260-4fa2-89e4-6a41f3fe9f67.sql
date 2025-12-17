-- Add source_url column to compliance_rules for direct links to regulation pages
ALTER TABLE public.compliance_rules 
ADD COLUMN source_url text;

-- Add suggested_source_url column to rule_change_suggestions for AI-suggested URLs
ALTER TABLE public.rule_change_suggestions 
ADD COLUMN suggested_source_url text;

-- Add comment for documentation
COMMENT ON COLUMN public.compliance_rules.source_url IS 'Direct URL to the regulatory source page for this citation';
COMMENT ON COLUMN public.rule_change_suggestions.suggested_source_url IS 'AI-suggested URL to the regulatory source page';