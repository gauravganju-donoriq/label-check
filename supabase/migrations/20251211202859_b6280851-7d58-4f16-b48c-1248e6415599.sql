-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create enum for compliance severity levels
CREATE TYPE public.compliance_severity AS ENUM ('error', 'warning', 'info');

-- Create enum for compliance status
CREATE TYPE public.compliance_status AS ENUM ('pass', 'warning', 'fail');

-- Create enum for product types
CREATE TYPE public.product_type AS ENUM ('flower', 'edibles', 'concentrates', 'topicals', 'tinctures', 'pre_rolls', 'other');

-- Create enum for panel types
CREATE TYPE public.panel_type AS ENUM ('front', 'back', 'left_side', 'right_side', 'exit_bag', 'other');

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    email TEXT NOT NULL,
    full_name TEXT,
    company_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Create states table
CREATE TABLE public.states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    abbreviation TEXT NOT NULL UNIQUE,
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create compliance_rules table
CREATE TABLE public.compliance_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state_id UUID REFERENCES public.states(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    severity compliance_severity NOT NULL DEFAULT 'error',
    citation TEXT,
    product_types product_type[] DEFAULT ARRAY['flower', 'edibles', 'concentrates', 'topicals', 'tinctures', 'pre_rolls', 'other']::product_type[],
    validation_prompt TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create custom_rules table (internal SOP rules)
CREATE TABLE public.custom_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create compliance_checks table
CREATE TABLE public.compliance_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    state_id UUID REFERENCES public.states(id) NOT NULL,
    product_type product_type NOT NULL,
    product_name TEXT,
    overall_status compliance_status,
    pass_count INTEGER DEFAULT 0,
    warning_count INTEGER DEFAULT 0,
    fail_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create panel_uploads table
CREATE TABLE public.panel_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    compliance_check_id UUID REFERENCES public.compliance_checks(id) ON DELETE CASCADE NOT NULL,
    panel_type panel_type NOT NULL,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    extracted_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create check_results table
CREATE TABLE public.check_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    compliance_check_id UUID REFERENCES public.compliance_checks(id) ON DELETE CASCADE NOT NULL,
    rule_id UUID REFERENCES public.compliance_rules(id),
    custom_rule_id UUID REFERENCES public.custom_rules(id),
    panel_upload_id UUID REFERENCES public.panel_uploads(id),
    status compliance_status NOT NULL,
    found_value TEXT,
    expected_value TEXT,
    explanation TEXT,
    citation TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create reports table
CREATE TABLE public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    compliance_check_id UUID REFERENCES public.compliance_checks(id) ON DELETE CASCADE NOT NULL,
    pdf_path TEXT,
    csv_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.panel_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Create profile
    INSERT INTO public.profiles (user_id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');
    
    -- Assign default user role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
    
    RETURN NEW;
END;
$$;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Add updated_at triggers
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_states_updated_at
    BEFORE UPDATE ON public.states
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_compliance_rules_updated_at
    BEFORE UPDATE ON public.compliance_rules
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_custom_rules_updated_at
    BEFORE UPDATE ON public.custom_rules
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Admins can view all profiles"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
    ON public.user_roles FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles"
    ON public.user_roles FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
    ON public.user_roles FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for states (read-only for authenticated users)
CREATE POLICY "Authenticated users can view enabled states"
    ON public.states FOR SELECT
    TO authenticated
    USING (is_enabled = true);

CREATE POLICY "Admins can manage states"
    ON public.states FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for compliance_rules
CREATE POLICY "Authenticated users can view active rules"
    ON public.compliance_rules FOR SELECT
    TO authenticated
    USING (is_active = true);

CREATE POLICY "Admins can manage rules"
    ON public.compliance_rules FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for custom_rules
CREATE POLICY "Users can view their own custom rules"
    ON public.custom_rules FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own custom rules"
    ON public.custom_rules FOR ALL
    TO authenticated
    USING (user_id = auth.uid());

-- RLS Policies for compliance_checks
CREATE POLICY "Users can view their own checks"
    ON public.compliance_checks FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can create their own checks"
    ON public.compliance_checks FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own checks"
    ON public.compliance_checks FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own checks"
    ON public.compliance_checks FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Admins can view all checks"
    ON public.compliance_checks FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for panel_uploads
CREATE POLICY "Users can view panels from their own checks"
    ON public.panel_uploads FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.compliance_checks
            WHERE compliance_checks.id = panel_uploads.compliance_check_id
            AND compliance_checks.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert panels to their own checks"
    ON public.panel_uploads FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.compliance_checks
            WHERE compliance_checks.id = panel_uploads.compliance_check_id
            AND compliance_checks.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete panels from their own checks"
    ON public.panel_uploads FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.compliance_checks
            WHERE compliance_checks.id = panel_uploads.compliance_check_id
            AND compliance_checks.user_id = auth.uid()
        )
    );

-- RLS Policies for check_results
CREATE POLICY "Users can view results from their own checks"
    ON public.check_results FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.compliance_checks
            WHERE compliance_checks.id = check_results.compliance_check_id
            AND compliance_checks.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert results to their own checks"
    ON public.check_results FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.compliance_checks
            WHERE compliance_checks.id = check_results.compliance_check_id
            AND compliance_checks.user_id = auth.uid()
        )
    );

-- RLS Policies for reports
CREATE POLICY "Users can view their own reports"
    ON public.reports FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.compliance_checks
            WHERE compliance_checks.id = reports.compliance_check_id
            AND compliance_checks.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create reports for their own checks"
    ON public.reports FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.compliance_checks
            WHERE compliance_checks.id = reports.compliance_check_id
            AND compliance_checks.user_id = auth.uid()
        )
    );

-- Create storage bucket for label uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('label-uploads', 'label-uploads', false);

-- Create storage bucket for generated reports
INSERT INTO storage.buckets (id, name, public)
VALUES ('compliance-reports', 'compliance-reports', false);

-- Storage policies for label-uploads bucket
CREATE POLICY "Users can upload their own labels"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'label-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own labels"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'label-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own labels"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'label-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for compliance-reports bucket
CREATE POLICY "Users can view their own reports"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'compliance-reports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can create their own reports"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'compliance-reports' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Insert Montana as the initial enabled state
INSERT INTO public.states (name, abbreviation, is_enabled)
VALUES ('Montana', 'MT', true);