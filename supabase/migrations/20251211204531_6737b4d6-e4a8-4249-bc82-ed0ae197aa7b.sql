-- Track regulatory sources for each state
CREATE TABLE public.regulatory_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id UUID NOT NULL REFERENCES public.states(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  content_hash TEXT,
  last_checked TIMESTAMPTZ,
  last_content_change TIMESTAMPTZ,
  check_frequency_days INTEGER DEFAULT 7,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Store detected changes for admin review
CREATE TABLE public.rule_change_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id UUID NOT NULL REFERENCES public.states(id) ON DELETE CASCADE,
  source_id UUID REFERENCES public.regulatory_sources(id) ON DELETE SET NULL,
  existing_rule_id UUID REFERENCES public.compliance_rules(id) ON DELETE SET NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('new', 'update', 'deprecate')),
  suggested_name TEXT NOT NULL,
  suggested_description TEXT NOT NULL,
  suggested_category TEXT,
  suggested_severity TEXT,
  suggested_validation_prompt TEXT,
  suggested_citation TEXT,
  ai_reasoning TEXT,
  source_excerpt TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Audit log for all rule changes
CREATE TABLE public.rule_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES public.compliance_rules(id) ON DELETE SET NULL,
  state_id UUID REFERENCES public.states(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deactivated', 'reactivated', 'deleted')),
  changed_by UUID,
  change_reason TEXT,
  previous_version JSONB,
  new_version JSONB,
  suggestion_id UUID REFERENCES public.rule_change_suggestions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.regulatory_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rule_change_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rule_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for regulatory_sources
CREATE POLICY "Admins can manage regulatory sources"
ON public.regulatory_sources FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view active sources"
ON public.regulatory_sources FOR SELECT
USING (is_active = true);

-- RLS Policies for rule_change_suggestions
CREATE POLICY "Admins can manage rule suggestions"
ON public.rule_change_suggestions FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view suggestions"
ON public.rule_change_suggestions FOR SELECT
USING (true);

-- RLS Policies for rule_audit_log
CREATE POLICY "Admins can manage audit logs"
ON public.rule_audit_log FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view audit logs"
ON public.rule_audit_log FOR SELECT
USING (true);

-- Trigger for updated_at on regulatory_sources
CREATE TRIGGER update_regulatory_sources_updated_at
BEFORE UPDATE ON public.regulatory_sources
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();