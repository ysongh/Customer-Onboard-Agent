const GEMINI_MODEL = "gemini-3.1-pro-preview-customtools";
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

export interface GeminiRequest {
  system_instruction: { parts: { text: string }[] };
  // deno-lint-ignore no-explicit-any
  contents: { role: string; parts: any[] }[];
  tools: unknown[];
  generation_config: {
    temperature: number;
    max_output_tokens: number;
  };
  tool_config: {
    function_calling_config: { mode: string };
  };
}

export interface GeminiFunctionCall {
  name: string;
  args: Record<string, unknown>;
}

export interface GeminiParsedResponse {
  text: string;
  functionCalls: GeminiFunctionCall[];
}

export async function callGemini(
  request: GeminiRequest,
): Promise<unknown> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const url = `${BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Gemini API error ${response.status}: ${errorBody}`,
    );
  }

  return response.json();
}

export function parseGeminiResponse(
  // deno-lint-ignore no-explicit-any
  response: any,
): GeminiParsedResponse {
  const parts = response?.candidates?.[0]?.content?.parts || [];

  let text = "";
  const functionCalls: GeminiFunctionCall[] = [];

  for (const part of parts) {
    if (part.text) {
      text += part.text;
    }
    if (part.functionCall) {
      functionCalls.push({
        name: part.functionCall.name,
        args: part.functionCall.args || {},
      });
    }
  }

  return { text: text.trim(), functionCalls };
}
