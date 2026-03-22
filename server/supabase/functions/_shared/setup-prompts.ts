import type { BusinessSetupSession } from "./supabase.ts";

/**
 * Industry-specific field suggestions for the setup agent.
 */
const INDUSTRY_SUGGESTIONS: Record<string, string> = {
  "real estate":
    "name, email, phone, property_interest (select: Buying|Selling|Renting), budget_range (select: Under $250k|$250k-$500k|$500k-$1M|$1M+), preferred_location",
  saas: "name, email, company, role, team_size (select: 1-10|11-50|51-200|201-1000|1000+), use_case",
  "e-commerce":
    "name, email, phone, product_interest, how_did_you_hear (select: Google|Social Media|Friend|Ad|Other)",
  consulting:
    "name, email, company, role, project_type, budget_range (select: Under $5k|$5k-$25k|$25k-$100k|$100k+), timeline",
  healthcare:
    "name, email, phone, date_of_birth, insurance_provider, reason_for_visit",
  education:
    "name, email, phone, program_interest, education_level (select: High School|Bachelor's|Master's|PhD|Other)",
  fitness:
    "name, email, phone, fitness_goals (select: Weight Loss|Muscle Gain|General Fitness|Rehabilitation), experience_level (select: Beginner|Intermediate|Advanced)",
  agency:
    "name, email, company, website, project_type (select: Branding|Web Design|Marketing|Development|Other), budget_range",
  default:
    "name, email, phone, company, role",
};

export function buildSetupSystemPrompt(
  session: BusinessSetupSession,
): string {
  const config = session.collected_config;

  // Track what's been configured
  const hasBusinessInfo = !!(config.name && config.description && config.industry);
  const hasFields = Array.isArray(config.fields) && config.fields.length > 0;
  const hasTone = !!(config.brand_tone && config.welcome_message);

  // Build industry suggestion if we know the industry
  const industry = (config.industry as string || "").toLowerCase();
  const industrySuggestion =
    INDUSTRY_SUGGESTIONS[industry] || INDUSTRY_SUGGESTIONS.default;

  // Build state summary
  const configuredItems: string[] = [];
  const pendingItems: string[] = [];

  if (hasBusinessInfo) {
    configuredItems.push(
      `Business: ${config.name} (${config.industry}) — "${config.description}"`,
    );
    configuredItems.push(`Slug: ${config.slug}`);
  } else {
    pendingItems.push("Business info (name, description, industry)");
  }

  if (hasFields) {
    const fields = config.fields as Array<Record<string, unknown>>;
    const fieldList = fields
      .map(
        (f) =>
          `  - ${f.field_name} (${f.field_type}${f.required ? ", required" : ", optional"}) — "${f.field_label}"`,
      )
      .join("\n");
    configuredItems.push(`Onboarding fields:\n${fieldList}`);
  } else {
    pendingItems.push("Onboarding fields (what to collect from customers)");
  }

  if (hasTone) {
    configuredItems.push(`Tone: ${config.brand_tone}`);
    configuredItems.push(`Welcome message: "${config.welcome_message}"`);
    if (config.business_prompt_context) {
      configuredItems.push(`Business context: "${config.business_prompt_context}"`);
    }
  } else {
    pendingItems.push("Brand tone and welcome message");
  }

  const allConfigured = hasBusinessInfo && hasFields && hasTone;

  return `You are a setup assistant helping a business owner configure their customer onboarding agent.
Your job is to conversationally gather the information needed to create their onboarding flow — then set everything up for them.

## YOUR APPROACH

Guide the owner through these steps in order:
1. **Business info** — Ask about their business: name, what they do, their industry. Use set_business_info to save.
2. **Onboarding fields** — Ask what information they need to collect from customers. Suggest relevant fields based on their industry. Use add_onboarding_field for each field. Suggest smart defaults.
3. **Tone & welcome** — Ask about preferred tone (friendly, professional, casual). Offer to write a welcome message or let them provide one. Use set_tone to save.
4. **Review & confirm** — Show a complete summary. Only call finalize_setup after explicit confirmation.

## CONFIGURATION STATE

${configuredItems.length > 0 ? `Already configured:\n${configuredItems.join("\n")}` : "Nothing configured yet."}

${pendingItems.length > 0 ? `Still needed:\n${pendingItems.map((p) => `  - ${p}`).join("\n")}` : "All configuration complete!"}

${allConfigured ? "\n**All configuration is complete!** Show a summary and ask the owner to confirm. Only call finalize_setup after they say yes." : ""}

## INDUSTRY FIELD SUGGESTIONS

${hasBusinessInfo && !hasFields ? `Based on the "${config.industry}" industry, consider suggesting these fields:\n${industrySuggestion}\n\nAdapt these suggestions based on what the owner tells you they need.` : "You'll suggest fields once you know the industry."}

## RULES

1. Be helpful and knowledgeable. Proactively suggest fields and options based on their industry.
2. When suggesting fields, explain WHY each one is useful. Group required vs optional recommendations.
3. Let the owner customize — they know their business. If they want different fields, go with it.
4. For select fields, suggest sensible options and ask if they want to adjust.
5. Generate the slug automatically from the business name (lowercase, hyphens, no special chars).
6. When writing the welcome message, match the chosen brand tone and reference the business naturally.
7. The business_prompt_context should capture anything the customer-facing agent should know — services offered, common questions, important policies.
8. Keep responses conversational but efficient. 2-4 sentences per turn.
9. FIRST MESSAGE: Introduce yourself warmly and ask about their business.
10. When all sections are configured, show a formatted summary with all details and ask "Does everything look good?"`;
}
