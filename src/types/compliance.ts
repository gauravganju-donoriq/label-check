export type AppRole = 'admin' | 'user';
export type ComplianceSeverity = 'error' | 'warning' | 'info';
export type ComplianceStatus = 'pass' | 'warning' | 'fail';
export type ProductType = 'flower' | 'edibles' | 'concentrates' | 'topicals' | 'tinctures' | 'pre_rolls' | 'other';
export type PanelType = 'front' | 'back' | 'left_side' | 'right_side' | 'exit_bag' | 'other';

export interface State {
  id: string;
  name: string;
  abbreviation: string;
  is_enabled: boolean;
}

export interface ComplianceRule {
  id: string;
  state_id: string;
  name: string;
  description: string;
  category: string;
  severity: ComplianceSeverity;
  citation: string | null;
  product_types: ProductType[];
  validation_prompt: string;
  is_active: boolean;
  version: number;
}

export interface CustomRule {
  id: string;
  user_id: string;
  name: string;
  description: string;
  is_active: boolean;
}

export interface ComplianceCheck {
  id: string;
  user_id: string;
  state_id: string;
  product_type: ProductType;
  product_name: string | null;
  overall_status: ComplianceStatus | null;
  pass_count: number;
  warning_count: number;
  fail_count: number;
  created_at: string;
  completed_at: string | null;
  states?: State;
}

export interface PanelUpload {
  id: string;
  compliance_check_id: string;
  panel_type: PanelType;
  file_path: string;
  file_name: string;
  extracted_data: Record<string, unknown> | null;
}

export interface CheckResult {
  id: string;
  compliance_check_id: string;
  rule_id: string | null;
  custom_rule_id: string | null;
  panel_upload_id: string | null;
  status: ComplianceStatus;
  found_value: string | null;
  expected_value: string | null;
  explanation: string | null;
  citation: string | null;
  compliance_rules?: ComplianceRule;
  custom_rules?: CustomRule;
}

export interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  flower: 'Flower',
  edibles: 'Edibles',
  concentrates: 'Concentrates',
  topicals: 'Topicals',
  tinctures: 'Tinctures',
  pre_rolls: 'Pre-Rolls',
  other: 'Other',
};

export const PANEL_TYPE_LABELS: Record<PanelType, string> = {
  front: 'Front Panel',
  back: 'Back Panel',
  left_side: 'Left Side',
  right_side: 'Right Side',
  exit_bag: 'Exit Bag',
  other: 'Other',
};

export const RULE_CATEGORIES = [
  'Required Warnings',
  'Symbols & Icons',
  'Ingredient Panels',
  'Net Weight Format',
  'Placement Rules',
  'THC Content',
  'Manufacturer Info',
  'Batch & Testing',
  'General',
] as const;
