/**
 * Gemini function calling tool declarations for the onboarding agent.
 * These follow the Gemini functionDeclarations format.
 */
export const onboardingTools = [
  {
    functionDeclarations: [
      {
        name: "save_field",
        description:
          "Save an extracted customer field value. Call this every time the customer provides information that matches one of the onboarding schema fields. You can call this multiple times in a single response — for example, if the customer says 'I'm Sarah from Acme', call save_field twice: once for name and once for company.",
        parameters: {
          type: "OBJECT",
          properties: {
            field_name: {
              type: "STRING",
              description:
                "The machine key of the field to save. Must exactly match one of the field names in the onboarding schema (e.g. 'name', 'email', 'company').",
            },
            value: {
              type: "STRING",
              description:
                "The cleaned/normalized value extracted from the customer's message. For example, extract 'Sarah Chen' from 'I'm Sarah Chen'.",
            },
          },
          required: ["field_name", "value"],
        },
      },
      {
        name: "complete_onboarding",
        description:
          "Create the customer account and complete the onboarding session. Only call this AFTER all required fields have been collected AND the customer has explicitly confirmed the summary is correct. Never call this preemptively.",
        parameters: {
          type: "OBJECT",
          properties: {
            notes: {
              type: "STRING",
              description:
                "Optional notes about the customer or their preferences, e.g. 'customer wants enterprise plan' or 'referred by John'.",
            },
          },
        },
      },
      {
        name: "request_correction",
        description:
          "Overwrite a previously saved field with a new value. Call this when the customer wants to correct or change information they already provided, e.g. 'actually my email is different'.",
        parameters: {
          type: "OBJECT",
          properties: {
            field_name: {
              type: "STRING",
              description:
                "The machine key of the field to correct. Must match an already-collected field name.",
            },
            new_value: {
              type: "STRING",
              description: "The corrected value to replace the existing one.",
            },
          },
          required: ["field_name", "new_value"],
        },
      },
    ],
  },
];
