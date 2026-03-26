import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.39.0";

const CLAUDE_MODEL = "claude-sonnet-4-6";

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string | ClaudeContentBlock[];
}

export interface ClaudeContentBlock {
  type: "text" | "tool_use" | "tool_result";
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

export interface ClaudeTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ClaudeFunctionCall {
  name: string;
  args: Record<string, unknown>;
}

export interface ClaudeParsedResponse {
  text: string;
  functionCalls: ClaudeFunctionCall[];
}

let clientInstance: Anthropic | null = null;

function getClient(): Anthropic {
  if (!clientInstance) {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    clientInstance = new Anthropic({ apiKey });
  }
  return clientInstance;
}

export async function callClaude(
  systemPrompt: string,
  messages: ClaudeMessage[],
  tools: ClaudeTool[],
  options?: {
    temperature?: number;
    maxTokens?: number;
    toolChoice?: { type: "auto" | "any" | "none" } | { type: "tool"; name: string };
  },
): Promise<Anthropic.Message> {
  const client = getClient();

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: options?.maxTokens ?? 1024,
    temperature: options?.temperature ?? 0.3,
    system: systemPrompt,
    messages,
    tools,
    ...(options?.toolChoice ? { tool_choice: options.toolChoice } : {}),
  });

  return response;
}

export function parseClaudeResponse(
  // deno-lint-ignore no-explicit-any
  response: any,
): ClaudeParsedResponse {
  const content = response?.content || [];

  let text = "";
  const functionCalls: ClaudeFunctionCall[] = [];

  for (const block of content) {
    if (block.type === "text") {
      text += block.text;
    }
    if (block.type === "tool_use") {
      functionCalls.push({
        name: block.name,
        args: (block.input as Record<string, unknown>) || {},
      });
    }
  }

  return { text: text.trim(), functionCalls };
}
