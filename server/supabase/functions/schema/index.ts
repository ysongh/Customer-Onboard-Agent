import { supabase } from "../_shared/supabase.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const url = new URL(req.url);
    const businessId = url.searchParams.get("business_id");

    if (!businessId) {
      return jsonResponse(
        { error: "business_id query parameter is required." },
        400,
      );
    }

    switch (req.method) {
      case "GET": {
        const { data, error } = await supabase
          .from("onboarding_schema")
          .select("*")
          .eq("business_id", businessId)
          .order("sort_order");

        if (error) {
          return jsonResponse({ error: error.message }, 500);
        }
        return jsonResponse(data);
      }

      case "POST": {
        const body = await req.json();

        // Auto-assign sort_order: max + 1
        const { data: maxRow } = await supabase
          .from("onboarding_schema")
          .select("sort_order")
          .eq("business_id", businessId)
          .order("sort_order", { ascending: false })
          .limit(1)
          .single();

        const nextOrder = maxRow ? maxRow.sort_order + 1 : 1;

        const { data, error } = await supabase
          .from("onboarding_schema")
          .insert({
            business_id: businessId,
            field_name: body.field_name,
            field_type: body.field_type,
            field_label: body.field_label,
            placeholder: body.placeholder || null,
            required: body.required ?? false,
            validation_regex: body.validation_regex || null,
            sort_order: nextOrder,
          })
          .select()
          .single();

        if (error) {
          return jsonResponse({ error: error.message }, 500);
        }
        return jsonResponse(data, 201);
      }

      case "PUT": {
        const fieldId = url.searchParams.get("field_id");
        if (!fieldId) {
          return jsonResponse(
            { error: "field_id query parameter is required." },
            400,
          );
        }

        const body = await req.json();
        const { data, error } = await supabase
          .from("onboarding_schema")
          .update({
            field_name: body.field_name,
            field_type: body.field_type,
            field_label: body.field_label,
            placeholder: body.placeholder,
            required: body.required,
            validation_regex: body.validation_regex,
            sort_order: body.sort_order,
          })
          .eq("id", fieldId)
          .eq("business_id", businessId)
          .select()
          .single();

        if (error) {
          return jsonResponse({ error: error.message }, 500);
        }
        return jsonResponse(data);
      }

      case "DELETE": {
        const fieldId = url.searchParams.get("field_id");
        if (!fieldId) {
          return jsonResponse(
            { error: "field_id query parameter is required." },
            400,
          );
        }

        const { error } = await supabase
          .from("onboarding_schema")
          .delete()
          .eq("id", fieldId)
          .eq("business_id", businessId);

        if (error) {
          return jsonResponse({ error: error.message }, 500);
        }
        return jsonResponse({ success: true });
      }

      default:
        return jsonResponse({ error: "Method not allowed." }, 405);
    }
  } catch (err) {
    console.error("Schema function error:", err);
    return jsonResponse({ error: "An unexpected error occurred." }, 500);
  }
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
