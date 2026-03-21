# Onboarding Agent

Chat-based web app where an AI agent conversationally collects customer info and creates their account. Replaces boring forms with natural conversation.

## Tech Stack

- Frontend: React 18 + Vite (in `react/`)
- Backend: Supabase Edge Functions (Deno, in `server/functions/`)
- Database: Supabase Postgres
- LLM: Gemini 3.1 Pro via Google AI Studio API
- Styling: Tailwind CSS v4

## Project Structure

```
react/                        # Frontend app
  src/
    components/               # React components
      ChatWindow.jsx          # Main chat container
      ChatMessage.jsx         # Message bubble
      ChatInput.jsx           # Text input + send
      ProgressBar.jsx         # Onboarding progress
      TypingIndicator.jsx     # Typing animation
    hooks/
      useChat.js              # Chat state management
    lib/
      supabase.js             # Supabase client + API helpers
    App.jsx
    main.jsx

server/                       # Backend
  functions/
    chat/index.ts             # Main agent endpoint (POST)
    schema/index.ts           # Admin CRUD for onboarding fields
    on-complete/index.ts      # Post-onboarding webhook
    _shared/
      gemini.ts               # Gemini API client wrapper
      prompts.ts              # Dynamic system prompt builder
      tools.ts                # Function calling tool definitions
      validation.ts           # Field validation per type
      supabase.ts             # DB client + types
  migrations/
    001_onboarding_schema.sql # All tables, indexes, RLS, seed data
```

## Commands

- `cd react && npm install` — Install frontend deps
- `cd react && npm run dev` — Start frontend dev server (port 3000)
- `cd react && npm run build` — Build for production
- `cd server && supabase functions serve` — Run edge functions locally
- `cd server && supabase db push` — Apply migrations
- `cd server && supabase functions deploy` — Deploy to production

## Architecture Rules

- The `react/` and `server/` folders are fully independent. No shared code between them.
- Edge functions are written in TypeScript for Deno runtime (use `https://esm.sh/` imports, not npm).
- All shared server logic goes in `server/functions/_shared/`. Edge functions import from there.
- The frontend calls edge functions via `supabase.functions.invoke()`, never direct HTTP.
- Every field the LLM extracts MUST be validated server-side in `validation.ts` before saving. Never trust the model.

## Database

5 tables in Supabase Postgres: `businesses`, `onboarding_schema`, `customers`, `onboarding_sessions`, `conversation_log`.

Key design decisions:
- `onboarding_schema` makes this a platform — businesses configure which fields to collect. The agent reads the schema at runtime.
- `customers.custom_fields` is JSONB storing all collected data. No migrations needed when fields change.
- `onboarding_sessions.collected_fields` is JSONB tracking what's been collected so far in a session.
- Row Level Security: admins manage their business data, anonymous users can create sessions and chat.
- Include seed data: a "Demo Business" with slug `demo` and 6 sample fields (name, email, company, role, company_size, phone).

## Gemini API Integration

- Model: `gemini-3.1-pro-preview-customtools` (prioritizes custom function calls over defaults)
- Base URL: `https://generativelanguage.googleapis.com/v1beta`
- Auth: API key as query param `?key={GEMINI_API_KEY}`
- Temperature: 0.3 (low — reliable extraction over creativity)
- Thinking level: "low" (fast + cheap)
- Tool config mode: "AUTO"

### Function Calling Tools

3 tools defined for Gemini:

1. **save_field** — Save an extracted field value. Can be called multiple times per response. Params: `field_name` (must match schema), `value` (cleaned).
2. **complete_onboarding** — Create customer account. Only after all required fields collected AND customer confirms. Params: `notes` (optional).
3. **request_correction** — Overwrite a previously saved field. Params: `field_name`, `new_value`.

### System Prompt Design

The system prompt is rebuilt on EVERY turn with fresh state from the database. It contains:
1. Role + tone (based on `business.brand_tone`)
2. Dynamic field state: which fields are collected, which are missing, progress percentage
3. 10 behavioral rules (see spec doc for full text)

Critical rules for the prompt:
- Extract multiple fields from a single message (e.g., "I'm Sarah from Acme" = 2 fields)
- Collect 1-2 fields per turn, don't overwhelm
- When all required fields collected, show summary and ask to confirm
- Keep responses to 1-3 sentences max
- Never invent or assume data

## Chat Edge Function Core Loop

The `chat/index.ts` function follows these 10 steps on every request:

1. Load business by slug
2. Load onboarding schema for that business
3. Load or create session
4. Load conversation history (last 30 messages)
5. Save user message to conversation_log
6. Build dynamic system prompt via `prompts.ts`
7. Call Gemini with system prompt + history + tools
8. Process function calls (validate + save fields, or create customer)
9. Save assistant response to conversation_log
10. Return response with session_id, message, progress, and completion status

First message: when `message` is null and no history exists, send `"(Customer just opened the chat)"` to trigger the greeting.

## Frontend Behavior

- `useChat` hook manages: messages array, loading state, session ID, progress object, completion boolean.
- On mount, call `initialize()` which invokes the chat function with no message to get the greeting.
- Messages render as bubbles: user right-aligned with accent color, assistant left-aligned with neutral bg.
- Show typing indicator while waiting for response.
- Progress bar at top shows "Step X of Y" with visual bar.
- Auto-scroll to bottom on new messages.
- Input auto-focuses after agent responds.
- Enter sends, disabled when loading or completed.
- Business slug comes from URL path (e.g., `/onboard/demo`).
- On completion, show success state and disable input.

## Environment Variables

### react/.env
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### Supabase secrets (server)
```
GEMINI_API_KEY=your_gemini_api_key
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-available in edge functions.

## Styling (Tailwind CSS)

- Use Tailwind CSS v4 with Vite plugin (`@tailwindcss/vite`)
- Install: `npm install tailwindcss @tailwindcss/vite`
- Add the Vite plugin in `vite.config.js`:
  ```js
  import tailwindcss from "@tailwindcss/vite";
  export default defineConfig({ plugins: [react(), tailwindcss()] });
  ```
- Import Tailwind in `src/index.css`: `@import "tailwindcss";`
- Use Tailwind utility classes for ALL styling — no custom CSS files, no inline `style={}` objects
- Use `className` exclusively, never `style` prop (except for truly dynamic values like calculated widths)
- Prefer Tailwind's built-in colors (e.g., `bg-blue-600`, `text-gray-700`) — define a custom theme only if needed
- Use `dark:` variant classes for dark mode support
- Common patterns for this project:
  - Chat bubbles: `rounded-2xl px-4 py-3 max-w-[80%]`
  - User bubble: `bg-blue-600 text-white ml-auto rounded-br-sm`
  - Assistant bubble: `bg-gray-100 dark:bg-gray-800 rounded-bl-sm`
  - Progress bar fill: `transition-all duration-500 ease-out`
  - Typing dots: `animate-bounce` with staggered `animation-delay`

## Coding Style

- React: functional components, hooks only, no class components
- Frontend uses TypeScript (`.tsx`/`.ts` extensions)
- Server code is TypeScript (`.ts`)
- Use `const` by default, `let` only when reassignment is needed
- Prefer early returns over nested if/else
- Error messages should be user-friendly, not technical
- No `console.log` in production code except for error logging in edge functions
- CORS headers on all edge function responses

## Important Notes

- NEVER commit `.env` files
- The Gemini API key must be set as a Supabase secret, not hardcoded
- Always validate fields server-side even though Gemini also validates
- The `complete_onboarding` function must double-check all required fields exist before creating a customer — don't trust the model's judgment alone
- Edge functions must return CORS headers including for OPTIONS preflight requests
- Conversation history sent to Gemini is limited to last 30 messages to stay within context limits
- Reference the spec document at `onboarding-agent-spec.md` for complete API shapes, example conversation traces, and detailed prompt text