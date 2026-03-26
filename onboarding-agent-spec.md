# Customer Onboarding Agent — Architecture & Implementation Spec

## Overview

A chat-based web app where an AI agent conversationally collects customer information (name, email, company, etc.) and creates their account. No document uploads, no KYC — just a natural conversation that replaces a boring form.

**Stack:** React + Vite (frontend), Supabase Edge Functions (backend), Claude via Anthropic SDK (LLM), Supabase Postgres (database).

---

## Project Structure

```
onboarding-agent/
├── react/                          # Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatWindow.jsx      # Main chat container
│   │   │   ├── ChatMessage.jsx     # Message bubble (user vs assistant)
│   │   │   ├── ChatInput.jsx       # Text input + send button
│   │   │   ├── ProgressBar.jsx     # Onboarding progress indicator
│   │   │   └── TypingIndicator.jsx # "Agent is typing..." animation
│   │   ├── hooks/
│   │   │   └── useChat.js          # Chat state management hook
│   │   ├── lib/
│   │   │   └── supabase.js         # Supabase client + API helpers
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── .env                        # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
│
├── server/                         # Backend
│   ├── functions/
│   │   ├── chat/                   # Main agent endpoint
│   │   │   └── index.ts
│   │   ├── schema/                 # Admin CRUD for onboarding fields
│   │   │   └── index.ts
│   │   ├── on-complete/            # Post-onboarding webhook
│   │   │   └── index.ts
│   │   └── _shared/                # Shared modules
│   │       ├── claude.ts           # Anthropic Claude SDK client
│   │       ├── prompts.ts          # Dynamic system prompt builder
│   │       ├── tools.ts            # Function calling tool definitions
│   │       ├── validation.ts       # Field validation logic
│   │       └── supabase.ts         # DB client + TypeScript types
│   ├── migrations/
│   │   └── 001_onboarding_schema.sql
│   └── config.toml
│
├── .env                            # ANTHROPIC_API_KEY
└── README.md
```

---

## Database Schema (Supabase Postgres)

### Tables

**businesses** — Companies using the onboarding agent
- `id` uuid PK
- `name` text
- `slug` text unique (used in URLs and API calls)
- `welcome_message` text (agent's first message)
- `brand_tone` text ('friendly' | 'professional' | 'casual')
- `settings` jsonb (webhook URLs, email API keys, etc.)
- `created_at` timestamptz

**onboarding_schema** — Configurable fields per business
- `id` uuid PK
- `business_id` uuid FK → businesses
- `field_name` text (machine key: 'email', 'company', etc.)
- `field_type` text ('text' | 'email' | 'phone' | 'url' | 'number' | 'select' | 'textarea')
- `field_label` text (human-readable: "Email address")
- `placeholder` text (example: "e.g. sarah@company.com")
- `required` boolean
- `validation_regex` text (custom regex, or pipe-separated options for select fields)
- `sort_order` int
- unique constraint on (business_id, field_name)

**customers** — Created after onboarding completes
- `id` uuid PK
- `business_id` uuid FK → businesses
- `email` text
- `name` text
- `custom_fields` jsonb (stores ALL collected fields as key-value)
- `status` text ('active' | 'pending' | 'archived')
- `created_at` timestamptz

**onboarding_sessions** — Tracks in-progress and completed sessions
- `id` uuid PK
- `business_id` uuid FK → businesses
- `customer_id` uuid FK → customers (set on completion)
- `collected_fields` jsonb (running state of what's been collected so far)
- `state` text ('in_progress' | 'completed' | 'abandoned')
- `started_at` timestamptz
- `completed_at` timestamptz

**conversation_log** — Full chat history
- `id` uuid PK
- `session_id` uuid FK → onboarding_sessions
- `role` text ('user' | 'model')
- `content` text
- `function_calls` jsonb (optional: log of tool calls made)
- `sent_at` timestamptz

### Indexes
- `onboarding_sessions(business_id, state)`
- `onboarding_sessions(state)` WHERE state = 'in_progress'
- `conversation_log(session_id, sent_at)`
- `customers(business_id, created_at)`
- `onboarding_schema(business_id, sort_order)`

### Row Level Security
- Business admins: read/write their own business data via `auth.jwt()->'app_metadata'->>'business_id'`
- Public/anonymous users: can create sessions, insert conversation messages, and read their own session

### Seed Data
Include a "Demo Business" with slug `demo` and 6 sample fields: name (text, required), email (email, required), company (text, required), role (text, optional), company_size (select, required, options: "1-10|11-50|51-200|201-1000|1000+"), phone (phone, optional).

---

## Server: Edge Functions

### 1. `chat/index.ts` — Main Agent Endpoint

**Request:** POST
```json
{
  "message": "I'm Alex from Acme Corp",   // null on first call to get greeting
  "session_id": "uuid-or-null",
  "business_slug": "demo"
}
```

**Response:**
```json
{
  "session_id": "uuid",
  "message": "Nice to meet you, Alex! What's your email?",
  "collected_fields": { "name": "Alex", "company": "Acme Corp" },
  "progress": { "required_total": 4, "required_done": 2, "percent": 50 },
  "completed": false,
  "function_calls": [
    { "name": "save_field", "field": "name", "value": "Alex", "status": "saved" },
    { "name": "save_field", "field": "company", "value": "Acme Corp", "status": "saved" }
  ]
}
```

**Core loop (10 steps):**

1. Load business by slug
2. Load onboarding schema for that business
3. Load or create session
4. Load conversation history (last 30 messages)
5. Save user message to conversation_log
6. Build dynamic system prompt (see Prompt Design below)
7. Call Claude with system prompt + history + tools
8. Process function calls (save_field → validate → write to session; complete_onboarding → create customer record)
9. Save assistant response to conversation_log
10. Return response with progress

**CORS:** Allow all origins (for dev); set proper origin in production.

**First message flow:** When `message` is null and there's no history, send `"(Customer just opened the chat)"` as the user message to trigger the greeting.

### 2. `schema/index.ts` — Admin Schema CRUD

Standard REST: GET (list fields), POST (add field), PUT (update field), DELETE (remove field). All filtered by `business_id` query param.

### 3. `on-complete/index.ts` — Post-Onboarding Hook

Fires asynchronously after `complete_onboarding`. Loads customer + business settings, then optionally sends a welcome email (via Resend or similar) and fires a webhook to an external CRM if configured in `business.settings`.

### 4. `_shared/` modules

**claude.ts** — Wrapper around the Anthropic Claude SDK.
- Model: `claude-sonnet-4-6` (fast, capable tool use)
- Temperature: 0.3 (low — we want reliable extraction, not creativity)
- Max tokens: 1024
- SDK: `@anthropic-ai/sdk` via `https://esm.sh/` for Deno
- Auth: `ANTHROPIC_API_KEY` environment variable

**prompts.ts** — Builds the system prompt dynamically per turn. See Prompt Design section.

**tools.ts** — Claude tool use declarations. See Tool Definitions section.

**validation.ts** — Server-side validation for each field type:
- email: regex check, lowercase
- phone: strip formatting, check 7-15 digits
- url: auto-prepend https://, URL constructor check
- number: isNaN check
- select: case-insensitive match against pipe-separated options
- text/textarea: optional custom regex, max 500 chars

**supabase.ts** — Singleton Supabase client using service role key + TypeScript interfaces for all tables.

---

## Claude Prompt Design

The system prompt is rebuilt on EVERY turn with fresh state from the database. It has four sections:

### Section 1: Role + Tone
```
You are an onboarding assistant for "{business.name}".
Your job is to collect customer information through natural conversation.

## TONE
{tone guide based on business.brand_tone}
```

Tone options:
- friendly: "Be warm and conversational. Use casual language, contractions, and personality."
- professional: "Be polite and clear. Proper grammar, no slang, but not robotic."
- casual: "Be relaxed and fun. Short sentences, emoji okay, feel like texting a friend."

### Section 2: Field State (dynamic)
```
## FIELDS TO COLLECT

Progress: 50% complete (2/4 required fields)

Already collected:
  - Full name: Alex Chen
  - Company name: Acme Corp

Still needed (required):
  - email (email) — "Email address" — example: e.g. sarah@company.com
  - company_size (select) — "Company size" [options: 1-10, 11-50, 51-200, 201-1000, 1000+]

Optional (ask only if natural):
  - role (text) — "Your role"
  - phone (phone) — "Phone number"
```

### Section 3: Behavioral Rules
```
## RULES

1. EXTRACT data from natural language. If someone says "I'm Sarah from Acme,
   sarah@acme.com" — call save_field THREE times. Never re-ask for info already given.

2. COLLECT 1-2 fields per turn. Group related fields (name + email, company + role).

3. VALIDATE before saving. If email looks wrong, ask to confirm.

4. BE CONVERSATIONAL. Don't say "Please provide your email." Say "What's the best
   email to reach you at?"

5. WHEN ALL REQUIRED FIELDS COLLECTED: show a brief summary and ask customer to
   confirm. Only call complete_onboarding after explicit confirmation.

6. HANDLE CORRECTIONS. If someone says "actually my email is different" — save_field
   with the new value.

7. STAY ON TASK. Unrelated questions get a one-sentence answer, then steer back.

8. NEVER invent or assume data. If unsure, ask.

9. FIRST MESSAGE: if no fields collected yet, greet with the business's welcome_message
   then ask for the first field.

10. Keep responses SHORT. 1-3 sentences max.
```

### Key Design Decisions
- **Dynamic state injection**: The prompt is rebuilt every turn. The model always knows exactly where it is — no relying on memory.
- **Low temperature (0.3)**: Reliable extraction > creative responses.
- **Thinking level "low"**: Fast + cheap. Deep reasoning isn't needed for data collection.
- **Rule #1 (multi-extraction)**: Without this, models acknowledge info but still ask one-by-one.
- **Rule #5 changes based on state**: When all required fields are collected, the rule switches to "show summary and ask to confirm."

---

## Claude Tool Use Definitions

### save_field
- **When:** Customer provides info matching a schema field
- **Can be called multiple times per response** (critical for multi-field extraction)
- **Params:** `field_name` (must match schema exactly), `value` (cleaned/normalized)

### complete_onboarding
- **When:** ALL required fields collected AND customer explicitly confirms
- **Params:** `notes` (optional — e.g. "customer wants enterprise plan")
- **Guard:** Server-side check that all required fields exist before creating the customer

### request_correction
- **When:** Customer wants to change a previously saved field
- **Params:** `field_name`, `new_value`

---

## Frontend: React App

### Architecture
- **useChat hook**: Manages messages array, loading state, session ID, progress, and completion state. Exposes `initialize()` (triggers greeting) and `sendMessage(text)`.
- **supabase.js**: Supabase client + `sendChatMessage()` and `initSession()` helpers that call `supabase.functions.invoke("chat", { body })`.

### Components
- **ChatWindow**: Main container. Calls `initialize()` on mount. Renders message list + input.
- **ChatMessage**: Bubble component. User messages right-aligned with accent color, assistant messages left-aligned with neutral background.
- **ChatInput**: Text input + send button. Disabled when loading or completed.
- **ProgressBar**: Shows "Step X of Y" with a visual progress bar. Turns green on completion.
- **TypingIndicator**: Three-dot animation shown while waiting for Claude response.

### UX Details
- Auto-scroll to bottom on new messages
- Input auto-focuses after agent responds
- Enter key sends message
- Show progress bar at top of chat
- On completion, show a success state and disable input
- The business slug comes from the URL (e.g. `/onboard/demo`)

### Styling
Keep it clean and modern. The chat should feel like a messaging app, not a corporate form. Rounded message bubbles, subtle animations on new messages, a compact progress indicator.

---

## Example Conversation Trace

```
Turn 1 — Session created, 0% complete
System prompt: all fields missing
User: "(Customer just opened the chat)"
Claude: "Hey there! I'm here to get you set up. This will just take a minute.
         What's your name?"

Turn 2 — 0% complete
User: "I'm Alex Chen, I run a small agency called Bright Ideas"
Claude calls: save_field("name", "Alex Chen")
              save_field("company", "Bright Ideas")
Claude: "Nice to meet you, Alex! Bright Ideas — great name.
         What's the best email to reach you at?"

Turn 3 — 50% complete
User: "alex@brightideas.co"
Claude calls: save_field("email", "alex@brightideas.co")
Claude: "Got it. And roughly how big is your team — would you say
         1-10, 11-50, or larger?"

Turn 4 — 75% complete
User: "just me and 4 others"
Claude calls: save_field("company_size", "1-10")
Claude: "Perfect, here's what I have:

         Name: Alex Chen
         Company: Bright Ideas
         Email: alex@brightideas.co
         Team size: 1-10

         Does everything look right?"

Turn 5 — 100% complete, awaiting confirmation
User: "Looks good!"
Claude calls: complete_onboarding()
Claude: "You're all set! Your account is live. You'll get a welcome
         email at alex@brightideas.co shortly."
```

---

## Environment Variables

### react/.env
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### server (Supabase secrets)
```
ANTHROPIC_API_KEY=your_anthropic_api_key
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-available in edge functions.

---

## API Reference

### Claude API Call Shape (via Anthropic SDK)
```typescript
const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 1024,
  temperature: 0.3,
  system: "...",
  messages: [
    { role: "user", content: "..." },
    { role: "assistant", content: "..." },
    ...
  ],
  tools: [
    {
      name: "save_field",
      description: "...",
      input_schema: {
        type: "object",
        properties: { ... },
        required: [...]
      }
    }
  ]
});
```

### Claude Response Shape
```json
{
  "content": [
    { "type": "text", "text": "Nice to meet you!" },
    { "type": "tool_use", "id": "toolu_...", "name": "save_field", "input": { "field_name": "name", "value": "Alex" } }
  ]
}
```

Content blocks can contain both text and tool_use entries. Process ALL blocks — there can be multiple tool calls in a single response.
