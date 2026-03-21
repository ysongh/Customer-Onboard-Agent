import { supabase, type Business, type Customer } from "../_shared/supabase.ts";

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

  try {
    const { customer_id, business_id } = await req.json();

    // Load customer
    const { data: customer, error: custError } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customer_id)
      .single();

    if (custError || !customer) {
      console.error("on-complete: customer not found", custError);
      return jsonResponse({ error: "Customer not found." }, 404);
    }
    const cust = customer as Customer;

    // Load business settings
    const { data: business, error: bizError } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", business_id)
      .single();

    if (bizError || !business) {
      console.error("on-complete: business not found", bizError);
      return jsonResponse({ error: "Business not found." }, 404);
    }
    const biz = business as Business;
    const settings = biz.settings as Record<string, string>;

    // Fire external webhook if configured
    if (settings.webhook_url) {
      try {
        await fetch(settings.webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "onboarding.completed",
            customer: {
              id: cust.id,
              email: cust.email,
              name: cust.name,
              custom_fields: cust.custom_fields,
              created_at: cust.created_at,
            },
            business: {
              id: biz.id,
              name: biz.name,
              slug: biz.slug,
            },
          }),
        });
        console.log("on-complete: webhook sent to", settings.webhook_url);
      } catch (err) {
        console.error("on-complete: webhook failed", err);
      }
    }

    // Send welcome email via Resend if configured
    if (settings.resend_api_key && cust.email) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${settings.resend_api_key}`,
          },
          body: JSON.stringify({
            from: settings.from_email || `onboarding@${biz.slug}.com`,
            to: cust.email,
            subject: `Welcome to ${biz.name}!`,
            html: `<h1>Welcome, ${cust.name || "there"}!</h1><p>Your account has been created successfully. We're excited to have you on board!</p>`,
          }),
        });
        console.log("on-complete: welcome email sent to", cust.email);
      } catch (err) {
        console.error("on-complete: email send failed", err);
      }
    }

    console.log(
      `on-complete: finished for customer ${cust.id} (${cust.email})`,
    );

    return jsonResponse({ success: true });
  } catch (err) {
    console.error("on-complete error:", err);
    return jsonResponse({ error: "An unexpected error occurred." }, 500);
  }
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
