// Automatisch erzeugt von scripts/generate-db-types.ts – nicht von Hand bearbeiten.
// Format kompatibel mit `supabase gen types typescript`.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12.2.3";
  };
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          id: number;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          details: Json;
          created_at: string;
        };
        Insert: {
          id?: number;
          actor_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          details?: Json;
          created_at?: string;
        };
        Update: {
          id?: number;
          actor_id?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          details?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "admin_audit_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_generation_jobs: {
        Row: {
          id: string;
          user_id: string | null;
          job_type: Database["public"]["Enums"]["job_type"];
          status: Database["public"]["Enums"]["job_status"];
          property_id: string | null;
          listing_id: string | null;
          input: Json;
          result: Json | null;
          error_message: string | null;
          attempts: number;
          max_attempts: number;
          run_after: string;
          locked_at: string | null;
          locked_by: string | null;
          started_at: string | null;
          finished_at: string | null;
          idempotency_key: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          job_type: Database["public"]["Enums"]["job_type"];
          status?: Database["public"]["Enums"]["job_status"];
          property_id?: string | null;
          listing_id?: string | null;
          input?: Json;
          result?: Json | null;
          error_message?: string | null;
          attempts?: number;
          max_attempts?: number;
          run_after?: string;
          locked_at?: string | null;
          locked_by?: string | null;
          started_at?: string | null;
          finished_at?: string | null;
          idempotency_key?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          job_type?: Database["public"]["Enums"]["job_type"];
          status?: Database["public"]["Enums"]["job_status"];
          property_id?: string | null;
          listing_id?: string | null;
          input?: Json;
          result?: Json | null;
          error_message?: string | null;
          attempts?: number;
          max_attempts?: number;
          run_after?: string;
          locked_at?: string | null;
          locked_by?: string | null;
          started_at?: string | null;
          finished_at?: string | null;
          idempotency_key?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_generation_jobs_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_generation_jobs_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_generation_jobs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_usage_events: {
        Row: {
          id: string;
          user_id: string | null;
          job_id: string | null;
          feature: string;
          provider: string;
          model: string | null;
          input_tokens: number;
          output_tokens: number;
          image_count: number;
          cost_usd: number;
          success: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          job_id?: string | null;
          feature: string;
          provider: string;
          model?: string | null;
          input_tokens?: number;
          output_tokens?: number;
          image_count?: number;
          cost_usd?: number;
          success?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          job_id?: string | null;
          feature?: string;
          provider?: string;
          model?: string | null;
          input_tokens?: number;
          output_tokens?: number;
          image_count?: number;
          cost_usd?: number;
          success?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_usage_events_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "ai_generation_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_usage_events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      assistant_messages: {
        Row: {
          id: string;
          thread_id: string;
          role: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          thread_id: string;
          role: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          thread_id?: string;
          role?: string;
          content?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assistant_messages_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "assistant_threads";
            referencedColumns: ["id"];
          },
        ];
      };
      assistant_threads: {
        Row: {
          id: string;
          user_id: string;
          property_id: string | null;
          title: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          property_id?: string | null;
          title?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          property_id?: string | null;
          title?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assistant_threads_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assistant_threads_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_requests: {
        Row: {
          id: string;
          name: string;
          email: string;
          subject: string;
          message: string;
          user_id: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          subject: string;
          message: string;
          user_id?: string | null;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          subject?: string;
          message?: string;
          user_id?: string | null;
          status?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contact_requests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      conversation_participants: {
        Row: {
          conversation_id: string;
          user_id: string;
          role: string;
          last_read_at: string | null;
          archived_at: string | null;
          created_at: string;
        };
        Insert: {
          conversation_id: string;
          user_id: string;
          role: string;
          last_read_at?: string | null;
          archived_at?: string | null;
          created_at?: string;
        };
        Update: {
          conversation_id?: string;
          user_id?: string;
          role?: string;
          last_read_at?: string | null;
          archived_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      conversations: {
        Row: {
          id: string;
          listing_id: string | null;
          seller_id: string | null;
          interested_id: string | null;
          organization_id: string | null;
          subject: string | null;
          last_message_at: string | null;
          last_message_preview: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          listing_id?: string | null;
          seller_id?: string | null;
          interested_id?: string | null;
          organization_id?: string | null;
          subject?: string | null;
          last_message_at?: string | null;
          last_message_preview?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          listing_id?: string | null;
          seller_id?: string | null;
          interested_id?: string | null;
          organization_id?: string | null;
          subject?: string | null;
          last_message_at?: string | null;
          last_message_preview?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversations_interested_id_fkey";
            columns: ["interested_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      document_access_grants: {
        Row: {
          id: string;
          document_id: string;
          grantee_id: string;
          granted_by: string | null;
          expires_at: string | null;
          revoked_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          grantee_id: string;
          granted_by?: string | null;
          expires_at?: string | null;
          revoked_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          grantee_id?: string;
          granted_by?: string | null;
          expires_at?: string | null;
          revoked_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "document_access_grants_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "property_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_access_grants_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_access_grants_grantee_id_fkey";
            columns: ["grantee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      dossier_templates: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          is_premium: boolean;
          is_active: boolean;
          sort_order: number;
          config: Json;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          description?: string | null;
          is_premium?: boolean;
          is_active?: boolean;
          sort_order?: number;
          config?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          is_premium?: boolean;
          is_active?: boolean;
          sort_order?: number;
          config?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      email_outbox: {
        Row: {
          id: string;
          user_id: string | null;
          to_email: string | null;
          template: string;
          payload: Json;
          status: string;
          attempts: number;
          last_error: string | null;
          dedupe_key: string | null;
          scheduled_at: string;
          locked_at: string | null;
          sent_at: string | null;
          provider_message_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          to_email?: string | null;
          template: string;
          payload?: Json;
          status?: string;
          attempts?: number;
          last_error?: string | null;
          dedupe_key?: string | null;
          scheduled_at?: string;
          locked_at?: string | null;
          sent_at?: string | null;
          provider_message_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          to_email?: string | null;
          template?: string;
          payload?: Json;
          status?: string;
          attempts?: number;
          last_error?: string | null;
          dedupe_key?: string | null;
          scheduled_at?: string;
          locked_at?: string | null;
          sent_at?: string | null;
          provider_message_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "email_outbox_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      favorites: {
        Row: {
          user_id: string;
          listing_id: string;
          created_at: string;
        };
        Insert: {
          user_id?: string;
          listing_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          listing_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "favorites_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "favorites_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      feature_settings: {
        Row: {
          key: string;
          value: Json;
          description: string | null;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          description?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: Json;
          description?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "feature_settings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      generated_descriptions: {
        Row: {
          id: string;
          property_id: string;
          listing_id: string | null;
          user_id: string | null;
          style: Database["public"]["Enums"]["description_style"];
          content: Json;
          model: string | null;
          applied_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          listing_id?: string | null;
          user_id?: string | null;
          style: Database["public"]["Enums"]["description_style"];
          content: Json;
          model?: string | null;
          applied_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          listing_id?: string | null;
          user_id?: string | null;
          style?: Database["public"]["Enums"]["description_style"];
          content?: Json;
          model?: string | null;
          applied_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "generated_descriptions_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "generated_descriptions_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "generated_descriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      generated_dossiers: {
        Row: {
          id: string;
          property_id: string;
          listing_id: string | null;
          created_by: string | null;
          template_id: string;
          version: number;
          status: string;
          storage_path: string | null;
          file_size: number | null;
          page_count: number | null;
          options: Json;
          is_public: boolean;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          listing_id?: string | null;
          created_by?: string | null;
          template_id: string;
          version: number;
          status?: string;
          storage_path?: string | null;
          file_size?: number | null;
          page_count?: number | null;
          options?: Json;
          is_public?: boolean;
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          listing_id?: string | null;
          created_by?: string | null;
          template_id?: string;
          version?: number;
          status?: string;
          storage_path?: string | null;
          file_size?: number | null;
          page_count?: number | null;
          options?: Json;
          is_public?: boolean;
          error_message?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "generated_dossiers_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "generated_dossiers_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "generated_dossiers_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "generated_dossiers_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "dossier_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      image_transformations: {
        Row: {
          id: string;
          image_id: string;
          user_id: string | null;
          provider: string;
          kind: string;
          operations: Json;
          status: string;
          output_path: string | null;
          error_message: string | null;
          accepted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          image_id: string;
          user_id?: string | null;
          provider: string;
          kind?: string;
          operations?: Json;
          status?: string;
          output_path?: string | null;
          error_message?: string | null;
          accepted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          image_id?: string;
          user_id?: string | null;
          provider?: string;
          kind?: string;
          operations?: Json;
          status?: string;
          output_path?: string | null;
          error_message?: string | null;
          accepted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "image_transformations_image_id_fkey";
            columns: ["image_id"];
            isOneToOne: false;
            referencedRelation: "property_images";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "image_transformations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_notes: {
        Row: {
          id: string;
          lead_id: string;
          author_id: string | null;
          body: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          author_id?: string | null;
          body: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          lead_id?: string;
          author_id?: string | null;
          body?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lead_notes_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_notes_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };
      leads: {
        Row: {
          id: string;
          listing_id: string;
          owner_id: string;
          organization_id: string | null;
          interested_id: string | null;
          conversation_id: string | null;
          status: Database["public"]["Enums"]["lead_status"];
          source: string;
          rating: number | null;
          last_activity_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          listing_id: string;
          owner_id: string;
          organization_id?: string | null;
          interested_id?: string | null;
          conversation_id?: string | null;
          status?: Database["public"]["Enums"]["lead_status"];
          source?: string;
          rating?: number | null;
          last_activity_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          listing_id?: string;
          owner_id?: string;
          organization_id?: string | null;
          interested_id?: string | null;
          conversation_id?: string | null;
          status?: Database["public"]["Enums"]["lead_status"];
          source?: string;
          rating?: number | null;
          last_activity_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leads_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_interested_id_fkey";
            columns: ["interested_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      listing_contacts: {
        Row: {
          listing_id: string;
          contact_email: string | null;
          contact_phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          listing_id: string;
          contact_email?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          listing_id?: string;
          contact_email?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "listing_contacts_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: true;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
        ];
      };
      listing_inquiries: {
        Row: {
          id: string;
          listing_id: string;
          sender_id: string | null;
          conversation_id: string | null;
          message: string;
          phone: string | null;
          wants_viewing: boolean;
          wants_dossier: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          listing_id: string;
          sender_id?: string | null;
          conversation_id?: string | null;
          message: string;
          phone?: string | null;
          wants_viewing?: boolean;
          wants_dossier?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          listing_id?: string;
          sender_id?: string | null;
          conversation_id?: string | null;
          message?: string;
          phone?: string | null;
          wants_viewing?: boolean;
          wants_dossier?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "listing_inquiries_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_inquiries_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_inquiries_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      listing_status_history: {
        Row: {
          id: string;
          listing_id: string;
          from_status: Database["public"]["Enums"]["listing_status"] | null;
          to_status: Database["public"]["Enums"]["listing_status"];
          changed_by: string | null;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          listing_id: string;
          from_status?: Database["public"]["Enums"]["listing_status"] | null;
          to_status: Database["public"]["Enums"]["listing_status"];
          changed_by?: string | null;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          listing_id?: string;
          from_status?: Database["public"]["Enums"]["listing_status"] | null;
          to_status?: Database["public"]["Enums"]["listing_status"];
          changed_by?: string | null;
          reason?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "listing_status_history_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_status_history_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
        ];
      };
      listing_views: {
        Row: {
          id: number;
          listing_id: string;
          viewer_hash: string;
          view_date: string;
          is_authenticated: boolean;
          created_at: string;
        };
        Insert: {
          id?: number;
          listing_id: string;
          viewer_hash: string;
          view_date?: string;
          is_authenticated?: boolean;
          created_at?: string;
        };
        Update: {
          id?: number;
          listing_id?: string;
          viewer_hash?: string;
          view_date?: string;
          is_authenticated?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "listing_views_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
        ];
      };
      listings: {
        Row: {
          id: string;
          property_id: string;
          owner_id: string;
          organization_id: string | null;
          slug: string | null;
          offer_type: Database["public"]["Enums"]["offer_type"];
          status: Database["public"]["Enums"]["listing_status"];
          moderation_status: Database["public"]["Enums"]["moderation_status"];
          moderation_reason: string | null;
          approved_at: string | null;
          approved_by: string | null;
          title: string | null;
          short_description: string | null;
          description: string | null;
          location_description: string | null;
          equipment_description: string | null;
          highlights: string[];
          search_summary: string | null;
          texts_confirmed_at: string | null;
          price: number | null;
          price_on_request: boolean;
          additional_costs: number | null;
          parking_price: number | null;
          location_precision: Database["public"]["Enums"]["location_precision"];
          public_address: string | null;
          public_latitude: number | null;
          public_longitude: number | null;
          contact_name: string | null;
          show_contact_phone: boolean;
          dossier_public: boolean;
          property_type: Database["public"]["Enums"]["property_type"];
          postal_code: string | null;
          municipality: string | null;
          canton: string | null;
          rooms: number | null;
          living_area: number | null;
          usable_area: number | null;
          plot_area: number | null;
          year_built: number | null;
          year_renovated: number | null;
          floor: number | null;
          floors_total: number | null;
          bathrooms: number | null;
          condition: Database["public"]["Enums"]["property_condition"] | null;
          heating_type: Database["public"]["Enums"]["heating_type"] | null;
          energy_label: string | null;
          has_balcony: boolean;
          has_terrace: boolean;
          has_garden: boolean;
          has_garage: boolean;
          has_elevator: boolean;
          has_cellar: boolean;
          has_attic: boolean;
          is_wheelchair_accessible: boolean;
          is_minergie: boolean;
          pets_allowed: boolean | null;
          parking_spaces: number;
          available_from: string | null;
          available_by_arrangement: boolean;
          ownership_type: Database["public"]["Enums"]["ownership_type"] | null;
          view_count: number;
          published_at: string | null;
          first_published_at: string | null;
          closed_at: string | null;
          status_changed_at: string;
          is_demo: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          property_id: string;
          owner_id: string;
          organization_id?: string | null;
          slug?: string | null;
          offer_type: Database["public"]["Enums"]["offer_type"];
          status?: Database["public"]["Enums"]["listing_status"];
          moderation_status?: Database["public"]["Enums"]["moderation_status"];
          moderation_reason?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          title?: string | null;
          short_description?: string | null;
          description?: string | null;
          location_description?: string | null;
          equipment_description?: string | null;
          highlights?: string[];
          search_summary?: string | null;
          texts_confirmed_at?: string | null;
          price?: number | null;
          price_on_request?: boolean;
          additional_costs?: number | null;
          parking_price?: number | null;
          location_precision?: Database["public"]["Enums"]["location_precision"];
          public_address?: string | null;
          public_latitude?: number | null;
          public_longitude?: number | null;
          contact_name?: string | null;
          show_contact_phone?: boolean;
          dossier_public?: boolean;
          property_type?: Database["public"]["Enums"]["property_type"];
          postal_code?: string | null;
          municipality?: string | null;
          canton?: string | null;
          rooms?: number | null;
          living_area?: number | null;
          usable_area?: number | null;
          plot_area?: number | null;
          year_built?: number | null;
          year_renovated?: number | null;
          floor?: number | null;
          floors_total?: number | null;
          bathrooms?: number | null;
          condition?: Database["public"]["Enums"]["property_condition"] | null;
          heating_type?: Database["public"]["Enums"]["heating_type"] | null;
          energy_label?: string | null;
          has_balcony?: boolean;
          has_terrace?: boolean;
          has_garden?: boolean;
          has_garage?: boolean;
          has_elevator?: boolean;
          has_cellar?: boolean;
          has_attic?: boolean;
          is_wheelchair_accessible?: boolean;
          is_minergie?: boolean;
          pets_allowed?: boolean | null;
          parking_spaces?: number;
          available_from?: string | null;
          available_by_arrangement?: boolean;
          ownership_type?: Database["public"]["Enums"]["ownership_type"] | null;
          view_count?: number;
          published_at?: string | null;
          first_published_at?: string | null;
          closed_at?: string | null;
          status_changed_at?: string;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          property_id?: string;
          owner_id?: string;
          organization_id?: string | null;
          slug?: string | null;
          offer_type?: Database["public"]["Enums"]["offer_type"];
          status?: Database["public"]["Enums"]["listing_status"];
          moderation_status?: Database["public"]["Enums"]["moderation_status"];
          moderation_reason?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          title?: string | null;
          short_description?: string | null;
          description?: string | null;
          location_description?: string | null;
          equipment_description?: string | null;
          highlights?: string[];
          search_summary?: string | null;
          texts_confirmed_at?: string | null;
          price?: number | null;
          price_on_request?: boolean;
          additional_costs?: number | null;
          parking_price?: number | null;
          location_precision?: Database["public"]["Enums"]["location_precision"];
          public_address?: string | null;
          public_latitude?: number | null;
          public_longitude?: number | null;
          contact_name?: string | null;
          show_contact_phone?: boolean;
          dossier_public?: boolean;
          property_type?: Database["public"]["Enums"]["property_type"];
          postal_code?: string | null;
          municipality?: string | null;
          canton?: string | null;
          rooms?: number | null;
          living_area?: number | null;
          usable_area?: number | null;
          plot_area?: number | null;
          year_built?: number | null;
          year_renovated?: number | null;
          floor?: number | null;
          floors_total?: number | null;
          bathrooms?: number | null;
          condition?: Database["public"]["Enums"]["property_condition"] | null;
          heating_type?: Database["public"]["Enums"]["heating_type"] | null;
          energy_label?: string | null;
          has_balcony?: boolean;
          has_terrace?: boolean;
          has_garden?: boolean;
          has_garage?: boolean;
          has_elevator?: boolean;
          has_cellar?: boolean;
          has_attic?: boolean;
          is_wheelchair_accessible?: boolean;
          is_minergie?: boolean;
          pets_allowed?: boolean | null;
          parking_spaces?: number;
          available_from?: string | null;
          available_by_arrangement?: boolean;
          ownership_type?: Database["public"]["Enums"]["ownership_type"] | null;
          view_count?: number;
          published_at?: string | null;
          first_published_at?: string | null;
          closed_at?: string | null;
          status_changed_at?: string;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "listings_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listings_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listings_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listings_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string | null;
          kind: string;
          body: string;
          attachment_path: string | null;
          attachment_name: string | null;
          attachment_mime: string | null;
          attachment_size: number | null;
          created_at: string;
          edited_at: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id?: string | null;
          kind?: string;
          body: string;
          attachment_path?: string | null;
          attachment_name?: string | null;
          attachment_mime?: string | null;
          attachment_size?: number | null;
          created_at?: string;
          edited_at?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender_id?: string | null;
          kind?: string;
          body?: string;
          attachment_path?: string | null;
          attachment_name?: string | null;
          attachment_mime?: string | null;
          attachment_size?: number | null;
          created_at?: string;
          edited_at?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      moderation_actions: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          target_type: string;
          target_id: string;
          reason: string | null;
          report_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          action: string;
          target_type: string;
          target_id: string;
          reason?: string | null;
          report_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          action?: string;
          target_type?: string;
          target_id?: string;
          reason?: string | null;
          report_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "moderation_actions_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "moderation_actions_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "user_reports";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          body: string | null;
          link: string | null;
          data: Json;
          group_key: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          title: string;
          body?: string | null;
          link?: string | null;
          data?: Json;
          group_key?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          title?: string;
          body?: string | null;
          link?: string | null;
          data?: Json;
          group_key?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_invitations: {
        Row: {
          id: string;
          organization_id: string;
          email: string;
          role: Database["public"]["Enums"]["org_role"];
          token_hash: string;
          invited_by: string | null;
          expires_at: string;
          accepted_at: string | null;
          accepted_by: string | null;
          revoked_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          email: string;
          role?: Database["public"]["Enums"]["org_role"];
          token_hash: string;
          invited_by?: string | null;
          expires_at?: string;
          accepted_at?: string | null;
          accepted_by?: string | null;
          revoked_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          email?: string;
          role?: Database["public"]["Enums"]["org_role"];
          token_hash?: string;
          invited_by?: string | null;
          expires_at?: string;
          accepted_at?: string | null;
          accepted_by?: string | null;
          revoked_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_invitations_accepted_by_fkey";
            columns: ["accepted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_invitations_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_invitations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_members: {
        Row: {
          organization_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["org_role"];
          invited_by: string | null;
          created_at: string;
        };
        Insert: {
          organization_id: string;
          user_id: string;
          role?: Database["public"]["Enums"]["org_role"];
          invited_by?: string | null;
          created_at?: string;
        };
        Update: {
          organization_id?: string;
          user_id?: string;
          role?: Database["public"]["Enums"]["org_role"];
          invited_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_members_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          logo_path: string | null;
          description: string | null;
          street: string | null;
          postal_code: string | null;
          city: string | null;
          canton: string | null;
          phone: string | null;
          email: string | null;
          website: string | null;
          uid_number: string | null;
          is_public: boolean;
          status: string;
          plan_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          logo_path?: string | null;
          description?: string | null;
          street?: string | null;
          postal_code?: string | null;
          city?: string | null;
          canton?: string | null;
          phone?: string | null;
          email?: string | null;
          website?: string | null;
          uid_number?: string | null;
          is_public?: boolean;
          status?: string;
          plan_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          logo_path?: string | null;
          description?: string | null;
          street?: string | null;
          postal_code?: string | null;
          city?: string | null;
          canton?: string | null;
          phone?: string | null;
          email?: string | null;
          website?: string | null;
          uid_number?: string | null;
          is_public?: boolean;
          status?: string;
          plan_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_transactions: {
        Row: {
          id: string;
          subscription_id: string | null;
          amount: number;
          currency: string;
          status: string;
          provider: string | null;
          provider_reference: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          subscription_id?: string | null;
          amount: number;
          currency?: string;
          status: string;
          provider?: string | null;
          provider_reference?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          subscription_id?: string | null;
          amount?: number;
          currency?: string;
          status?: string;
          provider?: string | null;
          provider_reference?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_transactions_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      plans: {
        Row: {
          id: string;
          name: string;
          audience: string;
          price_chf_monthly: number;
          limits: Json;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          audience: string;
          price_chf_monthly?: number;
          limits?: Json;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          audience?: string;
          price_chf_monthly?: number;
          limits?: Json;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string | null;
          email_verified_at: string | null;
          first_name: string | null;
          last_name: string | null;
          display_name: string;
          phone: string | null;
          avatar_path: string | null;
          account_type: Database["public"]["Enums"]["account_type"];
          status: Database["public"]["Enums"]["user_status"];
          status_reason: string | null;
          status_changed_at: string | null;
          locale: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          email?: string | null;
          email_verified_at?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          display_name?: string;
          phone?: string | null;
          avatar_path?: string | null;
          account_type?: Database["public"]["Enums"]["account_type"];
          status?: Database["public"]["Enums"]["user_status"];
          status_reason?: string | null;
          status_changed_at?: string | null;
          locale?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          email?: string | null;
          email_verified_at?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          display_name?: string;
          phone?: string | null;
          avatar_path?: string | null;
          account_type?: Database["public"]["Enums"]["account_type"];
          status?: Database["public"]["Enums"]["user_status"];
          status_reason?: string | null;
          status_changed_at?: string | null;
          locale?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      properties: {
        Row: {
          id: string;
          owner_id: string;
          organization_id: string | null;
          property_type: Database["public"]["Enums"]["property_type"];
          offer_type: Database["public"]["Enums"]["offer_type"];
          internal_name: string | null;
          street: string | null;
          house_number: string | null;
          postal_code: string | null;
          municipality: string | null;
          canton: string | null;
          latitude: number | null;
          longitude: number | null;
          egid: number | null;
          rooms: number | null;
          living_area: number | null;
          gross_living_area: number | null;
          usable_area: number | null;
          plot_area: number | null;
          year_built: number | null;
          year_renovated: number | null;
          floor: number | null;
          floors_total: number | null;
          bathrooms: number | null;
          condition: Database["public"]["Enums"]["property_condition"] | null;
          heating_type: Database["public"]["Enums"]["heating_type"] | null;
          energy_label: string | null;
          energy_demand_kwh: number | null;
          has_balcony: boolean;
          has_terrace: boolean;
          has_garden: boolean;
          has_garage: boolean;
          has_elevator: boolean;
          has_cellar: boolean;
          has_attic: boolean;
          is_wheelchair_accessible: boolean;
          is_minergie: boolean;
          pets_allowed: boolean | null;
          garage_spaces: number;
          underground_parking_spaces: number;
          outdoor_parking_spaces: number;
          available_from: string | null;
          available_by_arrangement: boolean;
          service_charges: number | null;
          ownership_type: Database["public"]["Enums"]["ownership_type"] | null;
          special_features: string | null;
          view_description: string | null;
          wizard_step: number;
          is_demo: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          organization_id?: string | null;
          property_type?: Database["public"]["Enums"]["property_type"];
          offer_type?: Database["public"]["Enums"]["offer_type"];
          internal_name?: string | null;
          street?: string | null;
          house_number?: string | null;
          postal_code?: string | null;
          municipality?: string | null;
          canton?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          egid?: number | null;
          rooms?: number | null;
          living_area?: number | null;
          gross_living_area?: number | null;
          usable_area?: number | null;
          plot_area?: number | null;
          year_built?: number | null;
          year_renovated?: number | null;
          floor?: number | null;
          floors_total?: number | null;
          bathrooms?: number | null;
          condition?: Database["public"]["Enums"]["property_condition"] | null;
          heating_type?: Database["public"]["Enums"]["heating_type"] | null;
          energy_label?: string | null;
          energy_demand_kwh?: number | null;
          has_balcony?: boolean;
          has_terrace?: boolean;
          has_garden?: boolean;
          has_garage?: boolean;
          has_elevator?: boolean;
          has_cellar?: boolean;
          has_attic?: boolean;
          is_wheelchair_accessible?: boolean;
          is_minergie?: boolean;
          pets_allowed?: boolean | null;
          garage_spaces?: number;
          underground_parking_spaces?: number;
          outdoor_parking_spaces?: number;
          available_from?: string | null;
          available_by_arrangement?: boolean;
          service_charges?: number | null;
          ownership_type?: Database["public"]["Enums"]["ownership_type"] | null;
          special_features?: string | null;
          view_description?: string | null;
          wizard_step?: number;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          owner_id?: string;
          organization_id?: string | null;
          property_type?: Database["public"]["Enums"]["property_type"];
          offer_type?: Database["public"]["Enums"]["offer_type"];
          internal_name?: string | null;
          street?: string | null;
          house_number?: string | null;
          postal_code?: string | null;
          municipality?: string | null;
          canton?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          egid?: number | null;
          rooms?: number | null;
          living_area?: number | null;
          gross_living_area?: number | null;
          usable_area?: number | null;
          plot_area?: number | null;
          year_built?: number | null;
          year_renovated?: number | null;
          floor?: number | null;
          floors_total?: number | null;
          bathrooms?: number | null;
          condition?: Database["public"]["Enums"]["property_condition"] | null;
          heating_type?: Database["public"]["Enums"]["heating_type"] | null;
          energy_label?: string | null;
          energy_demand_kwh?: number | null;
          has_balcony?: boolean;
          has_terrace?: boolean;
          has_garden?: boolean;
          has_garage?: boolean;
          has_elevator?: boolean;
          has_cellar?: boolean;
          has_attic?: boolean;
          is_wheelchair_accessible?: boolean;
          is_minergie?: boolean;
          pets_allowed?: boolean | null;
          garage_spaces?: number;
          underground_parking_spaces?: number;
          outdoor_parking_spaces?: number;
          available_from?: string | null;
          available_by_arrangement?: boolean;
          service_charges?: number | null;
          ownership_type?: Database["public"]["Enums"]["ownership_type"] | null;
          special_features?: string | null;
          view_description?: string | null;
          wizard_step?: number;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "properties_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "properties_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      property_documents: {
        Row: {
          id: string;
          property_id: string;
          uploaded_by: string | null;
          category: Database["public"]["Enums"]["document_category"];
          title: string;
          storage_path: string;
          file_name: string | null;
          mime_type: string;
          size_bytes: number;
          visibility: Database["public"]["Enums"]["document_visibility"];
          contains_personal_data: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          property_id: string;
          uploaded_by?: string | null;
          category?: Database["public"]["Enums"]["document_category"];
          title: string;
          storage_path: string;
          file_name?: string | null;
          mime_type: string;
          size_bytes: number;
          visibility?: Database["public"]["Enums"]["document_visibility"];
          contains_personal_data?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          property_id?: string;
          uploaded_by?: string | null;
          category?: Database["public"]["Enums"]["document_category"];
          title?: string;
          storage_path?: string;
          file_name?: string | null;
          mime_type?: string;
          size_bytes?: number;
          visibility?: Database["public"]["Enums"]["document_visibility"];
          contains_personal_data?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "property_documents_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_documents_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      property_features: {
        Row: {
          property_id: string;
          feature_key: string;
          created_at: string;
        };
        Insert: {
          property_id: string;
          feature_key: string;
          created_at?: string;
        };
        Update: {
          property_id?: string;
          feature_key?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "property_features_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      property_images: {
        Row: {
          id: string;
          property_id: string;
          uploaded_by: string | null;
          original_path: string | null;
          base_path: string | null;
          display_path: string | null;
          thumb_path: string | null;
          external_url: string | null;
          width: number | null;
          height: number | null;
          size_bytes: number | null;
          mime_type: string | null;
          sort_order: number;
          is_cover: boolean;
          caption: string | null;
          is_floor_plan: boolean;
          is_enhanced: boolean;
          is_ai_visualization: boolean;
          source_image_id: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          uploaded_by?: string | null;
          original_path?: string | null;
          base_path?: string | null;
          display_path?: string | null;
          thumb_path?: string | null;
          external_url?: string | null;
          width?: number | null;
          height?: number | null;
          size_bytes?: number | null;
          mime_type?: string | null;
          sort_order?: number;
          is_cover?: boolean;
          caption?: string | null;
          is_floor_plan?: boolean;
          is_enhanced?: boolean;
          is_ai_visualization?: boolean;
          source_image_id?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          uploaded_by?: string | null;
          original_path?: string | null;
          base_path?: string | null;
          display_path?: string | null;
          thumb_path?: string | null;
          external_url?: string | null;
          width?: number | null;
          height?: number | null;
          size_bytes?: number | null;
          mime_type?: string | null;
          sort_order?: number;
          is_cover?: boolean;
          caption?: string | null;
          is_floor_plan?: boolean;
          is_enhanced?: boolean;
          is_ai_visualization?: boolean;
          source_image_id?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "property_images_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_images_source_image_id_fkey";
            columns: ["source_image_id"];
            isOneToOne: false;
            referencedRelation: "property_images";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_images_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      property_renovations: {
        Row: {
          id: string;
          property_id: string;
          year: number;
          category: string;
          description: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          year: number;
          category?: string;
          description: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          year?: number;
          category?: string;
          description?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "property_renovations_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      property_valuations: {
        Row: {
          id: string;
          property_id: string;
          requested_by: string | null;
          status: Database["public"]["Enums"]["valuation_status"];
          method: string;
          provider: string;
          price_basis: string;
          estimated_value: number | null;
          value_low: number | null;
          value_high: number | null;
          suggested_list_price: number | null;
          currency: string;
          confidence: Database["public"]["Enums"]["confidence_level"];
          confidence_explanation: string | null;
          data_quality: Json;
          positive_factors: Json;
          negative_factors: Json;
          explanation: string | null;
          ai_model: string | null;
          input_snapshot: Json;
          disclaimer: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          requested_by?: string | null;
          status: Database["public"]["Enums"]["valuation_status"];
          method: string;
          provider: string;
          price_basis?: string;
          estimated_value?: number | null;
          value_low?: number | null;
          value_high?: number | null;
          suggested_list_price?: number | null;
          currency?: string;
          confidence?: Database["public"]["Enums"]["confidence_level"];
          confidence_explanation?: string | null;
          data_quality?: Json;
          positive_factors?: Json;
          negative_factors?: Json;
          explanation?: string | null;
          ai_model?: string | null;
          input_snapshot?: Json;
          disclaimer: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          requested_by?: string | null;
          status?: Database["public"]["Enums"]["valuation_status"];
          method?: string;
          provider?: string;
          price_basis?: string;
          estimated_value?: number | null;
          value_low?: number | null;
          value_high?: number | null;
          suggested_list_price?: number | null;
          currency?: string;
          confidence?: Database["public"]["Enums"]["confidence_level"];
          confidence_explanation?: string | null;
          data_quality?: Json;
          positive_factors?: Json;
          negative_factors?: Json;
          explanation?: string | null;
          ai_model?: string | null;
          input_snapshot?: Json;
          disclaimer?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "property_valuations_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_valuations_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      public_profiles: {
        Row: {
          id: string;
          display_name: string;
          avatar_path: string | null;
          account_type: Database["public"]["Enums"]["account_type"];
          organization_id: string | null;
          member_since: string;
          email_verified: boolean;
          identity_verified: boolean;
          has_public_listings: boolean;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          avatar_path?: string | null;
          account_type?: Database["public"]["Enums"]["account_type"];
          organization_id?: string | null;
          member_since?: string;
          email_verified?: boolean;
          identity_verified?: boolean;
          has_public_listings?: boolean;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          avatar_path?: string | null;
          account_type?: Database["public"]["Enums"]["account_type"];
          organization_id?: string | null;
          member_since?: string;
          email_verified?: boolean;
          identity_verified?: boolean;
          has_public_listings?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "public_profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "public_profiles_organization_fk";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      rate_limit_buckets: {
        Row: {
          key: string;
          window_start: string;
          hits: number;
        };
        Insert: {
          key: string;
          window_start: string;
          hits?: number;
        };
        Update: {
          key?: string;
          window_start?: string;
          hits?: number;
        };
        Relationships: [];
      };
      saved_search_matches: {
        Row: {
          saved_search_id: string;
          listing_id: string;
          matched_at: string;
          notified_at: string | null;
        };
        Insert: {
          saved_search_id: string;
          listing_id: string;
          matched_at?: string;
          notified_at?: string | null;
        };
        Update: {
          saved_search_id?: string;
          listing_id?: string;
          matched_at?: string;
          notified_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "saved_search_matches_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "saved_search_matches_saved_search_id_fkey";
            columns: ["saved_search_id"];
            isOneToOne: false;
            referencedRelation: "saved_searches";
            referencedColumns: ["id"];
          },
        ];
      };
      saved_searches: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          criteria: Json;
          alert_enabled: boolean;
          alert_frequency: string;
          last_notified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          criteria?: Json;
          alert_enabled?: boolean;
          alert_frequency?: string;
          last_notified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          criteria?: Json;
          alert_enabled?: boolean;
          alert_frequency?: string;
          last_notified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saved_searches_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string | null;
          organization_id: string | null;
          plan_id: string;
          status: string;
          provider: string | null;
          provider_reference: string | null;
          current_period_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          organization_id?: string | null;
          plan_id: string;
          status: string;
          provider?: string | null;
          provider_reference?: string | null;
          current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          organization_id?: string | null;
          plan_id?: string;
          status?: string;
          provider?: string | null;
          provider_reference?: string | null;
          current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_blocks: {
        Row: {
          blocker_id: string;
          blocked_id: string;
          created_at: string;
        };
        Insert: {
          blocker_id?: string;
          blocked_id: string;
          created_at?: string;
        };
        Update: {
          blocker_id?: string;
          blocked_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_id_fkey";
            columns: ["blocked_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey";
            columns: ["blocker_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_notification_settings: {
        Row: {
          user_id: string;
          email_new_message: boolean;
          email_new_inquiry: boolean;
          email_viewings: boolean;
          email_search_alerts: boolean;
          email_listing_updates: boolean;
          email_documents: boolean;
          email_product_news: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          email_new_message?: boolean;
          email_new_inquiry?: boolean;
          email_viewings?: boolean;
          email_search_alerts?: boolean;
          email_listing_updates?: boolean;
          email_documents?: boolean;
          email_product_news?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          email_new_message?: boolean;
          email_new_inquiry?: boolean;
          email_viewings?: boolean;
          email_search_alerts?: boolean;
          email_listing_updates?: boolean;
          email_documents?: boolean;
          email_product_news?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_notification_settings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_preferences: {
        Row: {
          user_id: string;
          default_offer_type: Database["public"]["Enums"]["offer_type"] | null;
          default_location_label: string | null;
          analytics_consent: boolean;
          marketing_consent: boolean;
          ai_processing_consent: boolean;
          ai_image_consent: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          default_offer_type?: Database["public"]["Enums"]["offer_type"] | null;
          default_location_label?: string | null;
          analytics_consent?: boolean;
          marketing_consent?: boolean;
          ai_processing_consent?: boolean;
          ai_image_consent?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          default_offer_type?: Database["public"]["Enums"]["offer_type"] | null;
          default_location_label?: string | null;
          analytics_consent?: boolean;
          marketing_consent?: boolean;
          ai_processing_consent?: boolean;
          ai_image_consent?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_reports: {
        Row: {
          id: string;
          reporter_id: string | null;
          target_type: string;
          target_id: string;
          reason: string;
          details: string | null;
          status: Database["public"]["Enums"]["report_status"];
          handled_by: string | null;
          handled_at: string | null;
          resolution_note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          reporter_id?: string | null;
          target_type: string;
          target_id: string;
          reason: string;
          details?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
          handled_by?: string | null;
          handled_at?: string | null;
          resolution_note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          reporter_id?: string | null;
          target_type?: string;
          target_id?: string;
          reason?: string;
          details?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
          handled_by?: string | null;
          handled_at?: string | null;
          resolution_note?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_reports_handled_by_fkey";
            columns: ["handled_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          user_id: string;
          role: Database["public"]["Enums"]["app_role"];
          granted_by: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          role: Database["public"]["Enums"]["app_role"];
          granted_by?: string | null;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          granted_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_roles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      valuation_comparables: {
        Row: {
          id: string;
          valuation_id: string;
          kind: string;
          listing_id: string | null;
          external_ref: string | null;
          property_type: Database["public"]["Enums"]["property_type"] | null;
          municipality: string | null;
          postal_code: string | null;
          rooms: number | null;
          living_area: number | null;
          price: number;
          price_per_sqm: number | null;
          observed_at: string;
          distance_km: number | null;
          similarity: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          valuation_id: string;
          kind: string;
          listing_id?: string | null;
          external_ref?: string | null;
          property_type?: Database["public"]["Enums"]["property_type"] | null;
          municipality?: string | null;
          postal_code?: string | null;
          rooms?: number | null;
          living_area?: number | null;
          price: number;
          price_per_sqm?: number | null;
          observed_at: string;
          distance_km?: number | null;
          similarity?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          valuation_id?: string;
          kind?: string;
          listing_id?: string | null;
          external_ref?: string | null;
          property_type?: Database["public"]["Enums"]["property_type"] | null;
          municipality?: string | null;
          postal_code?: string | null;
          rooms?: number | null;
          living_area?: number | null;
          price?: number;
          price_per_sqm?: number | null;
          observed_at?: string;
          distance_km?: number | null;
          similarity?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "valuation_comparables_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "valuation_comparables_valuation_id_fkey";
            columns: ["valuation_id"];
            isOneToOne: false;
            referencedRelation: "property_valuations";
            referencedColumns: ["id"];
          },
        ];
      };
      valuation_sources: {
        Row: {
          id: string;
          valuation_id: string;
          source_type: string;
          name: string;
          description: string | null;
          data_as_of: string | null;
          record_count: number | null;
          license_note: string | null;
          url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          valuation_id: string;
          source_type: string;
          name: string;
          description?: string | null;
          data_as_of?: string | null;
          record_count?: number | null;
          license_note?: string | null;
          url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          valuation_id?: string;
          source_type?: string;
          name?: string;
          description?: string | null;
          data_as_of?: string | null;
          record_count?: number | null;
          license_note?: string | null;
          url?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "valuation_sources_valuation_id_fkey";
            columns: ["valuation_id"];
            isOneToOne: false;
            referencedRelation: "property_valuations";
            referencedColumns: ["id"];
          },
        ];
      };
      verifications: {
        Row: {
          id: string;
          subject_type: string;
          subject_id: string;
          kind: Database["public"]["Enums"]["verification_kind"];
          status: Database["public"]["Enums"]["verification_status"];
          method: string | null;
          notes: string | null;
          verified_by: string | null;
          verified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          subject_type: string;
          subject_id: string;
          kind: Database["public"]["Enums"]["verification_kind"];
          status?: Database["public"]["Enums"]["verification_status"];
          method?: string | null;
          notes?: string | null;
          verified_by?: string | null;
          verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          subject_type?: string;
          subject_id?: string;
          kind?: Database["public"]["Enums"]["verification_kind"];
          status?: Database["public"]["Enums"]["verification_status"];
          method?: string | null;
          notes?: string | null;
          verified_by?: string | null;
          verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "verifications_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      viewing_appointment_notes: {
        Row: {
          id: string;
          appointment_id: string;
          author_id: string | null;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          appointment_id: string;
          author_id?: string | null;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          appointment_id?: string;
          author_id?: string | null;
          body?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "viewing_appointment_notes_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "viewing_appointments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "viewing_appointment_notes_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      viewing_appointments: {
        Row: {
          id: string;
          slot_id: string | null;
          listing_id: string;
          owner_id: string;
          organization_id: string | null;
          guest_id: string | null;
          conversation_id: string | null;
          starts_at: string;
          ends_at: string;
          status: Database["public"]["Enums"]["appointment_status"];
          guest_message: string | null;
          cancel_reason: string | null;
          cancelled_by: string | null;
          confirmed_at: string | null;
          cancelled_at: string | null;
          completed_at: string | null;
          reminder_sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slot_id?: string | null;
          listing_id: string;
          owner_id: string;
          organization_id?: string | null;
          guest_id?: string | null;
          conversation_id?: string | null;
          starts_at: string;
          ends_at: string;
          status?: Database["public"]["Enums"]["appointment_status"];
          guest_message?: string | null;
          cancel_reason?: string | null;
          cancelled_by?: string | null;
          confirmed_at?: string | null;
          cancelled_at?: string | null;
          completed_at?: string | null;
          reminder_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slot_id?: string | null;
          listing_id?: string;
          owner_id?: string;
          organization_id?: string | null;
          guest_id?: string | null;
          conversation_id?: string | null;
          starts_at?: string;
          ends_at?: string;
          status?: Database["public"]["Enums"]["appointment_status"];
          guest_message?: string | null;
          cancel_reason?: string | null;
          cancelled_by?: string | null;
          confirmed_at?: string | null;
          cancelled_at?: string | null;
          completed_at?: string | null;
          reminder_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "viewing_appointments_cancelled_by_fkey";
            columns: ["cancelled_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "viewing_appointments_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "viewing_appointments_guest_id_fkey";
            columns: ["guest_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "viewing_appointments_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "viewing_appointments_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "viewing_appointments_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "viewing_appointments_slot_id_fkey";
            columns: ["slot_id"];
            isOneToOne: false;
            referencedRelation: "viewing_slots";
            referencedColumns: ["id"];
          },
        ];
      };
      viewing_slots: {
        Row: {
          id: string;
          listing_id: string;
          created_by: string | null;
          starts_at: string;
          ends_at: string;
          capacity: number;
          note: string | null;
          is_cancelled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          listing_id: string;
          created_by?: string | null;
          starts_at: string;
          ends_at: string;
          capacity?: number;
          note?: string | null;
          is_cancelled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          listing_id?: string;
          created_by?: string | null;
          starts_at?: string;
          ends_at?: string;
          capacity?: number;
          note?: string | null;
          is_cancelled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "viewing_slots_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "viewing_slots_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_organization_invitation: {
        Args: { p_token: string };
        Returns: string;
      };
      admin_ai_usage_summary: {
        Args: { p_days?: number };
        Returns: Json;
      };
      admin_get_report_target: {
        Args: { p_report_id: string };
        Returns: Json;
      };
      admin_moderate_listing: {
        Args: { p_listing_id: string; p_action: string; p_reason?: string };
        Returns: undefined;
      };
      admin_platform_stats: {
        Args: never;
        Returns: Json;
      };
      admin_search_users: {
        Args: { p_query?: string; p_status?: Database["public"]["Enums"]["user_status"]; p_role?: Database["public"]["Enums"]["app_role"]; p_user_id?: string; p_limit?: number; p_offset?: number };
        Returns: {
          id: string | null;
          email: string | null;
          display_name: string | null;
          first_name: string | null;
          last_name: string | null;
          phone: string | null;
          account_type: Database["public"]["Enums"]["account_type"] | null;
          status: Database["public"]["Enums"]["user_status"] | null;
          status_reason: string | null;
          status_changed_at: string | null;
          created_at: string | null;
          last_sign_in_at: string | null;
          email_confirmed: boolean | null;
          roles: Database["public"]["Enums"]["app_role"][] | null;
          identity_verified: boolean | null;
          listing_count: number | null;
          total_count: number | null;
        }[];
      };
      admin_set_org_status: {
        Args: { p_org_id: string; p_status: string; p_reason?: string };
        Returns: undefined;
      };
      admin_set_role: {
        Args: { p_user_id: string; p_role: Database["public"]["Enums"]["app_role"]; p_grant: boolean };
        Returns: undefined;
      };
      admin_set_user_status: {
        Args: { p_user_id: string; p_status: Database["public"]["Enums"]["user_status"]; p_reason?: string };
        Returns: undefined;
      };
      admin_set_verification: {
        Args: { p_subject_type: string; p_subject_id: string; p_kind: Database["public"]["Enums"]["verification_kind"]; p_status: Database["public"]["Enums"]["verification_status"]; p_method?: string; p_notes?: string };
        Returns: string;
      };
      admin_timeseries: {
        Args: { p_days?: number };
        Returns: Json;
      };
      admin_update_contact_request: {
        Args: { p_request_id: string; p_status: string };
        Returns: undefined;
      };
      admin_update_report: {
        Args: { p_report_id: string; p_status: Database["public"]["Enums"]["report_status"]; p_note?: string };
        Returns: undefined;
      };
      admin_update_setting: {
        Args: { p_key: string; p_value: Json };
        Returns: undefined;
      };
      assert_listing_transition: {
        Args: { p_from: Database["public"]["Enums"]["listing_status"]; p_to: Database["public"]["Enums"]["listing_status"] };
        Returns: undefined;
      };
      book_viewing: {
        Args: { p_slot_id: string; p_message?: string };
        Returns: string;
      };
      can_manage_document: {
        Args: { p_document: string };
        Returns: boolean;
      };
      can_manage_listing: {
        Args: { p_listing: string };
        Returns: boolean;
      };
      can_manage_owner_org: {
        Args: { p_owner: string; p_org: string };
        Returns: boolean;
      };
      can_manage_property: {
        Args: { p_property: string };
        Returns: boolean;
      };
      can_post_in_conversation: {
        Args: { p_conversation: string };
        Returns: boolean;
      };
      can_read_document: {
        Args: { p_document: string };
        Returns: boolean;
      };
      can_read_document_object: {
        Args: { p_path: string };
        Returns: boolean;
      };
      cancel_viewing_slot: {
        Args: { p_slot_id: string; p_reason?: string };
        Returns: number;
      };
      check_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number };
        Returns: boolean;
      };
      claim_emails: {
        Args: { p_limit: number };
        Returns: Database["public"]["Tables"]["email_outbox"]["Row"][];
      };
      claim_job: {
        Args: { p_job_id: string; p_worker: string };
        Returns: Database["public"]["Tables"]["ai_generation_jobs"]["Row"][];
      };
      claim_jobs: {
        Args: { p_limit: number; p_worker: string };
        Returns: Database["public"]["Tables"]["ai_generation_jobs"]["Row"][];
      };
      cleanup_email_outbox: {
        Args: never;
        Returns: number;
      };
      cleanup_rate_limits: {
        Args: never;
        Returns: number;
      };
      create_inquiry: {
        Args: { p_listing_id: string; p_message: string; p_phone?: string; p_wants_viewing?: boolean; p_wants_dossier?: boolean };
        Returns: string;
      };
      create_organization: {
        Args: { p_name: string; p_email?: string; p_phone?: string };
        Returns: string;
      };
      delete_my_account: {
        Args: never;
        Returns: undefined;
      };
      enforce_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number };
        Returns: undefined;
      };
      ensure_conversation: {
        Args: { p_listing: Database["public"]["Tables"]["listings"]["Row"]; p_interested: string };
        Returns: string;
      };
      export_my_data: {
        Args: never;
        Returns: Json;
      };
      feature_setting: {
        Args: { p_key: string };
        Returns: Json;
      };
      format_ch_datetime: {
        Args: { p_ts: string };
        Returns: string;
      };
      get_listing_availability: {
        Args: { p_slug: string };
        Returns: string;
      };
      get_listing_public_contact: {
        Args: { p_listing_id: string };
        Returns: {
          contact_name: string | null;
          contact_phone: string | null;
        }[];
      };
      get_listing_statistics: {
        Args: { p_listing_id: string; p_days?: number };
        Returns: Json;
      };
      get_my_conversations: {
        Args: { p_archived?: boolean };
        Returns: {
          conversation_id: string | null;
          listing_id: string | null;
          listing_title: string | null;
          listing_slug: string | null;
          listing_status: Database["public"]["Enums"]["listing_status"] | null;
          cover_path: string | null;
          cover_external_url: string | null;
          other_user_id: string | null;
          other_display_name: string | null;
          other_avatar_path: string | null;
          my_role: string | null;
          last_message_at: string | null;
          last_message_preview: string | null;
          unread_count: number | null;
          is_archived: boolean | null;
          lead_status: Database["public"]["Enums"]["lead_status"] | null;
        }[];
      };
      get_organization_invitation: {
        Args: { p_token: string };
        Returns: Json;
      };
      get_organization_members: {
        Args: { p_org: string };
        Returns: {
          user_id: string | null;
          role: Database["public"]["Enums"]["org_role"] | null;
          display_name: string | null;
          avatar_path: string | null;
          email: string | null;
          joined_at: string | null;
          is_me: boolean | null;
        }[];
      };
      get_owner_overview: {
        Args: never;
        Returns: Json;
      };
      get_public_verifications: {
        Args: { p_subject_type: string; p_subject_id: string };
        Returns: {
          kind: Database["public"]["Enums"]["verification_kind"] | null;
          verified_at: string | null;
        }[];
      };
      get_unread_counts: {
        Args: never;
        Returns: Json;
      };
      get_viewing_slots: {
        Args: { p_listing_id: string };
        Returns: {
          id: string | null;
          starts_at: string | null;
          ends_at: string | null;
          capacity: number | null;
          booked: number | null;
          available: number | null;
          note: string | null;
          my_appointment_id: string | null;
          my_status: Database["public"]["Enums"]["appointment_status"] | null;
        }[];
      };
      grant_document_access: {
        Args: { p_document_id: string; p_grantee_id: string; p_expires_at?: string };
        Returns: string;
      };
      invite_organization_member: {
        Args: { p_org: string; p_email: string; p_role?: Database["public"]["Enums"]["org_role"] };
        Returns: string;
      };
      is_active_user: {
        Args: never;
        Returns: boolean;
      };
      is_admin: {
        Args: never;
        Returns: boolean;
      };
      is_conversation_participant: {
        Args: { p_conversation: string };
        Returns: boolean;
      };
      is_listing_public: {
        Args: { p_listing: string };
        Returns: boolean;
      };
      is_moderator: {
        Args: never;
        Returns: boolean;
      };
      is_org_admin: {
        Args: { p_org: string };
        Returns: boolean;
      };
      is_org_member: {
        Args: { p_org: string };
        Returns: boolean;
      };
      is_privileged_context: {
        Args: never;
        Returns: boolean;
      };
      is_property_public: {
        Args: { p_property: string };
        Returns: boolean;
      };
      is_public_dossier_object: {
        Args: { p_path: string };
        Returns: boolean;
      };
      move_viewing: {
        Args: { p_appointment_id: string; p_new_slot_id: string };
        Returns: undefined;
      };
      my_saved_search_count: {
        Args: never;
        Returns: number;
      };
      notify_user: {
        Args: { p_user: string; p_type: string; p_title: string; p_body: string; p_link: string; p_data?: Json; p_group_key?: string };
        Returns: undefined;
      };
      post_system_message: {
        Args: { p_conversation: string; p_sender: string; p_body: string };
        Returns: undefined;
      };
      property_type_slug: {
        Args: { p_type: Database["public"]["Enums"]["property_type"] };
        Returns: string;
      };
      purge_deleted_properties: {
        Args: never;
        Returns: number;
      };
      queue_email: {
        Args: { p_user: string; p_template: string; p_payload: Json; p_setting?: string; p_dedupe_key?: string; p_delay?: string };
        Returns: undefined;
      };
      queue_search_alerts: {
        Args: { p_listing_id: string };
        Returns: number;
      };
      record_listing_view: {
        Args: { p_listing_id: string; p_viewer_hash: string; p_authenticated?: boolean };
        Returns: boolean;
      };
      revoke_document_access: {
        Args: { p_grant_id: string };
        Returns: undefined;
      };
      revoke_organization_invitation: {
        Args: { p_invitation_id: string };
        Returns: undefined;
      };
      saved_search_matches_listing: {
        Args: { p_criteria: Json; p_listing_id: string };
        Returns: boolean;
      };
      search_listings: {
        Args: { p_offer_type?: Database["public"]["Enums"]["offer_type"]; p_property_types?: Database["public"]["Enums"]["property_type"][]; p_canton?: string; p_municipality?: string; p_postal_code?: string; p_query?: string; p_lat?: number; p_lng?: number; p_radius_km?: number; p_bbox?: number[]; p_price_min?: number; p_price_max?: number; p_rooms_min?: number; p_rooms_max?: number; p_area_min?: number; p_area_max?: number; p_plot_min?: number; p_year_min?: number; p_conditions?: Database["public"]["Enums"]["property_condition"][]; p_balcony?: boolean; p_terrace?: boolean; p_garden?: boolean; p_parking?: boolean; p_garage?: boolean; p_elevator?: boolean; p_pets?: boolean; p_new_build?: boolean; p_wheelchair?: boolean; p_listing_ids?: string[]; p_sort?: string; p_limit?: number; p_offset?: number };
        Returns: {
          id: string | null;
          slug: string | null;
          title: string | null;
          search_summary: string | null;
          offer_type: Database["public"]["Enums"]["offer_type"] | null;
          property_type: Database["public"]["Enums"]["property_type"] | null;
          status: Database["public"]["Enums"]["listing_status"] | null;
          price: number | null;
          price_on_request: boolean | null;
          additional_costs: number | null;
          rooms: number | null;
          living_area: number | null;
          plot_area: number | null;
          floor: number | null;
          municipality: string | null;
          postal_code: string | null;
          canton: string | null;
          public_address: string | null;
          public_latitude: number | null;
          public_longitude: number | null;
          location_precision: Database["public"]["Enums"]["location_precision"] | null;
          has_balcony: boolean | null;
          has_terrace: boolean | null;
          has_garden: boolean | null;
          has_elevator: boolean | null;
          parking_spaces: number | null;
          condition: Database["public"]["Enums"]["property_condition"] | null;
          year_built: number | null;
          published_at: string | null;
          is_demo: boolean | null;
          cover_path: string | null;
          cover_external_url: string | null;
          image_count: number | null;
          distance_km: number | null;
          total_count: number | null;
        }[];
      };
      shares_conversation_with: {
        Args: { p_user: string };
        Returns: boolean;
      };
      slugify: {
        Args: { p_value: string };
        Returns: string;
      };
      storage_cleanup_candidates: {
        Args: { p_limit?: number };
        Returns: {
          bucket_id: string | null;
          name: string | null;
          reason: string | null;
        }[];
      };
      soft_delete_property: {
        Args: { p_property: string };
        Returns: string[];
      };
      submit_contact_request: {
        Args: { p_name: string; p_email: string; p_subject: string; p_message: string };
        Returns: string;
      };
      transfer_organization_ownership: {
        Args: { p_org: string; p_new_owner: string };
        Returns: undefined;
      };
      try_uuid: {
        Args: { p_value: string };
        Returns: string;
      };
      update_viewing_status: {
        Args: { p_appointment_id: string; p_action: string; p_reason?: string };
        Returns: Database["public"]["Enums"]["appointment_status"];
      };
      write_audit_log: {
        Args: { p_action: string; p_entity_type: string; p_entity_id: string; p_details?: Json };
        Returns: undefined;
      };
    };
    Enums: {
      account_type: "private" | "business";
      app_role: "admin" | "moderator";
      appointment_status: "requested" | "confirmed" | "reschedule_requested" | "cancelled" | "completed" | "no_show";
      confidence_level: "none" | "low" | "medium" | "high";
      description_style: "factual" | "modern" | "elegant" | "emotional" | "premium";
      document_category: "floor_plan" | "land_register" | "renovation_receipt" | "service_charges" | "regulations" | "minutes" | "building_insurance" | "energy_certificate" | "sales_dossier" | "other";
      document_visibility: "owner" | "organization" | "public";
      heating_type: "heat_pump" | "district_heating" | "gas" | "oil" | "wood" | "pellets" | "electric" | "solar" | "other";
      job_status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
      job_type: "valuation" | "description" | "image_enhance" | "virtual_staging" | "dossier_pdf";
      lead_status: "new" | "in_contact" | "dossier_sent" | "viewing_requested" | "viewing_confirmed" | "viewing_done" | "highly_interested" | "financing_check" | "offer_received" | "declined" | "closed";
      listing_status: "draft" | "in_progress" | "ready" | "pending_review" | "published" | "paused" | "reserved" | "sold" | "rented" | "archived";
      location_precision: "exact" | "street" | "area";
      moderation_status: "ok" | "flagged" | "blocked";
      offer_type: "sale" | "rent";
      org_role: "owner" | "admin" | "member";
      ownership_type: "condominium" | "sole" | "co_ownership" | "building_right" | "other";
      property_condition: "new_build" | "as_new" | "good" | "needs_refresh" | "needs_renovation";
      property_type: "apartment" | "single_family_house" | "semi_detached_house" | "terraced_house" | "multi_family_house" | "plot" | "commercial" | "office" | "new_build_project" | "other";
      report_status: "open" | "in_review" | "resolved" | "dismissed";
      user_status: "active" | "suspended" | "deleted";
      valuation_status: "completed" | "limited" | "insufficient_data" | "failed";
      verification_kind: "identity" | "ownership" | "documentation_complete" | "organization";
      verification_status: "pending" | "verified" | "rejected" | "revoked";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
export type FunctionReturns<T extends keyof PublicSchema["Functions"]> = PublicSchema["Functions"][T]["Returns"];

export const Constants = {
  public: {
    Enums: {
      account_type: ["private", "business"],
      app_role: ["admin", "moderator"],
      appointment_status: ["requested", "confirmed", "reschedule_requested", "cancelled", "completed", "no_show"],
      confidence_level: ["none", "low", "medium", "high"],
      description_style: ["factual", "modern", "elegant", "emotional", "premium"],
      document_category: ["floor_plan", "land_register", "renovation_receipt", "service_charges", "regulations", "minutes", "building_insurance", "energy_certificate", "sales_dossier", "other"],
      document_visibility: ["owner", "organization", "public"],
      heating_type: ["heat_pump", "district_heating", "gas", "oil", "wood", "pellets", "electric", "solar", "other"],
      job_status: ["queued", "running", "succeeded", "failed", "cancelled"],
      job_type: ["valuation", "description", "image_enhance", "virtual_staging", "dossier_pdf"],
      lead_status: ["new", "in_contact", "dossier_sent", "viewing_requested", "viewing_confirmed", "viewing_done", "highly_interested", "financing_check", "offer_received", "declined", "closed"],
      listing_status: ["draft", "in_progress", "ready", "pending_review", "published", "paused", "reserved", "sold", "rented", "archived"],
      location_precision: ["exact", "street", "area"],
      moderation_status: ["ok", "flagged", "blocked"],
      offer_type: ["sale", "rent"],
      org_role: ["owner", "admin", "member"],
      ownership_type: ["condominium", "sole", "co_ownership", "building_right", "other"],
      property_condition: ["new_build", "as_new", "good", "needs_refresh", "needs_renovation"],
      property_type: ["apartment", "single_family_house", "semi_detached_house", "terraced_house", "multi_family_house", "plot", "commercial", "office", "new_build_project", "other"],
      report_status: ["open", "in_review", "resolved", "dismissed"],
      user_status: ["active", "suspended", "deleted"],
      valuation_status: ["completed", "limited", "insufficient_data", "failed"],
      verification_kind: ["identity", "ownership", "documentation_complete", "organization"],
      verification_status: ["pending", "verified", "rejected", "revoked"],
    },
  },
} as const;
