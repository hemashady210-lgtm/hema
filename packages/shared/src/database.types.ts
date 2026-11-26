// Generated from the Supabase dev project schema by `pnpm db:types:remote`.
// Do not edit by hand; regenerate after every migration.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  public: {
    Tables: {
      ai_model_prices: {
        Row: {
          cache_read_cost_micros_per_mtok: number | null;
          input_cost_micros_per_mtok: number;
          model: string;
          output_cost_micros_per_mtok: number;
          provider: string;
          source_note: string | null;
          updated_at: string;
        };
        Insert: {
          cache_read_cost_micros_per_mtok?: number | null;
          input_cost_micros_per_mtok: number;
          model: string;
          output_cost_micros_per_mtok: number;
          provider?: string;
          source_note?: string | null;
          updated_at?: string;
        };
        Update: {
          cache_read_cost_micros_per_mtok?: number | null;
          input_cost_micros_per_mtok?: number;
          model?: string;
          output_cost_micros_per_mtok?: number;
          provider?: string;
          source_note?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_model_profiles: {
        Row: {
          classifier_model: string | null;
          code: string;
          created_at: string;
          effort: string;
          escalation_config: Json;
          escalation_model: string | null;
          generation_model: string;
          id: string;
          is_active: boolean;
          max_output_tokens: number;
          provider: string;
          refusal_fallback: string;
          updated_at: string;
        };
        Insert: {
          classifier_model?: string | null;
          code: string;
          created_at?: string;
          effort?: string;
          escalation_config?: Json;
          escalation_model?: string | null;
          generation_model: string;
          id?: string;
          is_active?: boolean;
          max_output_tokens?: number;
          provider?: string;
          refusal_fallback?: string;
          updated_at?: string;
        };
        Update: {
          classifier_model?: string | null;
          code?: string;
          created_at?: string;
          effort?: string;
          escalation_config?: Json;
          escalation_model?: string | null;
          generation_model?: string;
          id?: string;
          is_active?: boolean;
          max_output_tokens?: number;
          provider?: string;
          refusal_fallback?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_runs: {
        Row: {
          billed: boolean;
          bot_id: string | null;
          cache_read_tokens: number | null;
          cache_write_tokens: number | null;
          conversation_id: string | null;
          cost_micros: number | null;
          created_at: string;
          detected_language: string | null;
          error_code: string | null;
          error_message: string | null;
          escalated: boolean;
          escalation_reason: string | null;
          finished_at: string | null;
          id: string;
          initial_model: string | null;
          input_tokens: number | null;
          is_test: boolean;
          job_id: number | null;
          latency_ms: number | null;
          model: string;
          output_tokens: number | null;
          provider: string;
          reply_message_id: string | null;
          retrieved_chunk_ids: string[];
          routing_confidence: number | null;
          served_model: string | null;
          status: Database['public']['Enums']['ai_run_status'];
          stop_reason: string | null;
          tool_calls: Json;
          trigger_message_id: string | null;
          workspace_id: string;
        };
        Insert: {
          billed?: boolean;
          bot_id?: string | null;
          cache_read_tokens?: number | null;
          cache_write_tokens?: number | null;
          conversation_id?: string | null;
          cost_micros?: number | null;
          created_at?: string;
          detected_language?: string | null;
          error_code?: string | null;
          error_message?: string | null;
          escalated?: boolean;
          escalation_reason?: string | null;
          finished_at?: string | null;
          id?: string;
          initial_model?: string | null;
          input_tokens?: number | null;
          is_test?: boolean;
          job_id?: number | null;
          latency_ms?: number | null;
          model: string;
          output_tokens?: number | null;
          provider: string;
          reply_message_id?: string | null;
          retrieved_chunk_ids?: string[];
          routing_confidence?: number | null;
          served_model?: string | null;
          status?: Database['public']['Enums']['ai_run_status'];
          stop_reason?: string | null;
          tool_calls?: Json;
          trigger_message_id?: string | null;
          workspace_id: string;
        };
        Update: {
          billed?: boolean;
          bot_id?: string | null;
          cache_read_tokens?: number | null;
          cache_write_tokens?: number | null;
          conversation_id?: string | null;
          cost_micros?: number | null;
          created_at?: string;
          detected_language?: string | null;
          error_code?: string | null;
          error_message?: string | null;
          escalated?: boolean;
          escalation_reason?: string | null;
          finished_at?: string | null;
          id?: string;
          initial_model?: string | null;
          input_tokens?: number | null;
          is_test?: boolean;
          job_id?: number | null;
          latency_ms?: number | null;
          model?: string;
          output_tokens?: number | null;
          provider?: string;
          reply_message_id?: string | null;
          retrieved_chunk_ids?: string[];
          routing_confidence?: number | null;
          served_model?: string | null;
          status?: Database['public']['Enums']['ai_run_status'];
          stop_reason?: string | null;
          tool_calls?: Json;
          trigger_message_id?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_runs_workspace_id_bot_id_fkey';
            columns: ['workspace_id', 'bot_id'];
            isOneToOne: false;
            referencedRelation: 'bots';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'ai_runs_workspace_id_conversation_id_fkey';
            columns: ['workspace_id', 'conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'ai_runs_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_runs_workspace_id_reply_message_id_fkey';
            columns: ['workspace_id', 'reply_message_id'];
            isOneToOne: false;
            referencedRelation: 'messages';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'ai_runs_workspace_id_trigger_message_id_fkey';
            columns: ['workspace_id', 'trigger_message_id'];
            isOneToOne: false;
            referencedRelation: 'messages';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      analytics_daily: {
        Row: {
          ai_replies: number;
          avg_response_ms: number | null;
          category_counts: Json;
          computed_at: string;
          conversations: number;
          date: string;
          handoffs: number;
          knowledge_gaps: number;
          messages_in: number;
          messages_out: number;
          orders: number;
          reservations: number;
          response_samples: number;
          unique_customers: number;
          workspace_id: string;
        };
        Insert: {
          ai_replies?: number;
          avg_response_ms?: number | null;
          category_counts?: Json;
          computed_at?: string;
          conversations?: number;
          date: string;
          handoffs?: number;
          knowledge_gaps?: number;
          messages_in?: number;
          messages_out?: number;
          orders?: number;
          reservations?: number;
          response_samples?: number;
          unique_customers?: number;
          workspace_id: string;
        };
        Update: {
          ai_replies?: number;
          avg_response_ms?: number | null;
          category_counts?: Json;
          computed_at?: string;
          conversations?: number;
          date?: string;
          handoffs?: number;
          knowledge_gaps?: number;
          messages_in?: number;
          messages_out?: number;
          orders?: number;
          reservations?: number;
          response_samples?: number;
          unique_customers?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'analytics_daily_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      analytics_events: {
        Row: {
          bot_id: string | null;
          channel_id: string | null;
          conversation_id: string | null;
          customer_id: string | null;
          event_type: string;
          id: string;
          occurred_at: string;
          properties: Json;
          workspace_id: string;
        };
        Insert: {
          bot_id?: string | null;
          channel_id?: string | null;
          conversation_id?: string | null;
          customer_id?: string | null;
          event_type: string;
          id?: string;
          occurred_at?: string;
          properties?: Json;
          workspace_id: string;
        };
        Update: {
          bot_id?: string | null;
          channel_id?: string | null;
          conversation_id?: string | null;
          customer_id?: string | null;
          event_type?: string;
          id?: string;
          occurred_at?: string;
          properties?: Json;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'analytics_events_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      api_keys: {
        Row: {
          created_at: string;
          created_by: string | null;
          expires_at: string | null;
          id: string;
          key_hash: string;
          key_prefix: string;
          last_used_at: string | null;
          name: string;
          revoked_at: string | null;
          scopes: string[];
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          id?: string;
          key_hash: string;
          key_prefix: string;
          last_used_at?: string | null;
          name: string;
          revoked_at?: string | null;
          scopes?: string[];
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          id?: string;
          key_hash?: string;
          key_prefix?: string;
          last_used_at?: string | null;
          name?: string;
          revoked_at?: string | null;
          scopes?: string[];
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'api_keys_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          actor_type: Database['public']['Enums']['actor_type'];
          changes: Json;
          created_at: string;
          entity_id: string | null;
          entity_type: string | null;
          id: number;
          ip_address: unknown;
          user_agent: string | null;
          workspace_id: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          actor_type: Database['public']['Enums']['actor_type'];
          changes?: Json;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: never;
          ip_address?: unknown;
          user_agent?: string | null;
          workspace_id?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          actor_type?: Database['public']['Enums']['actor_type'];
          changes?: Json;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: never;
          ip_address?: unknown;
          user_agent?: string | null;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_logs_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      billing_customers: {
        Row: {
          created_at: string;
          email: string | null;
          provider: Database['public']['Enums']['payment_provider'];
          provider_customer_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          provider: Database['public']['Enums']['payment_provider'];
          provider_customer_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          provider?: Database['public']['Enums']['payment_provider'];
          provider_customer_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'billing_customers_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      billing_events: {
        Row: {
          actor_id: string | null;
          actor_type: Database['public']['Enums']['actor_type'];
          created_at: string;
          data: Json;
          event_type: string;
          from_status: Database['public']['Enums']['subscription_status'] | null;
          id: number;
          payment_transaction_id: string | null;
          source: string;
          subscription_id: string | null;
          to_status: Database['public']['Enums']['subscription_status'] | null;
          webhook_event_id: number | null;
          workspace_id: string;
        };
        Insert: {
          actor_id?: string | null;
          actor_type: Database['public']['Enums']['actor_type'];
          created_at?: string;
          data?: Json;
          event_type: string;
          from_status?: Database['public']['Enums']['subscription_status'] | null;
          id?: never;
          payment_transaction_id?: string | null;
          source: string;
          subscription_id?: string | null;
          to_status?: Database['public']['Enums']['subscription_status'] | null;
          webhook_event_id?: number | null;
          workspace_id: string;
        };
        Update: {
          actor_id?: string | null;
          actor_type?: Database['public']['Enums']['actor_type'];
          created_at?: string;
          data?: Json;
          event_type?: string;
          from_status?: Database['public']['Enums']['subscription_status'] | null;
          id?: never;
          payment_transaction_id?: string | null;
          source?: string;
          subscription_id?: string | null;
          to_status?: Database['public']['Enums']['subscription_status'] | null;
          webhook_event_id?: number | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'billing_events_webhook_fk';
            columns: ['webhook_event_id'];
            isOneToOne: false;
            referencedRelation: 'webhook_events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'billing_events_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'billing_events_workspace_id_payment_transaction_id_fkey';
            columns: ['workspace_id', 'payment_transaction_id'];
            isOneToOne: false;
            referencedRelation: 'payment_transactions';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'billing_events_workspace_id_subscription_id_fkey';
            columns: ['workspace_id', 'subscription_id'];
            isOneToOne: false;
            referencedRelation: 'subscriptions';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      bot_configs: {
        Row: {
          bot_id: string;
          change_note: string | null;
          created_at: string;
          created_by: string | null;
          custom_instructions: string | null;
          fallback_message: Json;
          greeting: Json | null;
          handoff_message: Json | null;
          handoff_rules: Json;
          id: string;
          max_output_tokens: number;
          persona: string | null;
          temperature: number;
          tone: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          bot_id: string;
          change_note?: string | null;
          created_at?: string;
          created_by?: string | null;
          custom_instructions?: string | null;
          fallback_message?: Json;
          greeting?: Json | null;
          handoff_message?: Json | null;
          handoff_rules?: Json;
          id?: string;
          max_output_tokens?: number;
          persona?: string | null;
          temperature?: number;
          tone?: string;
          version: number;
          workspace_id: string;
        };
        Update: {
          bot_id?: string;
          change_note?: string | null;
          created_at?: string;
          created_by?: string | null;
          custom_instructions?: string | null;
          fallback_message?: Json;
          greeting?: Json | null;
          handoff_message?: Json | null;
          handoff_rules?: Json;
          id?: string;
          max_output_tokens?: number;
          persona?: string | null;
          temperature?: number;
          tone?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'bot_configs_workspace_id_bot_id_fkey';
            columns: ['workspace_id', 'bot_id'];
            isOneToOne: false;
            referencedRelation: 'bots';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      bot_test_cases: {
        Row: {
          bot_id: string;
          category: string | null;
          created_at: string;
          created_by: string | null;
          expected_facts: Json;
          id: string;
          is_active: boolean;
          language: string;
          question: string;
          source: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          bot_id: string;
          category?: string | null;
          created_at?: string;
          created_by?: string | null;
          expected_facts?: Json;
          id?: string;
          is_active?: boolean;
          language?: string;
          question: string;
          source?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          bot_id?: string;
          category?: string | null;
          created_at?: string;
          created_by?: string | null;
          expected_facts?: Json;
          id?: string;
          is_active?: boolean;
          language?: string;
          question?: string;
          source?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'bot_test_cases_workspace_id_bot_id_fkey';
            columns: ['workspace_id', 'bot_id'];
            isOneToOne: false;
            referencedRelation: 'bots';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      bot_test_results: {
        Row: {
          actual_answer: string | null;
          ai_run_id: string | null;
          bot_test_id: string;
          created_at: string;
          expected_facts: Json;
          fact_check: Json;
          id: string;
          latency_ms: number | null;
          passed: boolean;
          question: string;
          score: number | null;
          test_case_id: string | null;
          workspace_id: string;
        };
        Insert: {
          actual_answer?: string | null;
          ai_run_id?: string | null;
          bot_test_id: string;
          created_at?: string;
          expected_facts?: Json;
          fact_check?: Json;
          id?: string;
          latency_ms?: number | null;
          passed: boolean;
          question: string;
          score?: number | null;
          test_case_id?: string | null;
          workspace_id: string;
        };
        Update: {
          actual_answer?: string | null;
          ai_run_id?: string | null;
          bot_test_id?: string;
          created_at?: string;
          expected_facts?: Json;
          fact_check?: Json;
          id?: string;
          latency_ms?: number | null;
          passed?: boolean;
          question?: string;
          score?: number | null;
          test_case_id?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'bot_test_results_workspace_id_ai_run_id_fkey';
            columns: ['workspace_id', 'ai_run_id'];
            isOneToOne: false;
            referencedRelation: 'ai_runs';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'bot_test_results_workspace_id_bot_test_id_fkey';
            columns: ['workspace_id', 'bot_test_id'];
            isOneToOne: false;
            referencedRelation: 'bot_tests';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'bot_test_results_workspace_id_test_case_id_fkey';
            columns: ['workspace_id', 'test_case_id'];
            isOneToOne: false;
            referencedRelation: 'bot_test_cases';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      bot_tests: {
        Row: {
          bot_config_id: string | null;
          bot_id: string;
          created_at: string;
          created_by: string | null;
          error: string | null;
          fallback_verified: boolean | null;
          finished_at: string | null;
          hallucination_detected: boolean;
          id: string;
          pass_rate: number | null;
          passed_cases: number;
          score: number | null;
          started_at: string | null;
          status: string;
          total_cases: number;
          workspace_id: string;
        };
        Insert: {
          bot_config_id?: string | null;
          bot_id: string;
          created_at?: string;
          created_by?: string | null;
          error?: string | null;
          fallback_verified?: boolean | null;
          finished_at?: string | null;
          hallucination_detected?: boolean;
          id?: string;
          pass_rate?: number | null;
          passed_cases?: number;
          score?: number | null;
          started_at?: string | null;
          status?: string;
          total_cases?: number;
          workspace_id: string;
        };
        Update: {
          bot_config_id?: string | null;
          bot_id?: string;
          created_at?: string;
          created_by?: string | null;
          error?: string | null;
          fallback_verified?: boolean | null;
          finished_at?: string | null;
          hallucination_detected?: boolean;
          id?: string;
          pass_rate?: number | null;
          passed_cases?: number;
          score?: number | null;
          started_at?: string | null;
          status?: string;
          total_cases?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'bot_tests_bot_id_bot_config_id_fkey';
            columns: ['bot_id', 'bot_config_id'];
            isOneToOne: false;
            referencedRelation: 'bot_configs';
            referencedColumns: ['bot_id', 'id'];
          },
          {
            foreignKeyName: 'bot_tests_workspace_id_bot_id_fkey';
            columns: ['workspace_id', 'bot_id'];
            isOneToOne: false;
            referencedRelation: 'bots';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      bots: {
        Row: {
          active_config_id: string | null;
          avatar_path: string | null;
          branch_id: string | null;
          created_at: string;
          default_language: string;
          handoff_enabled: boolean;
          id: string;
          language_mode: string;
          name: string;
          orders_enabled: boolean;
          public_key: string;
          readiness_score: number;
          reservations_enabled: boolean;
          status: Database['public']['Enums']['bot_status'];
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          active_config_id?: string | null;
          avatar_path?: string | null;
          branch_id?: string | null;
          created_at?: string;
          default_language?: string;
          handoff_enabled?: boolean;
          id?: string;
          language_mode?: string;
          name: string;
          orders_enabled?: boolean;
          public_key?: string;
          readiness_score?: number;
          reservations_enabled?: boolean;
          status?: Database['public']['Enums']['bot_status'];
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          active_config_id?: string | null;
          avatar_path?: string | null;
          branch_id?: string | null;
          created_at?: string;
          default_language?: string;
          handoff_enabled?: boolean;
          id?: string;
          language_mode?: string;
          name?: string;
          orders_enabled?: boolean;
          public_key?: string;
          readiness_score?: number;
          reservations_enabled?: boolean;
          status?: Database['public']['Enums']['bot_status'];
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'bots_active_config_fk';
            columns: ['id', 'active_config_id'];
            isOneToOne: false;
            referencedRelation: 'bot_configs';
            referencedColumns: ['bot_id', 'id'];
          },
          {
            foreignKeyName: 'bots_workspace_id_branch_id_fkey';
            columns: ['workspace_id', 'branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'bots_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      branches: {
        Row: {
          address: Json | null;
          created_at: string;
          id: string;
          is_active: boolean;
          name: Json;
          phone: string | null;
          timezone: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          address?: Json | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: Json;
          phone?: string | null;
          timezone?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          address?: Json | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: Json;
          phone?: string | null;
          timezone?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'branches_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      business_profiles: {
        Row: {
          address: Json | null;
          branch_id: string | null;
          created_at: string;
          custom_ai_instructions: string | null;
          description: Json | null;
          display_name: Json;
          email: string | null;
          extra: Json;
          id: string;
          phone: string | null;
          social_links: Json;
          tone: string;
          updated_at: string;
          website: string | null;
          workspace_id: string;
        };
        Insert: {
          address?: Json | null;
          branch_id?: string | null;
          created_at?: string;
          custom_ai_instructions?: string | null;
          description?: Json | null;
          display_name: Json;
          email?: string | null;
          extra?: Json;
          id?: string;
          phone?: string | null;
          social_links?: Json;
          tone?: string;
          updated_at?: string;
          website?: string | null;
          workspace_id: string;
        };
        Update: {
          address?: Json | null;
          branch_id?: string | null;
          created_at?: string;
          custom_ai_instructions?: string | null;
          description?: Json | null;
          display_name?: Json;
          email?: string | null;
          extra?: Json;
          id?: string;
          phone?: string | null;
          social_links?: Json;
          tone?: string;
          updated_at?: string;
          website?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'business_profiles_workspace_id_branch_id_fkey';
            columns: ['workspace_id', 'branch_id'];
            isOneToOne: true;
            referencedRelation: 'branches';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'business_profiles_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      catalog_categories: {
        Row: {
          branch_id: string | null;
          created_at: string;
          id: string;
          is_active: boolean;
          name: Json;
          sort_order: number;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: Json;
          sort_order?: number;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: Json;
          sort_order?: number;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'catalog_categories_workspace_id_branch_id_fkey';
            columns: ['workspace_id', 'branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'catalog_categories_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      catalog_items: {
        Row: {
          attributes: Json;
          branch_id: string | null;
          category_id: string | null;
          created_at: string;
          currency: string;
          description: Json | null;
          id: string;
          image_path: string | null;
          is_available: boolean;
          name: Json;
          options: Json;
          price_cents: number;
          sku: string | null;
          sort_order: number;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          attributes?: Json;
          branch_id?: string | null;
          category_id?: string | null;
          created_at?: string;
          currency?: string;
          description?: Json | null;
          id?: string;
          image_path?: string | null;
          is_available?: boolean;
          name: Json;
          options?: Json;
          price_cents: number;
          sku?: string | null;
          sort_order?: number;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          attributes?: Json;
          branch_id?: string | null;
          category_id?: string | null;
          created_at?: string;
          currency?: string;
          description?: Json | null;
          id?: string;
          image_path?: string | null;
          is_available?: boolean;
          name?: Json;
          options?: Json;
          price_cents?: number;
          sku?: string | null;
          sort_order?: number;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'catalog_items_workspace_id_branch_id_fkey';
            columns: ['workspace_id', 'branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'catalog_items_workspace_id_category_id_fkey';
            columns: ['workspace_id', 'category_id'];
            isOneToOne: false;
            referencedRelation: 'catalog_categories';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'catalog_items_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      channel_connection_events: {
        Row: {
          actor_id: string | null;
          actor_type: Database['public']['Enums']['actor_type'];
          channel_id: string | null;
          created_at: string;
          from_status: string | null;
          id: number;
          is_internal: boolean;
          note: string | null;
          request_id: string | null;
          to_status: string;
          workspace_id: string;
        };
        Insert: {
          actor_id?: string | null;
          actor_type: Database['public']['Enums']['actor_type'];
          channel_id?: string | null;
          created_at?: string;
          from_status?: string | null;
          id?: never;
          is_internal?: boolean;
          note?: string | null;
          request_id?: string | null;
          to_status: string;
          workspace_id: string;
        };
        Update: {
          actor_id?: string | null;
          actor_type?: Database['public']['Enums']['actor_type'];
          channel_id?: string | null;
          created_at?: string;
          from_status?: string | null;
          id?: never;
          is_internal?: boolean;
          note?: string | null;
          request_id?: string | null;
          to_status?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'channel_connection_events_workspace_id_channel_id_fkey';
            columns: ['workspace_id', 'channel_id'];
            isOneToOne: false;
            referencedRelation: 'channels';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'channel_connection_events_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'channel_connection_events_workspace_id_request_id_fkey';
            columns: ['workspace_id', 'request_id'];
            isOneToOne: false;
            referencedRelation: 'channel_connection_requests';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      channel_connection_requests: {
        Row: {
          assigned_admin_id: string | null;
          bot_id: string;
          business_name: string;
          channel_id: string | null;
          channel_type: Database['public']['Enums']['channel_type'];
          contact_email: string;
          contact_name: string;
          contact_phone: string | null;
          created_at: string;
          customer_notes: string | null;
          fee_status: string;
          fee_transaction_id: string | null;
          id: string;
          requested_by: string;
          resolved_at: string | null;
          status: Database['public']['Enums']['connection_request_status'];
          submitted_data: Json;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          assigned_admin_id?: string | null;
          bot_id: string;
          business_name: string;
          channel_id?: string | null;
          channel_type: Database['public']['Enums']['channel_type'];
          contact_email: string;
          contact_name: string;
          contact_phone?: string | null;
          created_at?: string;
          customer_notes?: string | null;
          fee_status?: string;
          fee_transaction_id?: string | null;
          id?: string;
          requested_by: string;
          resolved_at?: string | null;
          status?: Database['public']['Enums']['connection_request_status'];
          submitted_data?: Json;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          assigned_admin_id?: string | null;
          bot_id?: string;
          business_name?: string;
          channel_id?: string | null;
          channel_type?: Database['public']['Enums']['channel_type'];
          contact_email?: string;
          contact_name?: string;
          contact_phone?: string | null;
          created_at?: string;
          customer_notes?: string | null;
          fee_status?: string;
          fee_transaction_id?: string | null;
          id?: string;
          requested_by?: string;
          resolved_at?: string | null;
          status?: Database['public']['Enums']['connection_request_status'];
          submitted_data?: Json;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ccr_fee_transaction_fk';
            columns: ['workspace_id', 'fee_transaction_id'];
            isOneToOne: false;
            referencedRelation: 'payment_transactions';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'channel_connection_requests_workspace_id_bot_id_fkey';
            columns: ['workspace_id', 'bot_id'];
            isOneToOne: false;
            referencedRelation: 'bots';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'channel_connection_requests_workspace_id_channel_id_fkey';
            columns: ['workspace_id', 'channel_id'];
            isOneToOne: false;
            referencedRelation: 'channels';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'channel_connection_requests_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      channel_credentials: {
        Row: {
          channel_id: string;
          created_at: string;
          created_by: string | null;
          expires_at: string | null;
          id: string;
          last_rotated_at: string | null;
          scopes: string[];
          updated_at: string;
          vault_secret_id: string;
          workspace_id: string;
        };
        Insert: {
          channel_id: string;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          id?: string;
          last_rotated_at?: string | null;
          scopes?: string[];
          updated_at?: string;
          vault_secret_id: string;
          workspace_id: string;
        };
        Update: {
          channel_id?: string;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          id?: string;
          last_rotated_at?: string | null;
          scopes?: string[];
          updated_at?: string;
          vault_secret_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'channel_credentials_workspace_id_channel_id_fkey';
            columns: ['workspace_id', 'channel_id'];
            isOneToOne: false;
            referencedRelation: 'channels';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'channel_credentials_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      channels: {
        Row: {
          bot_id: string;
          channel_type: Database['public']['Enums']['channel_type'];
          config: Json;
          connected_at: string | null;
          connected_by: string | null;
          connection_mode: Database['public']['Enums']['connection_mode'];
          created_at: string;
          disconnected_at: string | null;
          display_name: string | null;
          external_account_id: string | null;
          external_ids: Json;
          health_status: Database['public']['Enums']['health_status'];
          id: string;
          last_error: string | null;
          last_error_at: string | null;
          last_health_check_at: string | null;
          last_health_check_error: string | null;
          last_inbound_at: string | null;
          last_outbound_at: string | null;
          phone_number_display: string | null;
          status: Database['public']['Enums']['channel_status'];
          updated_at: string;
          webhook_subscribed_at: string | null;
          workspace_id: string;
        };
        Insert: {
          bot_id: string;
          channel_type: Database['public']['Enums']['channel_type'];
          config?: Json;
          connected_at?: string | null;
          connected_by?: string | null;
          connection_mode: Database['public']['Enums']['connection_mode'];
          created_at?: string;
          disconnected_at?: string | null;
          display_name?: string | null;
          external_account_id?: string | null;
          external_ids?: Json;
          health_status?: Database['public']['Enums']['health_status'];
          id?: string;
          last_error?: string | null;
          last_error_at?: string | null;
          last_health_check_at?: string | null;
          last_health_check_error?: string | null;
          last_inbound_at?: string | null;
          last_outbound_at?: string | null;
          phone_number_display?: string | null;
          status?: Database['public']['Enums']['channel_status'];
          updated_at?: string;
          webhook_subscribed_at?: string | null;
          workspace_id: string;
        };
        Update: {
          bot_id?: string;
          channel_type?: Database['public']['Enums']['channel_type'];
          config?: Json;
          connected_at?: string | null;
          connected_by?: string | null;
          connection_mode?: Database['public']['Enums']['connection_mode'];
          created_at?: string;
          disconnected_at?: string | null;
          display_name?: string | null;
          external_account_id?: string | null;
          external_ids?: Json;
          health_status?: Database['public']['Enums']['health_status'];
          id?: string;
          last_error?: string | null;
          last_error_at?: string | null;
          last_health_check_at?: string | null;
          last_health_check_error?: string | null;
          last_inbound_at?: string | null;
          last_outbound_at?: string | null;
          phone_number_display?: string | null;
          status?: Database['public']['Enums']['channel_status'];
          updated_at?: string;
          webhook_subscribed_at?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'channels_workspace_id_bot_id_fkey';
            columns: ['workspace_id', 'bot_id'];
            isOneToOne: false;
            referencedRelation: 'bots';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'channels_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      conversation_notes: {
        Row: {
          author_id: string;
          body: string;
          conversation_id: string;
          created_at: string;
          id: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          author_id: string;
          body: string;
          conversation_id: string;
          created_at?: string;
          id?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'conversation_notes_workspace_id_conversation_id_fkey';
            columns: ['workspace_id', 'conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      conversations: {
        Row: {
          assigned_to: string | null;
          bot_id: string;
          branch_id: string | null;
          channel_id: string | null;
          closed_at: string | null;
          created_at: string;
          customer_id: string | null;
          dialect: string | null;
          handler: Database['public']['Enums']['conversation_handler'];
          id: string;
          is_test: boolean;
          language: string | null;
          last_inbound_at: string | null;
          last_message_at: string | null;
          last_message_preview: string | null;
          realtime_topic: string;
          service_window_ends_at: string | null;
          status: Database['public']['Enums']['conversation_status'];
          summary: string | null;
          summary_message_id: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          assigned_to?: string | null;
          bot_id: string;
          branch_id?: string | null;
          channel_id?: string | null;
          closed_at?: string | null;
          created_at?: string;
          customer_id?: string | null;
          dialect?: string | null;
          handler?: Database['public']['Enums']['conversation_handler'];
          id?: string;
          is_test?: boolean;
          language?: string | null;
          last_inbound_at?: string | null;
          last_message_at?: string | null;
          last_message_preview?: string | null;
          realtime_topic?: string;
          service_window_ends_at?: string | null;
          status?: Database['public']['Enums']['conversation_status'];
          summary?: string | null;
          summary_message_id?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          assigned_to?: string | null;
          bot_id?: string;
          branch_id?: string | null;
          channel_id?: string | null;
          closed_at?: string | null;
          created_at?: string;
          customer_id?: string | null;
          dialect?: string | null;
          handler?: Database['public']['Enums']['conversation_handler'];
          id?: string;
          is_test?: boolean;
          language?: string | null;
          last_inbound_at?: string | null;
          last_message_at?: string | null;
          last_message_preview?: string | null;
          realtime_topic?: string;
          service_window_ends_at?: string | null;
          status?: Database['public']['Enums']['conversation_status'];
          summary?: string | null;
          summary_message_id?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'conversations_workspace_id_bot_id_fkey';
            columns: ['workspace_id', 'bot_id'];
            isOneToOne: false;
            referencedRelation: 'bots';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'conversations_workspace_id_branch_id_fkey';
            columns: ['workspace_id', 'branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'conversations_workspace_id_channel_id_fkey';
            columns: ['workspace_id', 'channel_id'];
            isOneToOne: false;
            referencedRelation: 'channels';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'conversations_workspace_id_customer_id_fkey';
            columns: ['workspace_id', 'customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'conversations_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      customer_identities: {
        Row: {
          channel_type: Database['public']['Enums']['channel_type'];
          created_at: string;
          customer_id: string;
          external_user_id: string;
          id: string;
          workspace_id: string;
        };
        Insert: {
          channel_type: Database['public']['Enums']['channel_type'];
          created_at?: string;
          customer_id: string;
          external_user_id: string;
          id?: string;
          workspace_id: string;
        };
        Update: {
          channel_type?: Database['public']['Enums']['channel_type'];
          created_at?: string;
          customer_id?: string;
          external_user_id?: string;
          id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'customer_identities_workspace_id_customer_id_fkey';
            columns: ['workspace_id', 'customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      customer_notes: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          customer_id: string;
          id: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          author_id: string;
          body: string;
          created_at?: string;
          customer_id: string;
          id?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          customer_id?: string;
          id?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'customer_notes_workspace_id_customer_id_fkey';
            columns: ['workspace_id', 'customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      customers: {
        Row: {
          attributes: Json;
          created_at: string;
          display_name: string | null;
          email: string | null;
          first_seen_at: string;
          id: string;
          last_seen_at: string;
          locale: string | null;
          phone: string | null;
          tags: string[];
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          attributes?: Json;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          first_seen_at?: string;
          id?: string;
          last_seen_at?: string;
          locale?: string | null;
          phone?: string | null;
          tags?: string[];
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          attributes?: Json;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          first_seen_at?: string;
          id?: string;
          last_seen_at?: string;
          locale?: string | null;
          phone?: string | null;
          tags?: string[];
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'customers_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      data_requests: {
        Row: {
          completed_at: string | null;
          created_at: string;
          error: string | null;
          expires_at: string | null;
          export_path: string | null;
          id: string;
          kind: string;
          requested_by: string;
          scheduled_for: string | null;
          status: Database['public']['Enums']['processing_status'];
          workspace_id: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          error?: string | null;
          expires_at?: string | null;
          export_path?: string | null;
          id?: string;
          kind: string;
          requested_by: string;
          scheduled_for?: string | null;
          status?: Database['public']['Enums']['processing_status'];
          workspace_id: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          error?: string | null;
          expires_at?: string | null;
          export_path?: string | null;
          id?: string;
          kind?: string;
          requested_by?: string;
          scheduled_for?: string | null;
          status?: Database['public']['Enums']['processing_status'];
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'data_requests_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      entitlement_definitions: {
        Row: {
          default_value: Json;
          description: string;
          key: string;
          value_type: string;
        };
        Insert: {
          default_value: Json;
          description: string;
          key: string;
          value_type: string;
        };
        Update: {
          default_value?: Json;
          description?: string;
          key?: string;
          value_type?: string;
        };
        Relationships: [];
      };
      faqs: {
        Row: {
          alt_questions: string[];
          answer: string;
          created_at: string;
          id: string;
          is_active: boolean;
          language: string;
          question: string;
          sort_order: number;
          source_id: string;
          tags: string[];
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          alt_questions?: string[];
          answer: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          language?: string;
          question: string;
          sort_order?: number;
          source_id: string;
          tags?: string[];
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          alt_questions?: string[];
          answer?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          language?: string;
          question?: string;
          sort_order?: number;
          source_id?: string;
          tags?: string[];
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'faqs_workspace_id_source_id_fkey';
            columns: ['workspace_id', 'source_id'];
            isOneToOne: false;
            referencedRelation: 'kb_sources';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      feature_flags: {
        Row: {
          created_at: string;
          description: string | null;
          enabled: boolean;
          id: string;
          key: string;
          scope: Database['public']['Enums']['feature_flag_scope'];
          updated_at: string;
          updated_by: string | null;
          workspace_id: string | null;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          enabled?: boolean;
          id?: string;
          key: string;
          scope: Database['public']['Enums']['feature_flag_scope'];
          updated_at?: string;
          updated_by?: string | null;
          workspace_id?: string | null;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          enabled?: boolean;
          id?: string;
          key?: string;
          scope?: Database['public']['Enums']['feature_flag_scope'];
          updated_at?: string;
          updated_by?: string | null;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'feature_flags_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      handoffs: {
        Row: {
          assigned_to: string | null;
          conversation_id: string;
          created_at: string;
          id: string;
          reason: string | null;
          requested_by: Database['public']['Enums']['message_sender'];
          resolved_at: string | null;
          resolved_by: string | null;
          status: Database['public']['Enums']['handoff_status'];
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          assigned_to?: string | null;
          conversation_id: string;
          created_at?: string;
          id?: string;
          reason?: string | null;
          requested_by: Database['public']['Enums']['message_sender'];
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database['public']['Enums']['handoff_status'];
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          assigned_to?: string | null;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          reason?: string | null;
          requested_by?: Database['public']['Enums']['message_sender'];
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database['public']['Enums']['handoff_status'];
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'handoffs_workspace_id_conversation_id_fkey';
            columns: ['workspace_id', 'conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      internal_notes: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          entity_id: string;
          entity_type: string;
          id: number;
          workspace_id: string | null;
        };
        Insert: {
          author_id: string;
          body: string;
          created_at?: string;
          entity_id: string;
          entity_type: string;
          id?: never;
          workspace_id?: string | null;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          entity_id?: string;
          entity_type?: string;
          id?: never;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'internal_notes_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      invoices_records: {
        Row: {
          amount_cents: number;
          created_at: string;
          created_by: string | null;
          currency: string;
          description: string | null;
          due_at: string | null;
          id: string;
          issued_at: string | null;
          kind: string;
          paid_at: string | null;
          payment_transaction_id: string | null;
          period_end: string | null;
          period_start: string | null;
          status: Database['public']['Enums']['invoice_status'];
          units: number | null;
          updated_at: string;
          usage_period_id: string | null;
          workspace_id: string;
        };
        Insert: {
          amount_cents: number;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          description?: string | null;
          due_at?: string | null;
          id?: string;
          issued_at?: string | null;
          kind?: string;
          paid_at?: string | null;
          payment_transaction_id?: string | null;
          period_end?: string | null;
          period_start?: string | null;
          status?: Database['public']['Enums']['invoice_status'];
          units?: number | null;
          updated_at?: string;
          usage_period_id?: string | null;
          workspace_id: string;
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          description?: string | null;
          due_at?: string | null;
          id?: string;
          issued_at?: string | null;
          kind?: string;
          paid_at?: string | null;
          payment_transaction_id?: string | null;
          period_end?: string | null;
          period_start?: string | null;
          status?: Database['public']['Enums']['invoice_status'];
          units?: number | null;
          updated_at?: string;
          usage_period_id?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'invoices_records_usage_period_fk';
            columns: ['workspace_id', 'usage_period_id'];
            isOneToOne: false;
            referencedRelation: 'usage_periods';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'invoices_records_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoices_records_workspace_id_payment_transaction_id_fkey';
            columns: ['workspace_id', 'payment_transaction_id'];
            isOneToOne: false;
            referencedRelation: 'payment_transactions';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      jobs: {
        Row: {
          attempts: number;
          created_at: string;
          finished_at: string | null;
          id: number;
          idempotency_key: string | null;
          last_error: string | null;
          lock_expires_at: string | null;
          locked_at: string | null;
          locked_by: string | null;
          max_attempts: number;
          payload: Json;
          priority: number;
          queue: string;
          retry_count: number;
          run_at: string;
          status: Database['public']['Enums']['job_status'];
          type: string;
          workspace_id: string | null;
        };
        Insert: {
          attempts?: number;
          created_at?: string;
          finished_at?: string | null;
          id?: never;
          idempotency_key?: string | null;
          last_error?: string | null;
          lock_expires_at?: string | null;
          locked_at?: string | null;
          locked_by?: string | null;
          max_attempts?: number;
          payload?: Json;
          priority?: number;
          queue?: string;
          retry_count?: number;
          run_at?: string;
          status?: Database['public']['Enums']['job_status'];
          type: string;
          workspace_id?: string | null;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          finished_at?: string | null;
          id?: never;
          idempotency_key?: string | null;
          last_error?: string | null;
          lock_expires_at?: string | null;
          locked_at?: string | null;
          locked_by?: string | null;
          max_attempts?: number;
          payload?: Json;
          priority?: number;
          queue?: string;
          retry_count?: number;
          run_at?: string;
          status?: Database['public']['Enums']['job_status'];
          type?: string;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'jobs_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      kb_chunks: {
        Row: {
          bot_id: string | null;
          chunk_index: number;
          content: string;
          created_at: string;
          document_id: string | null;
          embedding: string | null;
          embedding_model: string | null;
          fts: unknown;
          id: string;
          language: string | null;
          metadata: Json;
          ref_id: string | null;
          source_id: string;
          source_type: Database['public']['Enums']['kb_source_type'];
          token_count: number | null;
          workspace_id: string;
        };
        Insert: {
          bot_id?: string | null;
          chunk_index: number;
          content: string;
          created_at?: string;
          document_id?: string | null;
          embedding?: string | null;
          embedding_model?: string | null;
          fts?: unknown;
          id?: string;
          language?: string | null;
          metadata?: Json;
          ref_id?: string | null;
          source_id: string;
          source_type: Database['public']['Enums']['kb_source_type'];
          token_count?: number | null;
          workspace_id: string;
        };
        Update: {
          bot_id?: string | null;
          chunk_index?: number;
          content?: string;
          created_at?: string;
          document_id?: string | null;
          embedding?: string | null;
          embedding_model?: string | null;
          fts?: unknown;
          id?: string;
          language?: string | null;
          metadata?: Json;
          ref_id?: string | null;
          source_id?: string;
          source_type?: Database['public']['Enums']['kb_source_type'];
          token_count?: number | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'kb_chunks_bot_fk';
            columns: ['workspace_id', 'bot_id'];
            isOneToOne: false;
            referencedRelation: 'bots';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'kb_chunks_workspace_id_document_id_fkey';
            columns: ['workspace_id', 'document_id'];
            isOneToOne: false;
            referencedRelation: 'kb_documents';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'kb_chunks_workspace_id_source_id_fkey';
            columns: ['workspace_id', 'source_id'];
            isOneToOne: false;
            referencedRelation: 'kb_sources';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      kb_documents: {
        Row: {
          body: string | null;
          checksum: string | null;
          chunk_count: number;
          created_at: string;
          created_by: string | null;
          error: string | null;
          file_name: string | null;
          id: string;
          language: string | null;
          mime_type: string | null;
          processed_at: string | null;
          size_bytes: number | null;
          source_id: string;
          status: Database['public']['Enums']['processing_status'];
          storage_path: string | null;
          title: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          body?: string | null;
          checksum?: string | null;
          chunk_count?: number;
          created_at?: string;
          created_by?: string | null;
          error?: string | null;
          file_name?: string | null;
          id?: string;
          language?: string | null;
          mime_type?: string | null;
          processed_at?: string | null;
          size_bytes?: number | null;
          source_id: string;
          status?: Database['public']['Enums']['processing_status'];
          storage_path?: string | null;
          title?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          body?: string | null;
          checksum?: string | null;
          chunk_count?: number;
          created_at?: string;
          created_by?: string | null;
          error?: string | null;
          file_name?: string | null;
          id?: string;
          language?: string | null;
          mime_type?: string | null;
          processed_at?: string | null;
          size_bytes?: number | null;
          source_id?: string;
          status?: Database['public']['Enums']['processing_status'];
          storage_path?: string | null;
          title?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'kb_documents_workspace_id_source_id_fkey';
            columns: ['workspace_id', 'source_id'];
            isOneToOne: false;
            referencedRelation: 'kb_sources';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      kb_sources: {
        Row: {
          bot_id: string | null;
          created_at: string;
          created_by: string | null;
          error: string | null;
          id: string;
          last_synced_at: string | null;
          status: Database['public']['Enums']['processing_status'];
          title: string;
          type: Database['public']['Enums']['kb_source_type'];
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          bot_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          error?: string | null;
          id?: string;
          last_synced_at?: string | null;
          status?: Database['public']['Enums']['processing_status'];
          title: string;
          type: Database['public']['Enums']['kb_source_type'];
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          bot_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          error?: string | null;
          id?: string;
          last_synced_at?: string | null;
          status?: Database['public']['Enums']['processing_status'];
          title?: string;
          type?: Database['public']['Enums']['kb_source_type'];
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'kb_sources_workspace_id_bot_id_fkey';
            columns: ['workspace_id', 'bot_id'];
            isOneToOne: false;
            referencedRelation: 'bots';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'kb_sources_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      knowledge_gaps: {
        Row: {
          bot_id: string | null;
          category: string | null;
          conversation_id: string | null;
          created_at: string;
          id: string;
          language: string | null;
          last_seen_at: string;
          message_id: string | null;
          occurrences: number;
          question: string;
          resolved_at: string | null;
          resolved_by: string | null;
          status: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          bot_id?: string | null;
          category?: string | null;
          conversation_id?: string | null;
          created_at?: string;
          id?: string;
          language?: string | null;
          last_seen_at?: string;
          message_id?: string | null;
          occurrences?: number;
          question: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          bot_id?: string | null;
          category?: string | null;
          conversation_id?: string | null;
          created_at?: string;
          id?: string;
          language?: string | null;
          last_seen_at?: string;
          message_id?: string | null;
          occurrences?: number;
          question?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'knowledge_gaps_workspace_id_bot_id_fkey';
            columns: ['workspace_id', 'bot_id'];
            isOneToOne: false;
            referencedRelation: 'bots';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'knowledge_gaps_workspace_id_conversation_id_fkey';
            columns: ['workspace_id', 'conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'knowledge_gaps_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'knowledge_gaps_workspace_id_message_id_fkey';
            columns: ['workspace_id', 'message_id'];
            isOneToOne: false;
            referencedRelation: 'messages';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      manual_payment_requests: {
        Row: {
          billing_interval: Database['public']['Enums']['billing_interval'] | null;
          connection_request_id: string | null;
          contact_email: string;
          contact_name: string;
          contact_phone: string | null;
          created_at: string;
          handled_by: string | null;
          id: string;
          message: string | null;
          one_time_product_id: string | null;
          plan_id: string | null;
          preferred_method: string | null;
          requested_by: string;
          status: Database['public']['Enums']['manual_request_status'];
          subscription_id: string | null;
          transaction_id: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          billing_interval?: Database['public']['Enums']['billing_interval'] | null;
          connection_request_id?: string | null;
          contact_email: string;
          contact_name: string;
          contact_phone?: string | null;
          created_at?: string;
          handled_by?: string | null;
          id?: string;
          message?: string | null;
          one_time_product_id?: string | null;
          plan_id?: string | null;
          preferred_method?: string | null;
          requested_by: string;
          status?: Database['public']['Enums']['manual_request_status'];
          subscription_id?: string | null;
          transaction_id?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          billing_interval?: Database['public']['Enums']['billing_interval'] | null;
          connection_request_id?: string | null;
          contact_email?: string;
          contact_name?: string;
          contact_phone?: string | null;
          created_at?: string;
          handled_by?: string | null;
          id?: string;
          message?: string | null;
          one_time_product_id?: string | null;
          plan_id?: string | null;
          preferred_method?: string | null;
          requested_by?: string;
          status?: Database['public']['Enums']['manual_request_status'];
          subscription_id?: string | null;
          transaction_id?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'manual_payment_requests_one_time_product_id_fkey';
            columns: ['one_time_product_id'];
            isOneToOne: false;
            referencedRelation: 'one_time_products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'manual_payment_requests_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'plans';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'manual_payment_requests_workspace_id_connection_request_id_fkey';
            columns: ['workspace_id', 'connection_request_id'];
            isOneToOne: false;
            referencedRelation: 'channel_connection_requests';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'manual_payment_requests_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'manual_payment_requests_workspace_id_subscription_id_fkey';
            columns: ['workspace_id', 'subscription_id'];
            isOneToOne: false;
            referencedRelation: 'subscriptions';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'manual_payment_requests_workspace_id_transaction_id_fkey';
            columns: ['workspace_id', 'transaction_id'];
            isOneToOne: false;
            referencedRelation: 'payment_transactions';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      message_attachments: {
        Row: {
          created_at: string;
          file_name: string | null;
          id: string;
          message_id: string;
          mime_type: string;
          size_bytes: number;
          storage_path: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          file_name?: string | null;
          id?: string;
          message_id: string;
          mime_type: string;
          size_bytes: number;
          storage_path: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          file_name?: string | null;
          id?: string;
          message_id?: string;
          mime_type?: string;
          size_bytes?: number;
          storage_path?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'message_attachments_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'message_attachments_workspace_id_message_id_fkey';
            columns: ['workspace_id', 'message_id'];
            isOneToOne: false;
            referencedRelation: 'messages';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      messages: {
        Row: {
          ai_run_id: string | null;
          channel_id: string | null;
          client_message_id: string | null;
          content: string | null;
          content_type: Database['public']['Enums']['message_content_type'];
          conversation_id: string;
          created_at: string;
          delivery_error: string | null;
          delivery_status: Database['public']['Enums']['delivery_status'];
          direction: Database['public']['Enums']['message_direction'];
          external_message_id: string | null;
          id: string;
          is_test: boolean;
          language: string | null;
          payload: Json;
          sender: Database['public']['Enums']['message_sender'];
          sender_user_id: string | null;
          workspace_id: string;
        };
        Insert: {
          ai_run_id?: string | null;
          channel_id?: string | null;
          client_message_id?: string | null;
          content?: string | null;
          content_type?: Database['public']['Enums']['message_content_type'];
          conversation_id: string;
          created_at?: string;
          delivery_error?: string | null;
          delivery_status: Database['public']['Enums']['delivery_status'];
          direction: Database['public']['Enums']['message_direction'];
          external_message_id?: string | null;
          id?: string;
          is_test?: boolean;
          language?: string | null;
          payload?: Json;
          sender: Database['public']['Enums']['message_sender'];
          sender_user_id?: string | null;
          workspace_id: string;
        };
        Update: {
          ai_run_id?: string | null;
          channel_id?: string | null;
          client_message_id?: string | null;
          content?: string | null;
          content_type?: Database['public']['Enums']['message_content_type'];
          conversation_id?: string;
          created_at?: string;
          delivery_error?: string | null;
          delivery_status?: Database['public']['Enums']['delivery_status'];
          direction?: Database['public']['Enums']['message_direction'];
          external_message_id?: string | null;
          id?: string;
          is_test?: boolean;
          language?: string | null;
          payload?: Json;
          sender?: Database['public']['Enums']['message_sender'];
          sender_user_id?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'messages_ai_run_fk';
            columns: ['workspace_id', 'ai_run_id'];
            isOneToOne: false;
            referencedRelation: 'ai_runs';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'messages_workspace_id_channel_id_fkey';
            columns: ['workspace_id', 'channel_id'];
            isOneToOne: false;
            referencedRelation: 'channels';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'messages_workspace_id_conversation_id_is_test_fkey';
            columns: ['workspace_id', 'conversation_id', 'is_test'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['workspace_id', 'id', 'is_test'];
          },
        ];
      };
      notifications: {
        Row: {
          body: Json | null;
          created_at: string;
          data: Json;
          id: string;
          read_at: string | null;
          title: Json;
          type: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          body?: Json | null;
          created_at?: string;
          data?: Json;
          id?: string;
          read_at?: string | null;
          title: Json;
          type: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          body?: Json | null;
          created_at?: string;
          data?: Json;
          id?: string;
          read_at?: string | null;
          title?: Json;
          type?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_workspace_id_user_id_fkey';
            columns: ['workspace_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
        ];
      };
      one_time_products: {
        Row: {
          amount_cents: number;
          code: string;
          created_at: string;
          currency: string;
          id: string;
          is_active: boolean;
          name: Json;
          refundable: boolean;
        };
        Insert: {
          amount_cents: number;
          code: string;
          created_at?: string;
          currency?: string;
          id?: string;
          is_active?: boolean;
          name: Json;
          refundable?: boolean;
        };
        Update: {
          amount_cents?: number;
          code?: string;
          created_at?: string;
          currency?: string;
          id?: string;
          is_active?: boolean;
          name?: Json;
          refundable?: boolean;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          catalog_item_id: string | null;
          id: string;
          line_total_cents: number;
          name_snapshot: Json;
          notes: string | null;
          order_id: string;
          quantity: number;
          selected_options: Json;
          unit_price_cents: number;
          workspace_id: string;
        };
        Insert: {
          catalog_item_id?: string | null;
          id?: string;
          line_total_cents: number;
          name_snapshot: Json;
          notes?: string | null;
          order_id: string;
          quantity: number;
          selected_options?: Json;
          unit_price_cents: number;
          workspace_id: string;
        };
        Update: {
          catalog_item_id?: string | null;
          id?: string;
          line_total_cents?: number;
          name_snapshot?: Json;
          notes?: string | null;
          order_id?: string;
          quantity?: number;
          selected_options?: Json;
          unit_price_cents?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_items_workspace_id_catalog_item_id_fkey';
            columns: ['workspace_id', 'catalog_item_id'];
            isOneToOne: false;
            referencedRelation: 'catalog_items';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'order_items_workspace_id_order_id_fkey';
            columns: ['workspace_id', 'order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      orders: {
        Row: {
          address: string | null;
          branch_id: string | null;
          cancel_reason: string | null;
          canceled_at: string | null;
          confirmed_at: string | null;
          conversation_id: string | null;
          created_at: string;
          created_by_user_id: string | null;
          currency: string;
          customer_id: string;
          delivery_fee_cents: number;
          external_ref: string | null;
          external_sync_status: Database['public']['Enums']['external_sync_status'];
          external_synced_at: string | null;
          external_system: string | null;
          id: string;
          notes: string | null;
          order_number: number | null;
          source: Database['public']['Enums']['record_source'];
          status: Database['public']['Enums']['order_status'];
          subtotal_cents: number;
          total_cents: number;
          type: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          address?: string | null;
          branch_id?: string | null;
          cancel_reason?: string | null;
          canceled_at?: string | null;
          confirmed_at?: string | null;
          conversation_id?: string | null;
          created_at?: string;
          created_by_user_id?: string | null;
          currency: string;
          customer_id: string;
          delivery_fee_cents?: number;
          external_ref?: string | null;
          external_sync_status?: Database['public']['Enums']['external_sync_status'];
          external_synced_at?: string | null;
          external_system?: string | null;
          id?: string;
          notes?: string | null;
          order_number?: number | null;
          source: Database['public']['Enums']['record_source'];
          status?: Database['public']['Enums']['order_status'];
          subtotal_cents?: number;
          total_cents?: number;
          type?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          address?: string | null;
          branch_id?: string | null;
          cancel_reason?: string | null;
          canceled_at?: string | null;
          confirmed_at?: string | null;
          conversation_id?: string | null;
          created_at?: string;
          created_by_user_id?: string | null;
          currency?: string;
          customer_id?: string;
          delivery_fee_cents?: number;
          external_ref?: string | null;
          external_sync_status?: Database['public']['Enums']['external_sync_status'];
          external_synced_at?: string | null;
          external_system?: string | null;
          id?: string;
          notes?: string | null;
          order_number?: number | null;
          source?: Database['public']['Enums']['record_source'];
          status?: Database['public']['Enums']['order_status'];
          subtotal_cents?: number;
          total_cents?: number;
          type?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'orders_workspace_id_branch_id_fkey';
            columns: ['workspace_id', 'branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'orders_workspace_id_conversation_id_fkey';
            columns: ['workspace_id', 'conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'orders_workspace_id_customer_id_fkey';
            columns: ['workspace_id', 'customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'orders_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      payment_transactions: {
        Row: {
          amount_cents: number;
          created_at: string;
          currency: string;
          description: string | null;
          id: string;
          metadata: Json;
          occurred_at: string;
          period_end: string | null;
          period_start: string | null;
          provider: Database['public']['Enums']['payment_provider'];
          provider_txn_id: string | null;
          raw: Json;
          recorded_by: string | null;
          refund_of_id: string | null;
          status: Database['public']['Enums']['transaction_status'];
          subscription_id: string | null;
          type: Database['public']['Enums']['transaction_type'];
          workspace_id: string;
        };
        Insert: {
          amount_cents: number;
          created_at?: string;
          currency: string;
          description?: string | null;
          id?: string;
          metadata?: Json;
          occurred_at?: string;
          period_end?: string | null;
          period_start?: string | null;
          provider: Database['public']['Enums']['payment_provider'];
          provider_txn_id?: string | null;
          raw?: Json;
          recorded_by?: string | null;
          refund_of_id?: string | null;
          status: Database['public']['Enums']['transaction_status'];
          subscription_id?: string | null;
          type: Database['public']['Enums']['transaction_type'];
          workspace_id: string;
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          currency?: string;
          description?: string | null;
          id?: string;
          metadata?: Json;
          occurred_at?: string;
          period_end?: string | null;
          period_start?: string | null;
          provider?: Database['public']['Enums']['payment_provider'];
          provider_txn_id?: string | null;
          raw?: Json;
          recorded_by?: string | null;
          refund_of_id?: string | null;
          status?: Database['public']['Enums']['transaction_status'];
          subscription_id?: string | null;
          type?: Database['public']['Enums']['transaction_type'];
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payment_transactions_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payment_transactions_workspace_id_refund_of_id_fkey';
            columns: ['workspace_id', 'refund_of_id'];
            isOneToOne: false;
            referencedRelation: 'payment_transactions';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'payment_transactions_workspace_id_subscription_id_fkey';
            columns: ['workspace_id', 'subscription_id'];
            isOneToOne: false;
            referencedRelation: 'subscriptions';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      plan_entitlements: {
        Row: {
          key: string;
          plan_id: string;
          value: Json;
        };
        Insert: {
          key: string;
          plan_id: string;
          value: Json;
        };
        Update: {
          key?: string;
          plan_id?: string;
          value?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'plan_entitlements_key_fkey';
            columns: ['key'];
            isOneToOne: false;
            referencedRelation: 'entitlement_definitions';
            referencedColumns: ['key'];
          },
          {
            foreignKeyName: 'plan_entitlements_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'plans';
            referencedColumns: ['id'];
          },
        ];
      };
      plan_prices: {
        Row: {
          amount_cents: number;
          created_at: string;
          currency: string;
          id: string;
          interval: Database['public']['Enums']['billing_interval'];
          is_active: boolean;
          plan_id: string;
        };
        Insert: {
          amount_cents: number;
          created_at?: string;
          currency?: string;
          id?: string;
          interval: Database['public']['Enums']['billing_interval'];
          is_active?: boolean;
          plan_id: string;
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          currency?: string;
          id?: string;
          interval?: Database['public']['Enums']['billing_interval'];
          is_active?: boolean;
          plan_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'plan_prices_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'plans';
            referencedColumns: ['id'];
          },
        ];
      };
      plans: {
        Row: {
          code: string;
          contact_sales: boolean;
          created_at: string;
          description: Json | null;
          id: string;
          is_active: boolean;
          is_public: boolean;
          is_trial: boolean;
          name: Json;
          sort_order: number;
          trial_days: number | null;
          updated_at: string;
        };
        Insert: {
          code: string;
          contact_sales?: boolean;
          created_at?: string;
          description?: Json | null;
          id?: string;
          is_active?: boolean;
          is_public?: boolean;
          is_trial?: boolean;
          name: Json;
          sort_order?: number;
          trial_days?: number | null;
          updated_at?: string;
        };
        Update: {
          code?: string;
          contact_sales?: boolean;
          created_at?: string;
          description?: Json | null;
          id?: string;
          is_active?: boolean;
          is_public?: boolean;
          is_trial?: boolean;
          name?: Json;
          sort_order?: number;
          trial_days?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      platform_admins: {
        Row: {
          created_at: string;
          created_by: string | null;
          role: Database['public']['Enums']['platform_role'];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          role?: Database['public']['Enums']['platform_role'];
          user_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          role?: Database['public']['Enums']['platform_role'];
          user_id?: string;
        };
        Relationships: [];
      };
      platform_events: {
        Row: {
          attempts: number;
          created_at: string;
          delivered_at: string | null;
          email_status: Database['public']['Enums']['event_delivery_status'];
          event_type: string;
          id: number;
          last_error: string | null;
          n8n_status: Database['public']['Enums']['event_delivery_status'];
          payload: Json;
          workspace_id: string | null;
        };
        Insert: {
          attempts?: number;
          created_at?: string;
          delivered_at?: string | null;
          email_status?: Database['public']['Enums']['event_delivery_status'];
          event_type: string;
          id?: never;
          last_error?: string | null;
          n8n_status?: Database['public']['Enums']['event_delivery_status'];
          payload?: Json;
          workspace_id?: string | null;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          delivered_at?: string | null;
          email_status?: Database['public']['Enums']['event_delivery_status'];
          event_type?: string;
          id?: never;
          last_error?: string | null;
          n8n_status?: Database['public']['Enums']['event_delivery_status'];
          payload?: Json;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'platform_events_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      platform_settings: {
        Row: {
          description: string | null;
          key: string;
          updated_at: string;
          updated_by: string | null;
          value: Json;
        };
        Insert: {
          description?: string | null;
          key: string;
          updated_at?: string;
          updated_by?: string | null;
          value: Json;
        };
        Update: {
          description?: string | null;
          key?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: Json;
        };
        Relationships: [];
      };
      policies: {
        Row: {
          branch_id: string | null;
          content: Json;
          created_at: string;
          id: string;
          is_active: boolean;
          sort_order: number;
          title: Json | null;
          type: Database['public']['Enums']['policy_type'];
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          branch_id?: string | null;
          content: Json;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          sort_order?: number;
          title?: Json | null;
          type: Database['public']['Enums']['policy_type'];
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          branch_id?: string | null;
          content?: Json;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          sort_order?: number;
          title?: Json | null;
          type?: Database['public']['Enums']['policy_type'];
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'policies_workspace_id_branch_id_fkey';
            columns: ['workspace_id', 'branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'policies_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_path: string | null;
          created_at: string;
          full_name: string | null;
          id: string;
          locale: string;
          numeral_style: string;
          theme: string;
          updated_at: string;
        };
        Insert: {
          avatar_path?: string | null;
          created_at?: string;
          full_name?: string | null;
          id: string;
          locale?: string;
          numeral_style?: string;
          theme?: string;
          updated_at?: string;
        };
        Update: {
          avatar_path?: string | null;
          created_at?: string;
          full_name?: string | null;
          id?: string;
          locale?: string;
          numeral_style?: string;
          theme?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      provider_price_refs: {
        Row: {
          created_at: string;
          environment: string;
          external_id: string;
          id: string;
          one_time_product_id: string | null;
          plan_price_id: string | null;
          provider: Database['public']['Enums']['payment_provider'];
        };
        Insert: {
          created_at?: string;
          environment: string;
          external_id: string;
          id?: string;
          one_time_product_id?: string | null;
          plan_price_id?: string | null;
          provider: Database['public']['Enums']['payment_provider'];
        };
        Update: {
          created_at?: string;
          environment?: string;
          external_id?: string;
          id?: string;
          one_time_product_id?: string | null;
          plan_price_id?: string | null;
          provider?: Database['public']['Enums']['payment_provider'];
        };
        Relationships: [
          {
            foreignKeyName: 'provider_price_refs_one_time_product_id_fkey';
            columns: ['one_time_product_id'];
            isOneToOne: false;
            referencedRelation: 'one_time_products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'provider_price_refs_plan_price_id_fkey';
            columns: ['plan_price_id'];
            isOneToOne: false;
            referencedRelation: 'plan_prices';
            referencedColumns: ['id'];
          },
        ];
      };
      question_classifications: {
        Row: {
          category: string;
          confidence: number | null;
          created_at: string;
          dialect: string | null;
          intent: string | null;
          language: string | null;
          message_id: string;
          model: string | null;
          sentiment: string | null;
          workspace_id: string;
        };
        Insert: {
          category: string;
          confidence?: number | null;
          created_at?: string;
          dialect?: string | null;
          intent?: string | null;
          language?: string | null;
          message_id: string;
          model?: string | null;
          sentiment?: string | null;
          workspace_id: string;
        };
        Update: {
          category?: string;
          confidence?: number | null;
          created_at?: string;
          dialect?: string | null;
          intent?: string | null;
          language?: string | null;
          message_id?: string;
          model?: string | null;
          sentiment?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'question_classifications_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'question_classifications_workspace_id_message_id_fkey';
            columns: ['workspace_id', 'message_id'];
            isOneToOne: false;
            referencedRelation: 'messages';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      reservations: {
        Row: {
          branch_id: string | null;
          cancel_reason: string | null;
          canceled_at: string | null;
          confirmed_at: string | null;
          conversation_id: string | null;
          created_at: string;
          created_by_user_id: string | null;
          customer_id: string;
          ends_at: string | null;
          external_ref: string | null;
          external_sync_status: Database['public']['Enums']['external_sync_status'];
          external_synced_at: string | null;
          external_system: string | null;
          id: string;
          notes: string | null;
          party_size: number;
          reserved_at: string;
          source: Database['public']['Enums']['record_source'];
          status: Database['public']['Enums']['reservation_status'];
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          branch_id?: string | null;
          cancel_reason?: string | null;
          canceled_at?: string | null;
          confirmed_at?: string | null;
          conversation_id?: string | null;
          created_at?: string;
          created_by_user_id?: string | null;
          customer_id: string;
          ends_at?: string | null;
          external_ref?: string | null;
          external_sync_status?: Database['public']['Enums']['external_sync_status'];
          external_synced_at?: string | null;
          external_system?: string | null;
          id?: string;
          notes?: string | null;
          party_size: number;
          reserved_at: string;
          source: Database['public']['Enums']['record_source'];
          status?: Database['public']['Enums']['reservation_status'];
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          branch_id?: string | null;
          cancel_reason?: string | null;
          canceled_at?: string | null;
          confirmed_at?: string | null;
          conversation_id?: string | null;
          created_at?: string;
          created_by_user_id?: string | null;
          customer_id?: string;
          ends_at?: string | null;
          external_ref?: string | null;
          external_sync_status?: Database['public']['Enums']['external_sync_status'];
          external_synced_at?: string | null;
          external_system?: string | null;
          id?: string;
          notes?: string | null;
          party_size?: number;
          reserved_at?: string;
          source?: Database['public']['Enums']['record_source'];
          status?: Database['public']['Enums']['reservation_status'];
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reservations_workspace_id_branch_id_fkey';
            columns: ['workspace_id', 'branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'reservations_workspace_id_conversation_id_fkey';
            columns: ['workspace_id', 'conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'reservations_workspace_id_customer_id_fkey';
            columns: ['workspace_id', 'customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'reservations_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      subscriptions: {
        Row: {
          activated_by: string | null;
          billing_interval: Database['public']['Enums']['billing_interval'] | null;
          cancel_at_period_end: boolean;
          canceled_at: string | null;
          created_at: string;
          current_period_end: string | null;
          current_period_start: string | null;
          custom_amount_cents: number | null;
          custom_currency: string | null;
          ended_at: string | null;
          grace_ends_at: string | null;
          id: string;
          notes: string | null;
          plan_id: string;
          plan_price_id: string | null;
          provider: Database['public']['Enums']['payment_provider'];
          provider_subscription_id: string | null;
          status: Database['public']['Enums']['subscription_status'];
          trial_ends_at: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          activated_by?: string | null;
          billing_interval?: Database['public']['Enums']['billing_interval'] | null;
          cancel_at_period_end?: boolean;
          canceled_at?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          custom_amount_cents?: number | null;
          custom_currency?: string | null;
          ended_at?: string | null;
          grace_ends_at?: string | null;
          id?: string;
          notes?: string | null;
          plan_id: string;
          plan_price_id?: string | null;
          provider: Database['public']['Enums']['payment_provider'];
          provider_subscription_id?: string | null;
          status: Database['public']['Enums']['subscription_status'];
          trial_ends_at?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          activated_by?: string | null;
          billing_interval?: Database['public']['Enums']['billing_interval'] | null;
          cancel_at_period_end?: boolean;
          canceled_at?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          custom_amount_cents?: number | null;
          custom_currency?: string | null;
          ended_at?: string | null;
          grace_ends_at?: string | null;
          id?: string;
          notes?: string | null;
          plan_id?: string;
          plan_price_id?: string | null;
          provider?: Database['public']['Enums']['payment_provider'];
          provider_subscription_id?: string | null;
          status?: Database['public']['Enums']['subscription_status'];
          trial_ends_at?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'subscriptions_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'plans';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'subscriptions_plan_price_id_fkey';
            columns: ['plan_price_id'];
            isOneToOne: false;
            referencedRelation: 'plan_prices';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'subscriptions_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      usage_alerts: {
        Row: {
          threshold_pct: number;
          triggered_at: string;
          usage_period_id: string;
          workspace_id: string;
        };
        Insert: {
          threshold_pct: number;
          triggered_at?: string;
          usage_period_id: string;
          workspace_id: string;
        };
        Update: {
          threshold_pct?: number;
          triggered_at?: string;
          usage_period_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'usage_alerts_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'usage_alerts_workspace_id_usage_period_id_fkey';
            columns: ['workspace_id', 'usage_period_id'];
            isOneToOne: false;
            referencedRelation: 'usage_periods';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      usage_events: {
        Row: {
          ai_run_id: string | null;
          created_at: string;
          id: number;
          idempotency_key: string;
          is_overage: boolean;
          kind: string;
          quantity: number;
          usage_period_id: string;
          workspace_id: string;
        };
        Insert: {
          ai_run_id?: string | null;
          created_at?: string;
          id?: never;
          idempotency_key: string;
          is_overage?: boolean;
          kind: string;
          quantity: number;
          usage_period_id: string;
          workspace_id: string;
        };
        Update: {
          ai_run_id?: string | null;
          created_at?: string;
          id?: never;
          idempotency_key?: string;
          is_overage?: boolean;
          kind?: string;
          quantity?: number;
          usage_period_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'usage_events_workspace_id_ai_run_id_fkey';
            columns: ['workspace_id', 'ai_run_id'];
            isOneToOne: false;
            referencedRelation: 'ai_runs';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'usage_events_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'usage_events_workspace_id_usage_period_id_fkey';
            columns: ['workspace_id', 'usage_period_id'];
            isOneToOne: false;
            referencedRelation: 'usage_periods';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      usage_periods: {
        Row: {
          ai_replies_included: number | null;
          ai_replies_used: number;
          closed_at: string | null;
          created_at: string;
          id: string;
          inbound_messages: number;
          overage_allowed: boolean;
          overage_replies: number;
          overage_unit_price_cents: number | null;
          overage_unit_size: number | null;
          period_end: string;
          period_start: string;
          subscription_id: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          ai_replies_included?: number | null;
          ai_replies_used?: number;
          closed_at?: string | null;
          created_at?: string;
          id?: string;
          inbound_messages?: number;
          overage_allowed?: boolean;
          overage_replies?: number;
          overage_unit_price_cents?: number | null;
          overage_unit_size?: number | null;
          period_end: string;
          period_start: string;
          subscription_id?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          ai_replies_included?: number | null;
          ai_replies_used?: number;
          closed_at?: string | null;
          created_at?: string;
          id?: string;
          inbound_messages?: number;
          overage_allowed?: boolean;
          overage_replies?: number;
          overage_unit_price_cents?: number | null;
          overage_unit_size?: number | null;
          period_end?: string;
          period_start?: string;
          subscription_id?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'usage_periods_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'usage_periods_workspace_id_subscription_id_fkey';
            columns: ['workspace_id', 'subscription_id'];
            isOneToOne: false;
            referencedRelation: 'subscriptions';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      webhook_events: {
        Row: {
          attempts: number;
          event_id: string;
          event_type: string;
          id: number;
          last_error: string | null;
          payload: Json;
          processed_at: string | null;
          provider: Database['public']['Enums']['webhook_provider'];
          received_at: string;
          signature_valid: boolean;
          status: Database['public']['Enums']['webhook_status'];
          workspace_id: string | null;
        };
        Insert: {
          attempts?: number;
          event_id: string;
          event_type: string;
          id?: never;
          last_error?: string | null;
          payload: Json;
          processed_at?: string | null;
          provider: Database['public']['Enums']['webhook_provider'];
          received_at?: string;
          signature_valid: boolean;
          status?: Database['public']['Enums']['webhook_status'];
          workspace_id?: string | null;
        };
        Update: {
          attempts?: number;
          event_id?: string;
          event_type?: string;
          id?: never;
          last_error?: string | null;
          payload?: Json;
          processed_at?: string | null;
          provider?: Database['public']['Enums']['webhook_provider'];
          received_at?: string;
          signature_valid?: boolean;
          status?: Database['public']['Enums']['webhook_status'];
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'webhook_events_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      whatsapp_templates: {
        Row: {
          category: string | null;
          channel_id: string;
          components: Json;
          created_at: string;
          external_template_id: string | null;
          id: string;
          language: string;
          last_synced_at: string | null;
          name: string;
          rejection_reason: string | null;
          status: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          category?: string | null;
          channel_id: string;
          components?: Json;
          created_at?: string;
          external_template_id?: string | null;
          id?: string;
          language: string;
          last_synced_at?: string | null;
          name: string;
          rejection_reason?: string | null;
          status: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          category?: string | null;
          channel_id?: string;
          components?: Json;
          created_at?: string;
          external_template_id?: string | null;
          id?: string;
          language?: string;
          last_synced_at?: string | null;
          name?: string;
          rejection_reason?: string | null;
          status?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'whatsapp_templates_workspace_id_channel_id_fkey';
            columns: ['workspace_id', 'channel_id'];
            isOneToOne: false;
            referencedRelation: 'channels';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'whatsapp_templates_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      widget_settings: {
        Row: {
          allowed_origins: string[];
          channel_id: string;
          created_at: string;
          greeting: Json | null;
          installed_origin: string | null;
          installed_verified_at: string | null;
          is_enabled: boolean;
          launcher_text: Json | null;
          position: string;
          prechat_fields: Json;
          show_branding: boolean;
          theme: Json;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          allowed_origins?: string[];
          channel_id: string;
          created_at?: string;
          greeting?: Json | null;
          installed_origin?: string | null;
          installed_verified_at?: string | null;
          is_enabled?: boolean;
          launcher_text?: Json | null;
          position?: string;
          prechat_fields?: Json;
          show_branding?: boolean;
          theme?: Json;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          allowed_origins?: string[];
          channel_id?: string;
          created_at?: string;
          greeting?: Json | null;
          installed_origin?: string | null;
          installed_verified_at?: string | null;
          is_enabled?: boolean;
          launcher_text?: Json | null;
          position?: string;
          prechat_fields?: Json;
          show_branding?: boolean;
          theme?: Json;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'widget_settings_workspace_id_channel_id_fkey';
            columns: ['workspace_id', 'channel_id'];
            isOneToOne: false;
            referencedRelation: 'channels';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'widget_settings_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      working_hours: {
        Row: {
          branch_id: string | null;
          close_time: string | null;
          created_at: string;
          id: string;
          is_closed: boolean;
          open_time: string | null;
          updated_at: string;
          weekday: number;
          workspace_id: string;
        };
        Insert: {
          branch_id?: string | null;
          close_time?: string | null;
          created_at?: string;
          id?: string;
          is_closed?: boolean;
          open_time?: string | null;
          updated_at?: string;
          weekday: number;
          workspace_id: string;
        };
        Update: {
          branch_id?: string | null;
          close_time?: string | null;
          created_at?: string;
          id?: string;
          is_closed?: boolean;
          open_time?: string | null;
          updated_at?: string;
          weekday?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'working_hours_workspace_id_branch_id_fkey';
            columns: ['workspace_id', 'branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'working_hours_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      working_hours_overrides: {
        Row: {
          branch_id: string | null;
          close_time: string | null;
          created_at: string;
          date: string;
          id: string;
          is_closed: boolean;
          note: Json | null;
          open_time: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          branch_id?: string | null;
          close_time?: string | null;
          created_at?: string;
          date: string;
          id?: string;
          is_closed?: boolean;
          note?: Json | null;
          open_time?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          branch_id?: string | null;
          close_time?: string | null;
          created_at?: string;
          date?: string;
          id?: string;
          is_closed?: boolean;
          note?: Json | null;
          open_time?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'working_hours_overrides_workspace_id_branch_id_fkey';
            columns: ['workspace_id', 'branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'working_hours_overrides_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      workspace_entitlement_overrides: {
        Row: {
          created_at: string;
          expires_at: string | null;
          key: string;
          reason: string;
          set_by: string | null;
          value: Json;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          expires_at?: string | null;
          key: string;
          reason: string;
          set_by?: string | null;
          value: Json;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string | null;
          key?: string;
          reason?: string;
          set_by?: string | null;
          value?: Json;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_entitlement_overrides_key_fkey';
            columns: ['key'];
            isOneToOne: false;
            referencedRelation: 'entitlement_definitions';
            referencedColumns: ['key'];
          },
          {
            foreignKeyName: 'workspace_entitlement_overrides_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      workspace_invitations: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string;
          revoked_at: string | null;
          role: Database['public']['Enums']['workspace_role'];
          token_hash: string;
          workspace_id: string;
        };
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          email: string;
          expires_at?: string;
          id?: string;
          invited_by: string;
          revoked_at?: string | null;
          role: Database['public']['Enums']['workspace_role'];
          token_hash: string;
          workspace_id: string;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string;
          revoked_at?: string | null;
          role?: Database['public']['Enums']['workspace_role'];
          token_hash?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_invitations_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      workspace_members: {
        Row: {
          created_at: string;
          invited_by: string | null;
          role: Database['public']['Enums']['workspace_role'];
          status: Database['public']['Enums']['member_status'];
          updated_at: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          invited_by?: string | null;
          role: Database['public']['Enums']['workspace_role'];
          status?: Database['public']['Enums']['member_status'];
          updated_at?: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          invited_by?: string | null;
          role?: Database['public']['Enums']['workspace_role'];
          status?: Database['public']['Enums']['member_status'];
          updated_at?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_members_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      workspace_onboarding: {
        Row: {
          completed_at: string | null;
          completed_steps: string[];
          created_at: string;
          current_step: string;
          data: Json;
          skipped_steps: string[];
          updated_at: string;
          updated_by: string | null;
          workspace_id: string;
        };
        Insert: {
          completed_at?: string | null;
          completed_steps?: string[];
          created_at?: string;
          current_step?: string;
          data?: Json;
          skipped_steps?: string[];
          updated_at?: string;
          updated_by?: string | null;
          workspace_id: string;
        };
        Update: {
          completed_at?: string | null;
          completed_steps?: string[];
          created_at?: string;
          current_step?: string;
          data?: Json;
          skipped_steps?: string[];
          updated_at?: string;
          updated_by?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_onboarding_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: true;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      workspaces: {
        Row: {
          category: string | null;
          country_code: string | null;
          created_at: string;
          created_by: string | null;
          default_locale: string;
          deleted_at: string | null;
          deletion_requested_at: string | null;
          id: string;
          logo_path: string | null;
          name: string;
          purge_after: string | null;
          retained_billing_identity: Json | null;
          retention_days_override: number | null;
          slug: string;
          status: Database['public']['Enums']['workspace_status'];
          status_reason: string | null;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          category?: string | null;
          country_code?: string | null;
          created_at?: string;
          created_by?: string | null;
          default_locale?: string;
          deleted_at?: string | null;
          deletion_requested_at?: string | null;
          id?: string;
          logo_path?: string | null;
          name: string;
          purge_after?: string | null;
          retained_billing_identity?: Json | null;
          retention_days_override?: number | null;
          slug: string;
          status?: Database['public']['Enums']['workspace_status'];
          status_reason?: string | null;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          category?: string | null;
          country_code?: string | null;
          created_at?: string;
          created_by?: string | null;
          default_locale?: string;
          deleted_at?: string | null;
          deletion_requested_at?: string | null;
          id?: string;
          logo_path?: string | null;
          name?: string;
          purge_after?: string | null;
          retained_billing_identity?: Json | null;
          retention_days_override?: number | null;
          slug?: string;
          status?: Database['public']['Enums']['workspace_status'];
          status_reason?: string | null;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      claim_jobs: {
        Args: {
          p_limit?: number;
          p_lock_seconds?: number;
          p_queue: string;
          p_worker_id: string;
        };
        Returns: {
          attempts: number;
          created_at: string;
          finished_at: string | null;
          id: number;
          idempotency_key: string | null;
          last_error: string | null;
          lock_expires_at: string | null;
          locked_at: string | null;
          locked_by: string | null;
          max_attempts: number;
          payload: Json;
          priority: number;
          queue: string;
          retry_count: number;
          run_at: string;
          status: Database['public']['Enums']['job_status'];
          type: string;
          workspace_id: string | null;
        }[];
        SetofOptions: {
          from: '*';
          to: 'jobs';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      complete_job: {
        Args: { p_job_id: number; p_worker_id?: string };
        Returns: boolean;
      };
      consume_ai_reply: {
        Args: {
          p_ai_run_id?: string;
          p_idempotency_key: string;
          p_workspace_id: string;
        };
        Returns: {
          allowed: boolean;
          included: number;
          is_overage: boolean;
          reason: string;
          usage_period_id: string;
          used: number;
        }[];
      };
      enqueue_job: {
        Args: {
          p_idempotency_key?: string;
          p_payload?: Json;
          p_priority?: number;
          p_queue?: string;
          p_run_at?: string;
          p_type: string;
          p_workspace_id?: string;
        };
        Returns: number;
      };
      fail_job: {
        Args: {
          p_error: string;
          p_job_id: number;
          p_retryable?: boolean;
          p_worker_id?: string;
        };
        Returns: boolean;
      };
      get_workspace_entitlements: {
        Args: { p_workspace_id: string };
        Returns: Json;
      };
      match_kb_chunks: {
        Args: {
          p_bot_id: string;
          p_candidates?: number;
          p_match_count?: number;
          p_query_embedding: string;
          p_query_text: string;
          p_workspace_id: string;
        };
        Returns: {
          content: string;
          document_id: string;
          id: string;
          language: string;
          metadata: Json;
          ref_id: string;
          rrf_score: number;
          similarity: number;
          source_id: string;
          source_type: Database['public']['Enums']['kb_source_type'];
        }[];
      };
      purge_deleted_workspaces: { Args: never; Returns: number };
      release_ai_reply: {
        Args: { p_idempotency_key: string };
        Returns: boolean;
      };
      requeue_stuck_jobs: { Args: never; Returns: number };
      retry_job: {
        Args: { p_actor_id?: string; p_job_id: number; p_reason?: string };
        Returns: boolean;
      };
      soft_delete_workspace: {
        Args: { p_actor_id?: string; p_workspace_id: string };
        Returns: Json;
      };
    };
    Enums: {
      actor_type: 'user' | 'platform_admin' | 'system' | 'api_key' | 'ai';
      ai_run_status: 'running' | 'succeeded' | 'failed' | 'refused' | 'blocked_quota';
      billing_interval: 'month' | 'year' | 'one_time';
      bot_status: 'draft' | 'testing' | 'ready' | 'active' | 'paused';
      channel_status: 'not_connected' | 'pending' | 'connected' | 'error' | 'disabled';
      channel_type: 'widget' | 'whatsapp' | 'messenger' | 'instagram';
      connection_mode: 'automatic' | 'manual' | 'oauth';
      connection_request_status: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'canceled';
      conversation_handler: 'ai' | 'human';
      conversation_status: 'open' | 'pending' | 'closed';
      delivery_status: 'received' | 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
      event_delivery_status: 'pending' | 'delivered' | 'failed' | 'skipped';
      external_sync_status: 'not_applicable' | 'pending' | 'synced' | 'failed';
      feature_flag_scope: 'global' | 'workspace';
      handoff_status: 'requested' | 'assigned' | 'resolved' | 'canceled';
      health_status: 'unknown' | 'passing' | 'failing';
      invoice_status: 'draft' | 'issued' | 'paid' | 'void';
      job_status: 'queued' | 'running' | 'succeeded' | 'failed' | 'dead';
      kb_source_type: 'profile' | 'faq' | 'catalog' | 'policy' | 'file' | 'manual';
      manual_request_status: 'open' | 'contacted' | 'activated' | 'rejected' | 'canceled';
      member_status: 'active' | 'disabled';
      message_content_type:
        | 'text'
        | 'image'
        | 'audio'
        | 'video'
        | 'file'
        | 'location'
        | 'template'
        | 'interactive'
        | 'system_event';
      message_direction: 'inbound' | 'outbound';
      message_sender: 'customer' | 'ai' | 'agent' | 'system';
      order_status:
        'draft' | 'pending_confirmation' | 'confirmed' | 'preparing' | 'completed' | 'canceled';
      payment_provider: 'paypal' | 'manual' | 'stripe';
      platform_role: 'super_admin' | 'support';
      policy_type: 'delivery' | 'refund' | 'reservation' | 'other';
      processing_status: 'pending' | 'processing' | 'ready' | 'failed';
      record_source: 'ai' | 'agent' | 'api' | 'import';
      reservation_status:
        'pending_confirmation' | 'confirmed' | 'seated' | 'completed' | 'no_show' | 'canceled';
      subscription_status:
        | 'trialing'
        | 'active'
        | 'past_due'
        | 'grace'
        | 'suspended'
        | 'canceled'
        | 'expired'
        | 'pending_activation';
      transaction_status: 'pending' | 'completed' | 'failed' | 'refunded' | 'voided';
      transaction_type:
        'subscription_payment' | 'connection_fee' | 'overage' | 'refund' | 'manual_adjustment';
      webhook_provider: 'meta' | 'paypal' | 'stripe';
      webhook_status: 'received' | 'processed' | 'failed' | 'ignored';
      workspace_role: 'owner' | 'admin' | 'agent' | 'viewer';
      workspace_status: 'active' | 'read_only' | 'suspended' | 'pending_deletion';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      actor_type: ['user', 'platform_admin', 'system', 'api_key', 'ai'],
      ai_run_status: ['running', 'succeeded', 'failed', 'refused', 'blocked_quota'],
      billing_interval: ['month', 'year', 'one_time'],
      bot_status: ['draft', 'testing', 'ready', 'active', 'paused'],
      channel_status: ['not_connected', 'pending', 'connected', 'error', 'disabled'],
      channel_type: ['widget', 'whatsapp', 'messenger', 'instagram'],
      connection_mode: ['automatic', 'manual', 'oauth'],
      connection_request_status: ['pending', 'in_progress', 'completed', 'rejected', 'canceled'],
      conversation_handler: ['ai', 'human'],
      conversation_status: ['open', 'pending', 'closed'],
      delivery_status: ['received', 'queued', 'sent', 'delivered', 'read', 'failed'],
      event_delivery_status: ['pending', 'delivered', 'failed', 'skipped'],
      external_sync_status: ['not_applicable', 'pending', 'synced', 'failed'],
      feature_flag_scope: ['global', 'workspace'],
      handoff_status: ['requested', 'assigned', 'resolved', 'canceled'],
      health_status: ['unknown', 'passing', 'failing'],
      invoice_status: ['draft', 'issued', 'paid', 'void'],
      job_status: ['queued', 'running', 'succeeded', 'failed', 'dead'],
      kb_source_type: ['profile', 'faq', 'catalog', 'policy', 'file', 'manual'],
      manual_request_status: ['open', 'contacted', 'activated', 'rejected', 'canceled'],
      member_status: ['active', 'disabled'],
      message_content_type: [
        'text',
        'image',
        'audio',
        'video',
        'file',
        'location',
        'template',
        'interactive',
        'system_event',
      ],
      message_direction: ['inbound', 'outbound'],
      message_sender: ['customer', 'ai', 'agent', 'system'],
      order_status: [
        'draft',
        'pending_confirmation',
        'confirmed',
        'preparing',
        'completed',
        'canceled',
      ],
      payment_provider: ['paypal', 'manual', 'stripe'],
      platform_role: ['super_admin', 'support'],
      policy_type: ['delivery', 'refund', 'reservation', 'other'],
      processing_status: ['pending', 'processing', 'ready', 'failed'],
      record_source: ['ai', 'agent', 'api', 'import'],
      reservation_status: [
        'pending_confirmation',
        'confirmed',
        'seated',
        'completed',
        'no_show',
        'canceled',
      ],
      subscription_status: [
        'trialing',
        'active',
        'past_due',
        'grace',
        'suspended',
        'canceled',
        'expired',
        'pending_activation',
      ],
      transaction_status: ['pending', 'completed', 'failed', 'refunded', 'voided'],
      transaction_type: [
        'subscription_payment',
        'connection_fee',
        'overage',
        'refund',
        'manual_adjustment',
      ],
      webhook_provider: ['meta', 'paypal', 'stripe'],
      webhook_status: ['received', 'processed', 'failed', 'ignored'],
      workspace_role: ['owner', 'admin', 'agent', 'viewer'],
      workspace_status: ['active', 'read_only', 'suspended', 'pending_deletion'],
    },
  },
} as const;
