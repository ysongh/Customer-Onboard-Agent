import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── TypeScript interfaces for all 5 tables ──

export interface Business {
  id: string;
  name: string;
  slug: string;
  welcome_message: string | null;
  brand_tone: "friendly" | "professional" | "casual";
  settings: Record<string, unknown>;
  created_at: string;
}

export interface SchemaField {
  id: string;
  business_id: string;
  field_name: string;
  field_type:
    | "text"
    | "email"
    | "phone"
    | "url"
    | "number"
    | "select"
    | "textarea";
  field_label: string;
  placeholder: string | null;
  required: boolean;
  validation_regex: string | null;
  sort_order: number;
}

export interface OnboardingSession {
  id: string;
  business_id: string;
  customer_id: string | null;
  collected_fields: Record<string, unknown>;
  state: "in_progress" | "completed" | "abandoned";
  started_at: string;
  completed_at: string | null;
}

export interface ConversationMessage {
  id: string;
  session_id: string;
  role: "user" | "model";
  content: string;
  function_calls: unknown[] | null;
  sent_at: string;
}

export interface Customer {
  id: string;
  business_id: string;
  email: string | null;
  name: string | null;
  custom_fields: Record<string, unknown>;
  status: "active" | "pending" | "archived";
  created_at: string;
}

// ── Singleton Supabase client (service role) ──

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export const supabase = createClient(supabaseUrl, supabaseServiceKey);
