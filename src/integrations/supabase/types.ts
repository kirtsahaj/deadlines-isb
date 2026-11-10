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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      birthdays: {
        Row: {
          campus: string
          day: number
          email: string
          month: number
          name: string
        }
        Insert: {
          campus: string
          day: number
          email: string
          month: number
          name: string
        }
        Update: {
          campus?: string
          day?: number
          email?: string
          month?: number
          name?: string
        }
        Relationships: []
      }
      courses: {
        Row: {
          created_at: string
          full_name: string
          id: string
          last_seen_at: string
          moodle_course_id: number
          raw_updated_at: string | null
          short_name: string | null
          updated_at: string
          user_id: string
          visible: boolean
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          last_seen_at?: string
          moodle_course_id: number
          raw_updated_at?: string | null
          short_name?: string | null
          updated_at?: string
          user_id: string
          visible?: boolean
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          last_seen_at?: string
          moodle_course_id?: number
          raw_updated_at?: string | null
          short_name?: string | null
          updated_at?: string
          user_id?: string
          visible?: boolean
        }
        Relationships: []
      }
      deadline_done: {
        Row: {
          done_at: string
          item_key: string
          user_id: string
        }
        Insert: {
          done_at?: string
          item_key: string
          user_id: string
        }
        Update: {
          done_at?: string
          item_key?: string
          user_id?: string
        }
        Relationships: []
      }
      deadline_items: {
        Row: {
          active: boolean
          activity_id: number | null
          conflict: boolean
          created_at: string
          deadline_status: string
          deadline_type: string
          due_at: string | null
          external_key: string
          first_seen_at: string
          id: string
          kind: string
          last_seen_at: string
          moodle_course_id: number
          removed_at: string | null
          source_evidence: Json
          source_primary: string
          submission_status: string
          text_evidence: string | null
          text_precision: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          activity_id?: number | null
          conflict?: boolean
          created_at?: string
          deadline_status?: string
          deadline_type: string
          due_at?: string | null
          external_key: string
          first_seen_at?: string
          id?: string
          kind: string
          last_seen_at?: string
          moodle_course_id: number
          removed_at?: string | null
          source_evidence?: Json
          source_primary: string
          submission_status?: string
          text_evidence?: string | null
          text_precision?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          activity_id?: number | null
          conflict?: boolean
          created_at?: string
          deadline_status?: string
          deadline_type?: string
          due_at?: string | null
          external_key?: string
          first_seen_at?: string
          id?: string
          kind?: string
          last_seen_at?: string
          moodle_course_id?: number
          removed_at?: string | null
          source_evidence?: Json
          source_primary?: string
          submission_status?: string
          text_evidence?: string | null
          text_precision?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      deadline_notifications: {
        Row: {
          deadline_id: string
          due_at: string
          sent_at: string
          user_id: string
        }
        Insert: {
          deadline_id: string
          due_at: string
          sent_at?: string
          user_id: string
        }
        Update: {
          deadline_id?: string
          due_at?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_unsubscribes: {
        Row: {
          created_at: string
          email: string
          mail: string
        }
        Insert: {
          created_at?: string
          email: string
          mail: string
        }
        Update: {
          created_at?: string
          email?: string
          mail?: string
        }
        Relationships: []
      }
      elearn_connections: {
        Row: {
          base_url: string
          connection_mode: string
          consecutive_failures: number
          created_at: string
          exposed_functions: string[]
          external_full_name: string | null
          external_user_id: number | null
          last_attempt_at: string | null
          last_manual_sync_at: string | null
          last_success_at: string | null
          next_sync_at: string
          provider: string
          safe_error_code: string | null
          status: Database["public"]["Enums"]["connection_status"]
          token_ciphertext: string
          token_iv: string
          token_key_version: number
          updated_at: string
          user_id: string
        }
        Insert: {
          base_url: string
          connection_mode?: string
          consecutive_failures?: number
          created_at?: string
          exposed_functions?: string[]
          external_full_name?: string | null
          external_user_id?: number | null
          last_attempt_at?: string | null
          last_manual_sync_at?: string | null
          last_success_at?: string | null
          next_sync_at?: string
          provider?: string
          safe_error_code?: string | null
          status?: Database["public"]["Enums"]["connection_status"]
          token_ciphertext: string
          token_iv: string
          token_key_version: number
          updated_at?: string
          user_id: string
        }
        Update: {
          base_url?: string
          connection_mode?: string
          consecutive_failures?: number
          created_at?: string
          exposed_functions?: string[]
          external_full_name?: string | null
          external_user_id?: number | null
          last_attempt_at?: string | null
          last_manual_sync_at?: string | null
          last_success_at?: string | null
          next_sync_at?: string
          provider?: string
          safe_error_code?: string | null
          status?: Database["public"]["Enums"]["connection_status"]
          token_ciphertext?: string
          token_iv?: string
          token_key_version?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      job_events: {
        Row: {
          claimed_at: string
          company: string
          company_key: string
          created_at: string
          id: string
          inbound_id: string
          job_id: string | null
          kind: string
          original_key: string
          payload: Json
          role: string | null
          sent_at: string
          state: string
        }
        Insert: {
          claimed_at?: string
          company: string
          company_key?: string
          created_at?: string
          id?: string
          inbound_id: string
          job_id?: string | null
          kind: string
          original_key: string
          payload?: Json
          role?: string | null
          sent_at: string
          state?: string
        }
        Update: {
          claimed_at?: string
          company?: string
          company_key?: string
          created_at?: string
          id?: string
          inbound_id?: string
          job_id?: string | null
          kind?: string
          original_key?: string
          payload?: Json
          role?: string | null
          sent_at?: string
          state?: string
        }
        Relationships: []
      }
      job_files: {
        Row: {
          created_at: string
          event_id: string | null
          filename: string
          id: string
          job_id: string | null
          mime: string
          sha256: string
          size_bytes: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          filename: string
          id?: string
          job_id?: string | null
          mime: string
          sha256: string
          size_bytes: number
          storage_path: string
        }
        Update: {
          created_at?: string
          event_id?: string | null
          filename?: string
          id?: string
          job_id?: string | null
          mime?: string
          sha256?: string
          size_bytes?: number
          storage_path?: string
        }
        Relationships: []
      }
      job_inbound_messages: {
        Row: {
          attempts: number
          id: string
          original_message_id: string | null
          original_sent_at: string | null
          processed_at: string | null
          provider_email_id: string
          reason: string | null
          received_at: string
          status: string
          subject: string | null
        }
        Insert: {
          attempts?: number
          id?: string
          original_message_id?: string | null
          original_sent_at?: string | null
          processed_at?: string | null
          provider_email_id: string
          reason?: string | null
          received_at?: string
          status?: string
          subject?: string | null
        }
        Update: {
          attempts?: number
          id?: string
          original_message_id?: string | null
          original_sent_at?: string | null
          processed_at?: string | null
          provider_email_id?: string
          reason?: string | null
          received_at?: string
          status?: string
          subject?: string | null
        }
        Relationships: []
      }
      job_reminders: {
        Row: {
          due_at: string
          job_id: string
          offset_hours: number
          sent_at: string
          user_id: string
        }
        Insert: {
          due_at: string
          job_id: string
          offset_hours: number
          sent_at?: string
          user_id: string
        }
        Update: {
          due_at?: string
          job_id?: string
          offset_hours?: number
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      job_stars: {
        Row: {
          created_at: string
          job_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          job_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          job_id?: string
          user_id?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          company: string
          company_key: string
          deadline_at: string | null
          deadline_date: string | null
          deadline_time: string | null
          field_sent_at: Json
          first_seen_at: string
          hidden_at: string | null
          id: string
          jd_file_id: string | null
          last_email_at: string
          portal_id: string | null
          portal_seen_at: string | null
          role: string
          role_aliases: string[]
          role_keys: string[]
          shortlist_date: string | null
          updated_at: string
        }
        Insert: {
          company: string
          company_key: string
          deadline_at?: string | null
          deadline_date?: string | null
          deadline_time?: string | null
          field_sent_at?: Json
          first_seen_at?: string
          hidden_at?: string | null
          id?: string
          jd_file_id?: string | null
          last_email_at?: string
          portal_id?: string | null
          portal_seen_at?: string | null
          role: string
          role_aliases?: string[]
          role_keys?: string[]
          shortlist_date?: string | null
          updated_at?: string
        }
        Update: {
          company?: string
          company_key?: string
          deadline_at?: string | null
          deadline_date?: string | null
          deadline_time?: string | null
          field_sent_at?: Json
          first_seen_at?: string
          hidden_at?: string | null
          id?: string
          jd_file_id?: string | null
          last_email_at?: string
          portal_id?: string | null
          portal_seen_at?: string | null
          role?: string
          role_aliases?: string[]
          role_keys?: string[]
          shortlist_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      portal_check_runs: {
        Row: {
          active_count: number | null
          day: string
          error: string | null
          id: string
          ok: boolean
          ran_at: string
          slot: string
          snapshot: Json | null
        }
        Insert: {
          active_count?: number | null
          day: string
          error?: string | null
          id?: string
          ok: boolean
          ran_at?: string
          slot: string
          snapshot?: Json | null
        }
        Update: {
          active_count?: number | null
          day?: string
          error?: string | null
          id?: string
          ok?: boolean
          ran_at?: string
          slot?: string
          snapshot?: Json | null
        }
        Relationships: []
      }
      portal_job_changes: {
        Row: {
          action: string
          company: string | null
          created_at: string
          id: string
          job_id: string | null
          new_deadline: string | null
          note: string | null
          old_deadline: string | null
          portal_id: string | null
          role: string | null
        }
        Insert: {
          action: string
          company?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          new_deadline?: string | null
          note?: string | null
          old_deadline?: string | null
          portal_id?: string | null
          role?: string | null
        }
        Update: {
          action?: string
          company?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          new_deadline?: string | null
          note?: string | null
          old_deadline?: string | null
          portal_id?: string | null
          role?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          first_opened_at: string | null
          is_admin: boolean
          last_active_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          first_opened_at?: string | null
          is_admin?: boolean
          last_active_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          first_opened_at?: string | null
          is_admin?: boolean
          last_active_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      sync_queue: {
        Row: {
          attempts: number
          created_at: string
          locked_at: string | null
          locked_by: string | null
          priority: number
          run_after: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          locked_at?: string | null
          locked_by?: string | null
          priority?: number
          run_after?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          locked_at?: string | null
          locked_by?: string | null
          priority?: number
          run_after?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sync_runs: {
        Row: {
          created_at: string
          duration_ms: number | null
          finished_at: string | null
          id: string
          item_count: number
          outcome: Database["public"]["Enums"]["sync_outcome"]
          safe_error_code: string | null
          source_status: Json
          started_at: string
          trigger: Database["public"]["Enums"]["sync_trigger"]
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          finished_at?: string | null
          id?: string
          item_count?: number
          outcome?: Database["public"]["Enums"]["sync_outcome"]
          safe_error_code?: string | null
          source_status?: Json
          started_at?: string
          trigger: Database["public"]["Enums"]["sync_trigger"]
          user_id: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          finished_at?: string | null
          id?: string
          item_count?: number
          outcome?: Database["public"]["Enums"]["sync_outcome"]
          safe_error_code?: string | null
          source_status?: Json
          started_at?: string
          trigger?: Database["public"]["Enums"]["sync_trigger"]
          user_id?: string
        }
        Relationships: []
      }
      term5_enrollment_overrides: {
        Row: {
          course_code: string
          removed: boolean
          section_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          course_code: string
          removed?: boolean
          section_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          course_code?: string
          removed?: boolean
          section_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      term5_shared_deadlines: {
        Row: {
          active: boolean
          contributor_section: string
          course_code: string
          deadline_type: string
          due_at: string | null
          first_seen_at: string
          id: string
          kind: string
          last_confirmed_at: string
          section_hint: string | null
          source_key: string
          title: string
        }
        Insert: {
          active?: boolean
          contributor_section: string
          course_code: string
          deadline_type: string
          due_at?: string | null
          first_seen_at?: string
          id?: string
          kind: string
          last_confirmed_at?: string
          section_hint?: string | null
          source_key: string
          title: string
        }
        Update: {
          active?: boolean
          contributor_section?: string
          course_code?: string
          deadline_type?: string
          due_at?: string | null
          first_seen_at?: string
          id?: string
          kind?: string
          last_confirmed_at?: string
          section_hint?: string | null
          source_key?: string
          title?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          class_reminders: boolean
          created_at: string
          deadline_reminders: boolean
          explicit_deadline_marker_only: boolean
          hidden_course_ids: number[]
          job_reminders: boolean
          sort_order: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          class_reminders?: boolean
          created_at?: string
          deadline_reminders?: boolean
          explicit_deadline_marker_only?: boolean
          hidden_course_ids?: number[]
          job_reminders?: boolean
          sort_order?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          class_reminders?: boolean
          created_at?: string
          deadline_reminders?: boolean
          explicit_deadline_marker_only?: boolean
          hidden_course_ids?: number[]
          job_reminders?: boolean
          sort_order?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_sync_queue: {
        Args: { p_batch?: number; p_worker: string }
        Returns: {
          attempts: number
          created_at: string
          locked_at: string | null
          locked_by: string | null
          priority: number
          run_after: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "sync_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      ensure_current_user_bootstrapped: { Args: never; Returns: undefined }
      is_allowed_isb_user: { Args: never; Returns: boolean }
    }
    Enums: {
      connection_status:
        | "connected"
        | "syncing"
        | "partial"
        | "attention"
        | "disconnected"
      sync_outcome: "running" | "success" | "partial" | "failed"
      sync_trigger: "first_connect" | "manual" | "scheduled" | "webhook"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      connection_status: [
        "connected",
        "syncing",
        "partial",
        "attention",
        "disconnected",
      ],
      sync_outcome: ["running", "success", "partial", "failed"],
      sync_trigger: ["first_connect", "manual", "scheduled", "webhook"],
    },
  },
} as const
