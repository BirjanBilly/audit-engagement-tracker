export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type EngagementStatus =
  | "planning"
  | "fieldwork"
  | "review"
  | "complete";

export type Database = {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string;
          name: string;
          country: string | null;
          fiscal_year_end: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          country?: string | null;
          fiscal_year_end?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          country?: string | null;
          fiscal_year_end?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      engagements: {
        Row: {
          id: string;
          client_id: string;
          status: EngagementStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          status?: EngagementStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          status?: EngagementStatus;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "engagements_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      time_entries: {
        Row: {
          id: string;
          engagement_id: string;
          hours: number;
          entry_date: string;
          description: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          engagement_id: string;
          hours: number;
          entry_date: string;
          description?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          engagement_id?: string;
          hours?: number;
          entry_date?: string;
          description?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "time_entries_engagement_id_fkey";
            columns: ["engagement_id"];
            isOneToOne: false;
            referencedRelation: "engagements";
            referencedColumns: ["id"];
          },
        ];
      };
      seed_client_keys: {
        Row: { client_key: string; client_id: string; created_at: string };
        Insert: { client_key: string; client_id: string; created_at?: string };
        Update: { client_key?: string; client_id?: string; created_at?: string };
        Relationships: [];
      };
      seed_import_rows: {
        Row: {
          source_row_hash: string;
          source_file: string;
          raw_row: Json;
          issues: Json;
          outcome: string;
          source_line: number | null;
          client_id: string | null;
          engagement_id: string | null;
          time_entry_id: string | null;
          imported_at: string;
        };
        Insert: {
          source_row_hash: string;
          source_file: string;
          raw_row: Json;
          issues?: Json;
          outcome: string;
          source_line?: number | null;
          client_id?: string | null;
          engagement_id?: string | null;
          time_entry_id?: string | null;
          imported_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["seed_import_rows"]["Insert"]>;
        Relationships: [];
      };
      user_preferences: {
        Row: {
          user_id: string;
          onboarding_complete: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          onboarding_complete?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          onboarding_complete?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      api_keys: {
        Row: {
          id: string;
          name: string;
          key_hash: string;
          key_prefix: string;
          active: boolean;
          created_at: string;
          last_used_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          key_hash: string;
          key_prefix: string;
          active?: boolean;
          created_at?: string;
          last_used_at?: string | null;
        };
        Update: {
          name?: string;
          key_hash?: string;
          key_prefix?: string;
          active?: boolean;
          last_used_at?: string | null;
        };
        Relationships: [];
      };
      api_rate_limit_windows: {
        Row: {
          api_key_id: string;
          window_start: string;
          request_count: number;
        };
        Insert: {
          api_key_id: string;
          window_start: string;
          request_count?: number;
        };
        Update: { request_count?: number };
        Relationships: [];
      };
      api_idempotency_records: {
        Row: {
          api_key_id: string;
          idempotency_key_hash: string;
          request_hash: string;
          response_status: number;
          response_body: Json;
          time_entry_id: string | null;
          created_at: string;
        };
        Insert: {
          api_key_id: string;
          idempotency_key_hash: string;
          request_hash: string;
          response_status: number;
          response_body: Json;
          time_entry_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["api_idempotency_records"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      consume_api_rate_limit: {
        Args: { p_api_key_id: string; p_limit?: number };
        Returns: Array<{
          allowed: boolean;
          remaining: number;
          reset_epoch: number;
          observed_count: number;
        }>;
      };
      list_api_clients: {
        Args: {
          p_limit: number;
          p_country?: string | null;
          p_cursor_created_at?: string | null;
          p_cursor_id?: string | null;
        };
        Returns: Array<Database["public"]["Tables"]["clients"]["Row"]>;
      };
      get_client_summary: {
        Args: { p_client_id: string };
        Returns: Json | null;
      };
      create_time_entry_idempotent: {
        Args: {
          p_api_key_id: string;
          p_idempotency_key_hash: string;
          p_request_hash: string;
          p_engagement_id: string;
          p_hours: number;
          p_entry_date: string;
          p_description: string;
        };
        Returns: Array<{
          outcome: string;
          response_status: number;
          response_body: Json | null;
          replayed: boolean;
        }>;
      };
    };
    Enums: { engagement_status: EngagementStatus };
    CompositeTypes: Record<string, never>;
  };
};
