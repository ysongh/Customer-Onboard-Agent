/**
 * Gemini function calling tool declarations for the business setup agent.
 */
export const setupTools = [
  {
    functionDeclarations: [
      {
        name: "set_business_info",
        description:
          "Save or update the core business information. Call this once you've gathered the business name, what they do, and their industry. The slug is auto-generated from the name (lowercase, hyphens, no special chars).",
        parameters: {
          type: "OBJECT",
          properties: {
            name: {
              type: "STRING",
              description: "The business name, e.g. 'Bright Ideas Agency'.",
            },
            description: {
              type: "STRING",
              description:
                "A 1-2 sentence description of what the business does, written by the AI based on what the owner said.",
            },
            industry: {
              type: "STRING",
              description:
                "The business industry/category, e.g. 'real estate', 'saas', 'e-commerce', 'consulting', 'healthcare'.",
            },
            slug: {
              type: "STRING",
              description:
                "URL-friendly slug auto-generated from the name. Lowercase, hyphens instead of spaces, no special characters. e.g. 'bright-ideas-agency'.",
            },
          },
          required: ["name", "description", "industry", "slug"],
        },
      },
      {
        name: "add_onboarding_field",
        description:
          "Add a field to the customer onboarding schema. Call this for each piece of information the business wants to collect from customers. Can be called multiple times in a single response.",
        parameters: {
          type: "OBJECT",
          properties: {
            field_name: {
              type: "STRING",
              description:
                "Machine key for the field, lowercase with underscores. e.g. 'full_name', 'email', 'budget_range'.",
            },
            field_type: {
              type: "STRING",
              description:
                "The field type. One of: text, email, phone, url, number, select, textarea.",
            },
            field_label: {
              type: "STRING",
              description:
                "Human-readable label shown in the UI. e.g. 'Full name', 'Email address', 'Budget range'.",
            },
            required: {
              type: "BOOLEAN",
              description: "Whether this field is required for onboarding completion.",
            },
            validation_regex: {
              type: "STRING",
              description:
                "For 'select' fields: pipe-separated options, e.g. 'Option A|Option B|Option C'. For other types: optional regex pattern for validation.",
            },
            placeholder: {
              type: "STRING",
              description:
                "Example text shown as placeholder. e.g. 'e.g. Sarah Chen', 'e.g. sarah@company.com'.",
            },
          },
          required: ["field_name", "field_type", "field_label", "required"],
        },
      },
      {
        name: "set_tone",
        description:
          "Set the brand tone, welcome message, and any additional context for the customer-facing onboarding agent. Call this after discussing the preferred communication style.",
        parameters: {
          type: "OBJECT",
          properties: {
            brand_tone: {
              type: "STRING",
              description:
                "The communication style. One of: friendly, professional, casual.",
            },
            welcome_message: {
              type: "STRING",
              description:
                "The greeting message customers see when they open the onboarding chat. Should match the brand tone.",
            },
            business_prompt_context: {
              type: "STRING",
              description:
                "Additional context the customer-facing agent should know about the business — e.g. key services, target audience, common questions customers ask.",
            },
          },
          required: ["brand_tone", "welcome_message"],
        },
      },
      {
        name: "finalize_setup",
        description:
          "Write all collected configuration to the database — creates the business record, onboarding schema fields, and returns the shareable onboarding link. Only call this after the owner has reviewed the summary and explicitly confirmed.",
        parameters: {
          type: "OBJECT",
          properties: {
            confirmed: {
              type: "BOOLEAN",
              description: "Must be true. Only call after the owner confirms.",
            },
          },
          required: ["confirmed"],
        },
      },
    ],
  },
];
