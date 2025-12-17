-- Create rule_source_type enum
CREATE TYPE rule_source_type AS ENUM ('regulatory', 'internal');

-- Add source_type column to compliance_rules with default 'regulatory' for existing rules
ALTER TABLE public.compliance_rules 
ADD COLUMN source_type rule_source_type NOT NULL DEFAULT 'regulatory';