import { supabase } from "../_shared/supabase.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const { business_slug } = await req.json();

    if (!business_slug) {
      return jsonResponse(
        { error: "business_slug is required." },
        400,
      );
    }

    // Look up business by slug
    const { data: business, error: bizError } = await supabase
      .from("businesses")
      .select("id, name, slug")
      .eq("slug", business_slug)
      .single();

    if (bizError || !business) {
      return jsonResponse({ error: "Business not found." }, 404);
    }

    // Fetch schema (for dynamic column headers)
    const { data: schema, error: schemaError } = await supabase
      .from("onboarding_schema")
      .select("field_name, field_label, field_type, required, sort_order")
      .eq("business_id", business.id)
      .order("sort_order");

    if (schemaError) {
      return jsonResponse({ error: schemaError.message }, 500);
    }

    // Fetch customers
    const { data: customers, error: custError } = await supabase
      .from("customers")
      .select("id, name, email, custom_fields, status, created_at")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (custError) {
      return jsonResponse({ error: custError.message }, 500);
    }

    return jsonResponse({
      business,
      schema: schema || [],
      customers: customers || [],
      total: customers?.length || 0,
    });
  } catch (err) {
    console.error("Customers function error:", err);
    return jsonResponse({ error: "An unexpected error occurred." }, 500);
  }
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
