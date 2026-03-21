import {
  supabase,
  type Business,
  type SchemaField,
  type OnboardingSession,
  type ConversationMessage,
} from "../_shared/supabase.ts";
import { validateField } from "../_shared/validation.ts";
import { onboardingTools } from "../_shared/tools.ts";
import { buildSystemPrompt } from "../_shared/prompts.ts";
import {
  callGemini,
  parseGeminiResponse,
  type GeminiRequest,
  type GeminiFunctionCall,
} from "../_shared/gemini.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { message, session_id, business_slug } = await req.json();

    // ── Step 1: Load business by slug ──
    const { data: business, error: bizError } = await supabase
      .from("businesses")
      .select("*")
      .eq("slug", business_slug)
      .single();

    if (bizError || !business) {
      return jsonResponse(
        { error: `Business "${business_slug}" not found.` },
        404,
      );
    }
    const biz = business as Business;

    // ── Step 2: Load onboarding schema ──
    const { data: schemaRows, error: schemaError } = await supabase
      .from("onboarding_schema")
      .select("*")
      .eq("business_id", biz.id)
      .order("sort_order");

    if (schemaError) {
      return jsonResponse({ error: "Failed to load onboarding schema." }, 500);
    }
    const schema = (schemaRows || []) as SchemaField[];

    // ── Step 3: Load or create session ──
    let session: OnboardingSession;

    if (session_id) {
      const { data: existingSession, error: sessError } = await supabase
        .from("onboarding_sessions")
        .select("*")
        .eq("id", session_id)
        .single();

      if (sessError || !existingSession) {
        return jsonResponse({ error: "Session not found." }, 404);
      }
      session = existingSession as OnboardingSession;
    } else {
      const { data: newSession, error: createError } = await supabase
        .from("onboarding_sessions")
        .insert({ business_id: biz.id })
        .select()
        .single();

      if (createError || !newSession) {
        return jsonResponse({ error: "Failed to create session." }, 500);
      }
      session = newSession as OnboardingSession;
    }

    // ── Step 4: Load conversation history (last 30 messages) ──
    const { data: historyRows } = await supabase
      .from("conversation_log")
      .select("*")
      .eq("session_id", session.id)
      .order("sent_at", { ascending: true })
      .limit(30);

    const history = (historyRows || []) as ConversationMessage[];

    // ── Step 5: Determine user message and save to conversation_log ──
    let userMessage: string;

    if (message === null || message === undefined) {
      // First call — trigger greeting if no history exists
      if (history.length === 0) {
        userMessage = "(Customer just opened the chat)";
      } else {
        return jsonResponse({ error: "Message is required." }, 400);
      }
    } else {
      userMessage = String(message);
    }

    await supabase.from("conversation_log").insert({
      session_id: session.id,
      role: "user",
      content: userMessage,
    });

    // ── Step 6: Build dynamic system prompt ──
    const systemPrompt = buildSystemPrompt(
      biz,
      schema,
      session.collected_fields,
    );

    // ── Step 7: Call Gemini with system prompt + history + tools ──
    const contents = [
      ...history.map((m) => ({
        role: m.role,
        parts: [{ text: m.content }],
      })),
      { role: "user", parts: [{ text: userMessage }] },
    ];

    const geminiRequest: GeminiRequest = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      tools: onboardingTools,
      generation_config: {
        temperature: 0.3,
        max_output_tokens: 1024,
      },
      tool_config: {
        function_calling_config: { mode: "AUTO" },
      },
    };

    const rawResponse = await callGemini(geminiRequest);
    const parsed = parseGeminiResponse(rawResponse);

    // ── Step 8: Process function calls ──
    const functionCallResults: {
      name: string;
      field?: string;
      value?: unknown;
      status: string;
      error?: string;
    }[] = [];
    let completed = false;
    let collectedFields = { ...session.collected_fields };

    for (const fc of parsed.functionCalls) {
      const result = await processFunctionCall(
        fc,
        schema,
        session,
        biz,
        collectedFields,
      );
      functionCallResults.push(result);

      if (result.status === "saved" || result.status === "corrected") {
        collectedFields[result.field!] = result.value;
      }
      if (result.status === "completed") {
        completed = true;
      }
    }

    // Update session collected_fields if any changed
    if (parsed.functionCalls.length > 0) {
      const updateData: Record<string, unknown> = {
        collected_fields: collectedFields,
      };
      if (completed) {
        updateData.state = "completed";
        updateData.completed_at = new Date().toISOString();
      }
      await supabase
        .from("onboarding_sessions")
        .update(updateData)
        .eq("id", session.id);
    }

    // ── Step 8b: If Gemini returned function calls but no text, make a
    //    lightweight follow-up call with updated state to get a reply ──
    let assistantMessage = parsed.text;

    if (!assistantMessage && parsed.functionCalls.length > 0) {
      // Rebuild system prompt with the now-updated collected fields
      const updatedPrompt = buildSystemPrompt(biz, schema, collectedFields);

      // Summarize what just happened so the model can respond naturally
      const savedSummary = functionCallResults
        .filter((r) => r.status === "saved" || r.status === "corrected")
        .map((r) => `${r.field}: ${r.value}`)
        .join(", ");

      const followUpRequest: GeminiRequest = {
        system_instruction: { parts: [{ text: updatedPrompt }] },
        contents: [
          ...contents,
          {
            role: "model",
            parts: [{ text: `[Saved: ${savedSummary}]` }],
          },
          {
            role: "user",
            parts: [
              {
                text: "Fields have been saved successfully. Now respond conversationally to the customer — acknowledge what was saved and ask for the next missing field. Do NOT call any tools.",
              },
            ],
          },
        ],
        tools: onboardingTools,
        generation_config: {
          temperature: 0.3,
          max_output_tokens: 1024,
        },
        tool_config: {
          function_calling_config: { mode: "NONE" },
        },
      };

      const followUpResponse = await callGemini(followUpRequest);
      const followUpParsed = parseGeminiResponse(followUpResponse);
      assistantMessage = followUpParsed.text || "Got it! Let me continue.";
    }

    if (!assistantMessage) {
      assistantMessage = "Got it! Let me continue.";
    }

    // ── Step 9: Save assistant response to conversation_log ──

    await supabase.from("conversation_log").insert({
      session_id: session.id,
      role: "model",
      content: assistantMessage,
      function_calls:
        functionCallResults.length > 0 ? functionCallResults : null,
    });

    // ── Step 10: Return response with progress ──
    const requiredFields = schema.filter((f) => f.required);
    const requiredDone = requiredFields.filter(
      (f) => collectedFields[f.field_name] !== undefined,
    ).length;
    const requiredTotal = requiredFields.length;

    return jsonResponse({
      session_id: session.id,
      message: assistantMessage,
      collected_fields: collectedFields,
      progress: {
        required_total: requiredTotal,
        required_done: requiredDone,
        percent:
          requiredTotal > 0
            ? Math.round((requiredDone / requiredTotal) * 100)
            : 100,
      },
      completed,
      function_calls: functionCallResults,
    });
  } catch (err) {
    console.error("Chat function error:", err);
    return jsonResponse(
      { error: "An unexpected error occurred. Please try again." },
      500,
    );
  }
});

// ── Process individual function calls ──

async function processFunctionCall(
  fc: GeminiFunctionCall,
  schema: SchemaField[],
  session: OnboardingSession,
  business: Business,
  collectedFields: Record<string, unknown>,
) {
  switch (fc.name) {
    case "save_field": {
      const fieldName = fc.args.field_name as string;
      const value = fc.args.value as string;

      const fieldDef = schema.find((f) => f.field_name === fieldName);
      if (!fieldDef) {
        return {
          name: "save_field",
          field: fieldName,
          status: "error",
          error: `Unknown field: ${fieldName}`,
        };
      }

      const validation = validateField(fieldDef, value);
      if (!validation.valid) {
        return {
          name: "save_field",
          field: fieldName,
          status: "error",
          error: validation.error,
        };
      }

      return {
        name: "save_field",
        field: fieldName,
        value: validation.sanitized,
        status: "saved",
      };
    }

    case "request_correction": {
      const fieldName = fc.args.field_name as string;
      const newValue = fc.args.new_value as string;

      const fieldDef = schema.find((f) => f.field_name === fieldName);
      if (!fieldDef) {
        return {
          name: "request_correction",
          field: fieldName,
          status: "error",
          error: `Unknown field: ${fieldName}`,
        };
      }

      const validation = validateField(fieldDef, newValue);
      if (!validation.valid) {
        return {
          name: "request_correction",
          field: fieldName,
          status: "error",
          error: validation.error,
        };
      }

      return {
        name: "request_correction",
        field: fieldName,
        value: validation.sanitized,
        status: "corrected",
      };
    }

    case "complete_onboarding": {
      // Double-check all required fields exist server-side
      const requiredFields = schema.filter((f) => f.required);
      const missingFields = requiredFields.filter(
        (f) => collectedFields[f.field_name] === undefined,
      );

      if (missingFields.length > 0) {
        const missing = missingFields.map((f) => f.field_label).join(", ");
        return {
          name: "complete_onboarding",
          status: "error",
          error: `Missing required fields: ${missing}`,
        };
      }

      // Create customer record
      const customerData = {
        business_id: business.id,
        email: (collectedFields.email as string) || null,
        name: (collectedFields.name as string) || null,
        custom_fields: collectedFields,
        status: "active",
      };

      const { data: customer, error: custError } = await supabase
        .from("customers")
        .insert(customerData)
        .select()
        .single();

      if (custError || !customer) {
        console.error("Failed to create customer:", custError);
        return {
          name: "complete_onboarding",
          status: "error",
          error: "Failed to create customer account.",
        };
      }

      // Link customer to session
      await supabase
        .from("onboarding_sessions")
        .update({ customer_id: customer.id })
        .eq("id", session.id);

      // Fire on-complete webhook asynchronously (don't block response)
      fireOnComplete(customer.id, business.id).catch((err) =>
        console.error("on-complete webhook failed:", err),
      );

      return {
        name: "complete_onboarding",
        status: "completed",
      };
    }

    default:
      return {
        name: fc.name,
        status: "error",
        error: `Unknown function: ${fc.name}`,
      };
  }
}

// ── Fire on-complete edge function asynchronously ──

async function fireOnComplete(
  customerId: string,
  businessId: string,
): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return;

  await fetch(`${supabaseUrl}/functions/v1/on-complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ customer_id: customerId, business_id: businessId }),
  });
}

// ── Helper ──

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
