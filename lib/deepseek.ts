import OpenAI from "openai";
import { AI_CONFIG } from "@/lib/ai-config";

export interface DeepSeekExpansionRequest {
  itinerary: unknown;
  prompt: string;
}

export class DeepSeekTimeoutError extends Error {
  constructor() {
    super("DeepSeek request timed out.");
    this.name = "DeepSeekTimeoutError";
  }
}

function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /timeout|timed out|deadline exceeded|abort/i.test(`${error.name} ${error.message}`);
}

/** Uses the official OpenAI SDK against DeepSeek's OpenAI-compatible endpoint. */
export async function expandItineraryWithDeepSeek(
  request: DeepSeekExpansionRequest
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("Missing required environment variable: DEEPSEEK_API_KEY");

  const client = new OpenAI({
    apiKey,
    baseURL: AI_CONFIG.deepseek.baseUrl,
    timeout: AI_CONFIG.deepseek.timeoutMs,
  });

  try {
    const completion = await client.chat.completions.create({
      model: AI_CONFIG.deepseek.model,
      temperature: AI_CONFIG.deepseek.temperature,
      max_tokens: AI_CONFIG.deepseek.maxOutputTokens,
      reasoning_effort: "none",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: request.prompt },
        {
          role: "user",
          content: `Expand this itinerary and return only the requested JSON object:\n${JSON.stringify(request.itinerary)}`,
        },
      ],
    });
    const rawResponse = completion.choices[0]?.message.content;
    if (!rawResponse) throw new Error("DeepSeek returned an empty response.");
    return rawResponse;
  } catch (error) {
    if (isTimeoutError(error)) throw new DeepSeekTimeoutError();
    throw error;
  }
}
