# Customer Onboarding Agent

An AI-powered chat agent that replaces traditional onboarding forms with natural conversation. Customers provide their information through a friendly chat interface, and the agent extracts, validates, and saves each field automatically.

## How It Works

1. A business configures which fields to collect (name, email, company, etc.)
2. Customers visit a chat page (e.g., `/onboard/demo`)
3. The AI agent greets them and conversationally collects the required information
4. Fields are extracted, validated server-side, and saved in real time
5. Once all fields are collected and confirmed, a customer account is created

## Tech Stack

- **Frontend:** React 18 + Vite + Tailwind CSS v4
- **Backend:** Supabase Edge Functions (Deno/TypeScript)
- **Database:** Supabase Postgres
- **LLM:** Claude via Anthropic SDK (tool use for structured data extraction)

## Project Structure

```
react/                          # Frontend app
  src/
    components/                 # Chat UI components
    hooks/                      # React hooks (useChat)
    lib/                        # Supabase client

server/                         # Backend
  supabase/
    functions/
      chat/index.ts             # Main agent endpoint
      schema/index.ts           # Admin CRUD for onboarding fields
      on-complete/index.ts      # Post-onboarding webhook
      _shared/                  # Shared server logic (Claude client, prompts, validation)
    migrations/                 # Database schema + seed data
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- A [Supabase](https://supabase.com/) project
- An [Anthropic](https://console.anthropic.com/) API key (Claude)

### 1. Clone and install

```bash
git clone <repo-url>
cd Customer-Onboard-Agent
cd react && npm install
```

### 2. Configure environment variables

Create `react/.env`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

Set the Anthropic API key as a Supabase secret:

```bash
cd server
supabase secrets set ANTHROPIC_API_KEY=your_anthropic_api_key
```

### 3. Set up the database

```bash
cd server
supabase db push
```

This creates 5 tables (`businesses`, `onboarding_schema`, `customers`, `onboarding_sessions`, `conversation_log`) and seeds a demo business with 6 sample fields.

### 4. Run locally

Start the backend and frontend in separate terminals:

```bash
# Terminal 1 — Edge Functions
cd server && supabase functions serve

# Terminal 2 — Frontend
cd react && npm run dev
```

Visit `http://localhost:3000/onboard/demo` to try the demo.

## Key Features

- **Conversational data collection** — extracts multiple fields from natural language (e.g., "I'm Sarah from Acme" saves both name and company)
- **Dynamic schema** — businesses configure which fields to collect; no code changes needed
- **Real-time progress** — visual progress bar shows how many fields have been collected
- **Server-side validation** — every extracted field is validated before saving, never trusting the model alone
- **Correction support** — customers can update previously provided information
- **Multi-tenant** — supports multiple businesses, each with their own schema and brand tone

## Deployment

```bash
# Build frontend
cd react && npm run build

# Deploy edge functions
cd server && supabase functions deploy
```

## License

MIT
