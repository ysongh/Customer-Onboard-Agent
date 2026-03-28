import {
  supabase,
  type BusinessSetupSession,
  type SetupConversationMessage,
} from "../_shared/supabase.ts";
import { setupTools } from "../_shared/setup-tools.ts";
import { buildSetupSystemPrompt } from "../_shared/setup-prompts.ts";
import {
  callClaude,
  parseClaudeResponse,
  type ClaudeMessage,
} from "../_shared/claude.ts";

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
    // ── Authenticate the business owner ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Authentication required." }, 401);
    }

    // Verify the JWT using the service-role client
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return jsonResponse({ error: "Invalid or expired token." }, 401);
    }

    const ownerId = user.id;

    const { message, session_id } = await req.json();

    // ── Load or create setup session ──
    let session: BusinessSetupSession;

    if (session_id) {
      const { data: existing, error: sessError } = await supabase
        .from("business_setup_sessions")
        .select("*")
        .eq("id", session_id)
        .eq("owner_id", ownerId)
        .single();

      if (sessError || !existing) {
        return jsonResponse({ error: "Session not found." }, 404);
      }
      session = existing as BusinessSetupSession;
    } else {
      const { data: newSession, error: createError } = await supabase
        .from("business_setup_sessions")
        .insert({ owner_id: ownerId })
        .select()
        .single();

      if (createError || !newSession) {
        return jsonResponse({ error: "Failed to create session." }, 500);
      }
      session = newSession as BusinessSetupSession;
    }

    // ── Load conversation history (last 30 messages) ──
    const { data: historyRows } = await supabase
      .from("setup_conversation_log")
      .select("*")
      .eq("session_id", session.id)
      .order("sent_at", { ascending: true })
      .limit(30);

    const history = (historyRows || []) as SetupConversationMessage[];

    // ── Determine user message ──
    let userMessage: string;

    if (message === null || message === undefined) {
      if (history.length === 0) {
        userMessage = "(Business owner just opened the setup chat)";
      } else {
        return jsonResponse({ error: "Message is required." }, 400);
      }
    } else {
      userMessage = String(message);
    }

    await supabase.from("setup_conversation_log").insert({
      session_id: session.id,
      role: "user",
      content: userMessage,
    });

    // ── Build system prompt ──
    const systemPrompt = buildSetupSystemPrompt(session);

    // ── Call Claude ──
    const messages: ClaudeMessage[] = [
      ...history.map((m) => ({
        role: (m.role === "model" ? "assistant" : m.role) as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: userMessage },
    ];

    const rawResponse = await callClaude(
      systemPrompt,
      messages,
      setupTools,
      { temperature: 0.3, maxTokens: 1024 },
    );
    const parsed = parseClaudeResponse(rawResponse);

    // ── Process function calls ──
    const functionCallResults: {
      name: string;
      status: string;
      data?: unknown;
      error?: string;
    }[] = [];
    let completed = false;
    let shareableLink: string | null = null;
    const config = { ...session.collected_config };

    for (const fc of parsed.functionCalls) {
      const result = await processSetupFunctionCall(
        fc,
        config,
        ownerId,
        session,
      );
      functionCallResults.push(result);

      if (result.status === "completed" && result.data) {
        completed = true;
        shareableLink = (result.data as { link: string }).link;
      }
    }

    // Update session config
    if (parsed.functionCalls.length > 0) {
      const updateData: Record<string, unknown> = {
        collected_config: config,
      };
      if (completed) {
        updateData.state = "completed";
        updateData.completed_at = new Date().toISOString();
      }
      await supabase
        .from("business_setup_sessions")
        .update(updateData)
        .eq("id", session.id);
    }

    // ── Follow-up call if no text response ──
    let assistantMessage = parsed.text;

    if (!assistantMessage && parsed.functionCalls.length > 0) {
      // Rebuild prompt with updated config
      const updatedSession = { ...session, collected_config: config };
      const updatedPrompt = buildSetupSystemPrompt(updatedSession);

      const savedSummary = functionCallResults
        .filter((r) => r.status === "saved" || r.status === "completed")
        .map((r) => r.name)
        .join(", ");

      const followUpMessages: ClaudeMessage[] = [
        ...messages,
        {
          role: "assistant",
          content: `[Called: ${savedSummary}]`,
        },
        {
          role: "user",
          content: "Configuration has been saved successfully. Now respond conversationally — acknowledge what was saved and guide the owner to the next step. Do NOT call any tools.",
        },
      ];

      const followUpResponse = await callClaude(
        updatedPrompt,
        followUpMessages,
        setupTools,
        { temperature: 0.3, maxTokens: 1024, toolChoice: { type: "none" } },
      );
      const followUpParsed = parseClaudeResponse(followUpResponse);
      assistantMessage = followUpParsed.text || "Got it! Let me continue setting things up.";
    }

    if (!assistantMessage) {
      assistantMessage = "Got it! Let me continue setting things up.";
    }

    // ── Save assistant response ──
    await supabase.from("setup_conversation_log").insert({
      session_id: session.id,
      role: "model",
      content: assistantMessage,
      function_calls:
        functionCallResults.length > 0 ? functionCallResults : null,
    });

    // ── Return response ──
    const response: Record<string, unknown> = {
      session_id: session.id,
      message: assistantMessage,
      collected_config: config,
      completed,
      function_calls: functionCallResults,
    };

    if (shareableLink) {
      response.shareable_link = shareableLink;
    }

    return jsonResponse(response);
  } catch (err) {
    console.error("Business setup error:", err);
    return jsonResponse(
      { error: "An unexpected error occurred. Please try again." },
      500,
    );
  }
});

// ── Process setup function calls ──

async function processSetupFunctionCall(
  fc: { name: string; args: Record<string, unknown> },
  config: Record<string, unknown>,
  ownerId: string,
  session: BusinessSetupSession,
) {
  switch (fc.name) {
    case "set_business_info": {
      const name = fc.args.name as string;
      const description = fc.args.description as string;
      const industry = fc.args.industry as string;
      const slug = fc.args.slug as string;

      if (!name || !description || !industry || !slug) {
        return {
          name: "set_business_info",
          status: "error",
          error: "All fields (name, description, industry, slug) are required.",
        };
      }

      // Sanitize slug
      const cleanSlug = slug
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

      // Check slug uniqueness
      const { data: existing } = await supabase
        .from("businesses")
        .select("id")
        .eq("slug", cleanSlug)
        .maybeSingle();

      if (existing) {
        // Append a short random suffix
        const suffix = Math.random().toString(36).substring(2, 6);
        config.slug = `${cleanSlug}-${suffix}`;
      } else {
        config.slug = cleanSlug;
      }

      config.name = name;
      config.description = description;
      config.industry = industry;

      return { name: "set_business_info", status: "saved" };
    }

    case "add_onboarding_field": {
      const fieldName = fc.args.field_name as string;
      const fieldType = fc.args.field_type as string;
      const fieldLabel = fc.args.field_label as string;
      const required = fc.args.required as boolean;
      const validationRegex = (fc.args.validation_regex as string) || null;
      const placeholder = (fc.args.placeholder as string) || null;

      const validTypes = [
        "text",
        "email",
        "phone",
        "url",
        "number",
        "select",
        "textarea",
      ];
      if (!validTypes.includes(fieldType)) {
        return {
          name: "add_onboarding_field",
          status: "error",
          error: `Invalid field type: ${fieldType}. Must be one of: ${validTypes.join(", ")}`,
        };
      }

      if (!fieldName || !fieldLabel) {
        return {
          name: "add_onboarding_field",
          status: "error",
          error: "field_name and field_label are required.",
        };
      }

      // Initialize fields array if needed
      if (!Array.isArray(config.fields)) {
        config.fields = [];
      }

      const fields = config.fields as Array<Record<string, unknown>>;

      // Replace if field_name already exists
      const existingIdx = fields.findIndex(
        (f) => f.field_name === fieldName,
      );
      const fieldEntry = {
        field_name: fieldName,
        field_type: fieldType,
        field_label: fieldLabel,
        required: required ?? false,
        validation_regex: validationRegex,
        placeholder,
      };

      if (existingIdx >= 0) {
        fields[existingIdx] = fieldEntry;
      } else {
        fields.push(fieldEntry);
      }

      return { name: "add_onboarding_field", status: "saved" };
    }

    case "set_tone": {
      const brandTone = fc.args.brand_tone as string;
      const welcomeMessage = fc.args.welcome_message as string;
      const businessPromptContext =
        (fc.args.business_prompt_context as string) || null;

      const validTones = ["friendly", "professional", "casual"];
      if (!validTones.includes(brandTone)) {
        return {
          name: "set_tone",
          status: "error",
          error: `Invalid tone: ${brandTone}. Must be one of: ${validTones.join(", ")}`,
        };
      }

      if (!welcomeMessage) {
        return {
          name: "set_tone",
          status: "error",
          error: "welcome_message is required.",
        };
      }

      config.brand_tone = brandTone;
      config.welcome_message = welcomeMessage;
      if (businessPromptContext) {
        config.business_prompt_context = businessPromptContext;
      }

      return { name: "set_tone", status: "saved" };
    }

    case "finalize_setup": {
      const confirmed = fc.args.confirmed as boolean;
      if (!confirmed) {
        return {
          name: "finalize_setup",
          status: "error",
          error: "Owner must confirm before finalizing.",
        };
      }

      // Validate all required config is present
      if (!config.name || !config.slug || !config.description) {
        return {
          name: "finalize_setup",
          status: "error",
          error:
            "Business info is incomplete. Need name, slug, and description.",
        };
      }

      const fields = config.fields as Array<Record<string, unknown>>;
      if (!Array.isArray(fields) || fields.length === 0) {
        return {
          name: "finalize_setup",
          status: "error",
          error: "At least one onboarding field is required.",
        };
      }

      if (!config.brand_tone || !config.welcome_message) {
        return {
          name: "finalize_setup",
          status: "error",
          error: "Brand tone and welcome message are required.",
        };
      }

      // Create the business record
      const { data: business, error: bizError } = await supabase
        .from("businesses")
        .insert({
          name: config.name as string,
          slug: config.slug as string,
          description: config.description as string,
          business_prompt_context:
            (config.business_prompt_context as string) || null,
          welcome_message: config.welcome_message as string,
          brand_tone: config.brand_tone as string,
          owner_id: ownerId,
          settings: {},
        })
        .select()
        .single();

      if (bizError || !business) {
        console.error("Failed to create business:", bizError);
        return {
          name: "finalize_setup",
          status: "error",
          error: "Failed to create business. The slug may already be taken.",
        };
      }

      // Create onboarding schema fields
      const schemaRows = fields.map((f, i) => ({
        business_id: business.id,
        field_name: f.field_name as string,
        field_type: f.field_type as string,
        field_label: f.field_label as string,
        required: (f.required as boolean) ?? false,
        validation_regex: (f.validation_regex as string) || null,
        placeholder: (f.placeholder as string) || null,
        sort_order: i + 1,
      }));

      const { error: schemaError } = await supabase
        .from("onboarding_schema")
        .insert(schemaRows);

      if (schemaError) {
        console.error("Failed to create schema:", schemaError);
        // Clean up the business record
        await supabase.from("businesses").delete().eq("id", business.id);
        return {
          name: "finalize_setup",
          status: "error",
          error: "Failed to create onboarding fields.",
        };
      }

      // Link session to business
      await supabase
        .from("business_setup_sessions")
        .update({ business_id: business.id })
        .eq("id", session.id);

      // The shareable link uses the frontend URL pattern
      const shareableLink = `/onboard/${config.slug}`;

      return {
        name: "finalize_setup",
        status: "completed",
        data: {
          business_id: business.id,
          slug: config.slug,
          link: shareableLink,
        },
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
