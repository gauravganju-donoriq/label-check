export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      check_results: {
        Row: {
          citation: string | null
          compliance_check_id: string
          created_at: string
          custom_rule_id: string | null
          expected_value: string | null
          explanation: string | null
          found_value: string | null
          id: string
          panel_upload_id: string | null
          rule_id: string | null
          status: Database["public"]["Enums"]["compliance_status"]
        }
        Insert: {
          citation?: string | null
          compliance_check_id: string
          created_at?: string
          custom_rule_id?: string | null
          expected_value?: string | null
          explanation?: string | null
          found_value?: string | null
          id?: string
          panel_upload_id?: string | null
          rule_id?: string | null
          status: Database["public"]["Enums"]["compliance_status"]
        }
        Update: {
          citation?: string | null
          compliance_check_id?: string
          created_at?: string
          custom_rule_id?: string | null
          expected_value?: string | null
          explanation?: string | null
          found_value?: string | null
          id?: string
          panel_upload_id?: string | null
          rule_id?: string | null
          status?: Database["public"]["Enums"]["compliance_status"]
        }
        Relationships: [
          {
            foreignKeyName: "check_results_compliance_check_id_fkey"
            columns: ["compliance_check_id"]
            isOneToOne: false
            referencedRelation: "compliance_checks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_results_custom_rule_id_fkey"
            columns: ["custom_rule_id"]
            isOneToOne: false
            referencedRelation: "custom_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_results_panel_upload_id_fkey"
            columns: ["panel_upload_id"]
            isOneToOne: false
            referencedRelation: "panel_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_results_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "compliance_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_checks: {
        Row: {
          completed_at: string | null
          created_at: string
          fail_count: number | null
          id: string
          overall_status:
            | Database["public"]["Enums"]["compliance_status"]
            | null
          pass_count: number | null
          product_name: string | null
          product_type: Database["public"]["Enums"]["product_type"]
          state_id: string
          user_id: string
          warning_count: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          fail_count?: number | null
          id?: string
          overall_status?:
            | Database["public"]["Enums"]["compliance_status"]
            | null
          pass_count?: number | null
          product_name?: string | null
          product_type: Database["public"]["Enums"]["product_type"]
          state_id: string
          user_id: string
          warning_count?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          fail_count?: number | null
          id?: string
          overall_status?:
            | Database["public"]["Enums"]["compliance_status"]
            | null
          pass_count?: number | null
          product_name?: string | null
          product_type?: Database["public"]["Enums"]["product_type"]
          state_id?: string
          user_id?: string
          warning_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_checks_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_rules: {
        Row: {
          category: string
          citation: string | null
          created_at: string
          description: string
          id: string
          is_active: boolean
          name: string
          product_types: Database["public"]["Enums"]["product_type"][] | null
          severity: Database["public"]["Enums"]["compliance_severity"]
          source_url: string | null
          state_id: string
          updated_at: string
          validation_prompt: string
          version: number
        }
        Insert: {
          category: string
          citation?: string | null
          created_at?: string
          description: string
          id?: string
          is_active?: boolean
          name: string
          product_types?: Database["public"]["Enums"]["product_type"][] | null
          severity?: Database["public"]["Enums"]["compliance_severity"]
          source_url?: string | null
          state_id: string
          updated_at?: string
          validation_prompt: string
          version?: number
        }
        Update: {
          category?: string
          citation?: string | null
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          name?: string
          product_types?: Database["public"]["Enums"]["product_type"][] | null
          severity?: Database["public"]["Enums"]["compliance_severity"]
          source_url?: string | null
          state_id?: string
          updated_at?: string
          validation_prompt?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "compliance_rules_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_rules: {
        Row: {
          created_at: string
          description: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      panel_uploads: {
        Row: {
          compliance_check_id: string
          created_at: string
          extracted_data: Json | null
          file_name: string
          file_path: string
          id: string
          panel_type: Database["public"]["Enums"]["panel_type"]
        }
        Insert: {
          compliance_check_id: string
          created_at?: string
          extracted_data?: Json | null
          file_name: string
          file_path: string
          id?: string
          panel_type: Database["public"]["Enums"]["panel_type"]
        }
        Update: {
          compliance_check_id?: string
          created_at?: string
          extracted_data?: Json | null
          file_name?: string
          file_path?: string
          id?: string
          panel_type?: Database["public"]["Enums"]["panel_type"]
        }
        Relationships: [
          {
            foreignKeyName: "panel_uploads_compliance_check_id_fkey"
            columns: ["compliance_check_id"]
            isOneToOne: false
            referencedRelation: "compliance_checks"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_name: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      regulatory_sources: {
        Row: {
          check_frequency_days: number | null
          content_hash: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          last_checked: string | null
          last_content_change: string | null
          source_name: string
          source_url: string
          state_id: string
          updated_at: string | null
        }
        Insert: {
          check_frequency_days?: number | null
          content_hash?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_checked?: string | null
          last_content_change?: string | null
          source_name: string
          source_url: string
          state_id: string
          updated_at?: string | null
        }
        Update: {
          check_frequency_days?: number | null
          content_hash?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_checked?: string | null
          last_content_change?: string | null
          source_name?: string
          source_url?: string
          state_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regulatory_sources_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          compliance_check_id: string
          created_at: string
          csv_path: string | null
          id: string
          pdf_path: string | null
        }
        Insert: {
          compliance_check_id: string
          created_at?: string
          csv_path?: string | null
          id?: string
          pdf_path?: string | null
        }
        Update: {
          compliance_check_id?: string
          created_at?: string
          csv_path?: string | null
          id?: string
          pdf_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_compliance_check_id_fkey"
            columns: ["compliance_check_id"]
            isOneToOne: false
            referencedRelation: "compliance_checks"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_audit_log: {
        Row: {
          action: string
          change_reason: string | null
          changed_by: string | null
          created_at: string | null
          id: string
          new_version: Json | null
          previous_version: Json | null
          rule_id: string | null
          state_id: string | null
          suggestion_id: string | null
        }
        Insert: {
          action: string
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_version?: Json | null
          previous_version?: Json | null
          rule_id?: string | null
          state_id?: string | null
          suggestion_id?: string | null
        }
        Update: {
          action?: string
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_version?: Json | null
          previous_version?: Json | null
          rule_id?: string | null
          state_id?: string | null
          suggestion_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rule_audit_log_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "compliance_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_audit_log_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_audit_log_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "rule_change_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_change_suggestions: {
        Row: {
          ai_reasoning: string | null
          change_type: string
          created_at: string | null
          existing_rule_id: string | null
          id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_excerpt: string | null
          source_id: string | null
          state_id: string
          status: string | null
          suggested_category: string | null
          suggested_citation: string | null
          suggested_description: string
          suggested_name: string
          suggested_severity: string | null
          suggested_source_url: string | null
          suggested_validation_prompt: string | null
        }
        Insert: {
          ai_reasoning?: string | null
          change_type: string
          created_at?: string | null
          existing_rule_id?: string | null
          id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_excerpt?: string | null
          source_id?: string | null
          state_id: string
          status?: string | null
          suggested_category?: string | null
          suggested_citation?: string | null
          suggested_description: string
          suggested_name: string
          suggested_severity?: string | null
          suggested_source_url?: string | null
          suggested_validation_prompt?: string | null
        }
        Update: {
          ai_reasoning?: string | null
          change_type?: string
          created_at?: string | null
          existing_rule_id?: string | null
          id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_excerpt?: string | null
          source_id?: string | null
          state_id?: string
          status?: string | null
          suggested_category?: string | null
          suggested_citation?: string | null
          suggested_description?: string
          suggested_name?: string
          suggested_severity?: string | null
          suggested_source_url?: string | null
          suggested_validation_prompt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rule_change_suggestions_existing_rule_id_fkey"
            columns: ["existing_rule_id"]
            isOneToOne: false
            referencedRelation: "compliance_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_change_suggestions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "regulatory_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_change_suggestions_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      states: {
        Row: {
          abbreviation: string
          created_at: string
          id: string
          is_enabled: boolean
          name: string
          updated_at: string
        }
        Insert: {
          abbreviation: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          abbreviation?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      compliance_severity: "error" | "warning" | "info"
      compliance_status: "pass" | "warning" | "fail"
      panel_type:
        | "front"
        | "back"
        | "left_side"
        | "right_side"
        | "exit_bag"
        | "other"
      product_type:
        | "flower"
        | "edibles"
        | "concentrates"
        | "topicals"
        | "tinctures"
        | "pre_rolls"
        | "other"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      compliance_severity: ["error", "warning", "info"],
      compliance_status: ["pass", "warning", "fail"],
      panel_type: [
        "front",
        "back",
        "left_side",
        "right_side",
        "exit_bag",
        "other",
      ],
      product_type: [
        "flower",
        "edibles",
        "concentrates",
        "topicals",
        "tinctures",
        "pre_rolls",
        "other",
      ],
    },
  },
} as const
