import type { Business, SchemaField } from "./supabase.ts";

const TONE_GUIDES: Record<string, string> = {
  friendly:
    "Be warm and conversational. Use casual language, contractions, and personality.",
  professional:
    "Be polite and clear. Proper grammar, no slang, but not robotic.",
  casual:
    "Be relaxed and fun. Short sentences, emoji okay, feel like texting a friend.",
};

export function buildSystemPrompt(
  business: Business,
  schema: SchemaField[],
  collectedFields: Record<string, unknown>,
): string {
  const toneGuide = TONE_GUIDES[business.brand_tone] || TONE_GUIDES.friendly;

  // Separate required and optional fields
  const requiredFields = schema.filter((f) => f.required);
  const optionalFields = schema.filter((f) => !f.required);

  // Calculate progress
  const requiredDone = requiredFields.filter(
    (f) => collectedFields[f.field_name] !== undefined,
  ).length;
  const requiredTotal = requiredFields.length;
  const percent =
    requiredTotal > 0 ? Math.round((requiredDone / requiredTotal) * 100) : 100;

  // Build "already collected" list
  const collectedLines = schema
    .filter((f) => collectedFields[f.field_name] !== undefined)
    .map((f) => `  - ${f.field_label}: ${collectedFields[f.field_name]}`)
    .join("\n");

  // Build "still needed (required)" list
  const missingRequired = requiredFields
    .filter((f) => collectedFields[f.field_name] === undefined)
    .map((f) => {
      let line = `  - ${f.field_name} (${f.field_type}) — "${f.field_label}"`;
      if (f.placeholder) line += ` — example: ${f.placeholder}`;
      if (f.field_type === "select" && f.validation_regex) {
        const options = f.validation_regex.split("|").join(", ");
        line += ` [options: ${options}]`;
      }
      return line;
    })
    .join("\n");

  // Build "optional" list
  const missingOptional = optionalFields
    .filter((f) => collectedFields[f.field_name] === undefined)
    .map((f) => {
      let line = `  - ${f.field_name} (${f.field_type}) — "${f.field_label}"`;
      if (f.placeholder) line += ` — example: ${f.placeholder}`;
      if (f.field_type === "select" && f.validation_regex) {
        const options = f.validation_regex.split("|").join(", ");
        line += ` [options: ${options}]`;
      }
      return line;
    })
    .join("\n");

  const allRequiredCollected = requiredDone === requiredTotal;

  // Rule #5 changes based on whether all required fields are collected
  const rule5 = allRequiredCollected
    ? `5. ALL REQUIRED FIELDS COLLECTED! Show a brief summary of everything collected and ask the customer to confirm. Only call complete_onboarding after explicit confirmation (e.g. "looks good", "yes", "correct").`
    : `5. WHEN ALL REQUIRED FIELDS COLLECTED: show a brief summary and ask customer to confirm. Only call complete_onboarding after explicit confirmation.`;

  // Build business context section if available
  const businessContext = [
    business.description
      ? `About ${business.name}: ${business.description}`
      : null,
    business.business_prompt_context
      ? `Additional context: ${business.business_prompt_context}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `You are an onboarding assistant for "${business.name}".
Your job is to collect customer information through natural conversation.
${businessContext ? `\n## ABOUT THIS BUSINESS\n${businessContext}\n\nUse this knowledge to make the conversation feel natural. You can reference what the business does when greeting customers or answering questions about the company.\n` : ""}
## TONE
${toneGuide}

## FIELDS TO COLLECT

Progress: ${percent}% complete (${requiredDone}/${requiredTotal} required fields)

${collectedLines ? `Already collected:\n${collectedLines}` : "No fields collected yet."}

${missingRequired ? `Still needed (required):\n${missingRequired}` : "All required fields collected!"}

${missingOptional ? `Optional (ask only if natural):\n${missingOptional}` : ""}

## RULES

1. EXTRACT data from natural language. If someone says "I'm Sarah from Acme, sarah@acme.com" — call save_field THREE times. Never re-ask for info already given.

2. COLLECT 1-2 fields per turn. Group related fields (name + email, company + role).

3. VALIDATE before saving. If email looks wrong, ask to confirm.

4. BE CONVERSATIONAL. Don't say "Please provide your email." Say "What's the best email to reach you at?"

${rule5}

6. HANDLE CORRECTIONS. If someone says "actually my email is different" — use request_correction with the new value.

7. STAY ON TASK. Unrelated questions get a one-sentence answer, then steer back.

8. NEVER invent or assume data. If unsure, ask.

9. FIRST MESSAGE: if no fields collected yet, greet with: "${business.welcome_message || `Welcome! Let's get you set up.`}" then ask for the first field.

10. Keep responses SHORT. 1-3 sentences max.

11. ALWAYS END WITH A QUESTION. Every response must end with a question asking for the next missing field. Never end with a statement or acknowledgement alone — always keep the conversation moving forward.`;
}
