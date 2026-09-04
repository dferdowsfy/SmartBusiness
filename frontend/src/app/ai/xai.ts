// Server-only xAI Responses API client shared by SmartPR's AI routes.

export const XAI_MODEL = process.env.XAI_MODEL || "grok-4.3";

const XAI_API_KEY = process.env.XAI_API_KEY || "";
const XAI_BASE_URL = (process.env.XAI_BASE_URL || "https://api.x.ai/v1").replace(/\/$/, "");

export function isXaiConfigured(): boolean {
  return Boolean(XAI_API_KEY);
}

export class XaiApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string
  ) {
    super(`xAI error ${status}`);
    this.name = "XaiApiError";
  }
}

type XaiInputMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type XaiResponse = {
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
};

function outputText(payload: XaiResponse): string {
  return (payload.output || [])
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text" && typeof item.text === "string")
    .map((item) => item.text || "")
    .join("");
}

export async function requestXaiText(options: {
  input: XaiInputMessage[];
  maxOutputTokens: number;
  temperature: number;
  signal: AbortSignal;
}): Promise<string> {
  if (!XAI_API_KEY) throw new Error("XAI_API_KEY is not configured on the server.");

  const response = await fetch(`${XAI_BASE_URL}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: XAI_MODEL,
      input: options.input,
      reasoning: { effort: "none" },
      max_output_tokens: options.maxOutputTokens,
      temperature: options.temperature,
      // Uploaded business documents should not be retained by the model provider.
      store: false,
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new XaiApiError(response.status, detail);
  }

  return outputText((await response.json()) as XaiResponse);
}
