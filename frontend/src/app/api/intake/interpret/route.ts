// Server-side natural-language intake interpretation.
//
// Reuses the EXISTING OpenRouter/Grok setup (same env vars and calling pattern
// as api/analyze-document). The browser never sees OPENROUTER_API_KEY.
//
// SCOPE: this route converts a sentence into EXISTING SmartPR intake values.
// It does NOT decide permits, licenses, or documents — the deterministic rules
// engine remains the sole authority for requirement generation. The model may
// only choose from the candidate ids supplied by the caller (drawn from the
// active knowledge base), and anything outside that set is stripped here before
// the client validates again against the KB.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { clampCandidates, type KbCandidates } from "../../../ai/intake/kbCandidates";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "x-ai/grok-4.20";
const OPENROUTER_BASE_URL =
  process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";

const MAX_DESCRIPTION_CHARS = 1200;

interface InterpretPayload {
  description?: string;
  candidates?: KbCandidates;
  lang?: string;
}

function buildSystemPrompt(candidates: KbCandidates, isEs: boolean): string {
  const businessTypes = candidates.businessTypes
    .map((b) => `- ${b.id} :: ${b.name}`)
    .join("\n") || "- (none)";
  const municipalities = candidates.municipalities.join(", ") || "(none)";
  const questions = candidates.questions
    .map((q) => {
      const opts = q.options && q.options.length ? ` :: options = ${q.options.join(" | ")}` : "";
      return `- ${q.id} :: type=${q.type} :: ${q.question}${opts}`;
    })
    .join("\n") || "- (none)";

  return `You are the SmartPR intake interpretation engine.

Your job is to translate a user's description of a Puerto Rico business into existing SmartPR intake values.

You DO NOT determine permits, licenses, registrations, or required documents.
You DO NOT create regulatory requirements.
A separate deterministic rules engine decides all requirements from the values you extract.

You may ONLY select:
- business type ids from the SmartPR context below
- municipalities from the SmartPR context below
- SmartPR question ids from the SmartPR context below

Never invent ids. If the right option is not listed, omit the field entirely.

Only extract facts that are:
1. explicitly stated by the user, or
2. strongly implied by the statement

CRITICAL — MISSING INFORMATION IS UNKNOWN, NOT FALSE.
If the user does not mention a topic, OMIT that question entirely. Do not return false for it.

Example: "I want to open a restaurant in San Juan."
Do NOT assume alcohol = false, outdoor seating = false, live entertainment = false,
employees = false, or renovations = false. Omit all of them.

Only return false when the user explicitly negates something.
Example: "I will not sell alcohol." -> Q_ALCOHOL_SOLD = false.

CONFIDENCE:
- Explicitly stated facts: 0.90–0.99
- Strongly implied facts: 0.70–0.89
- Anything uncertain: below 0.60 (it will be dropped, which is correct)

SMARTPR CONTEXT — BUSINESS TYPES:
${businessTypes}

SMARTPR CONTEXT — MUNICIPALITIES:
${municipalities}

SMARTPR CONTEXT — QUESTIONS:
${questions}

Return ONLY valid JSON (no markdown, no commentary) with this exact structure:
{
  "summary": "one short sentence describing the business",
  "businessType": { "id": "BT_...", "name": "...", "confidence": 0.0 },
  "municipality": { "value": "...", "confidence": 0.0 },
  "profileValues": [ { "key": "industry", "value": "...", "confidence": 0.0 } ],
  "answers": [ { "questionId": "Q_...", "value": true, "confidence": 0.0 } ]
}

Omit "businessType" or "municipality" entirely when unknown. Use an empty array
for "profileValues"/"answers" when nothing is known. The only allowed
profileValues keys are "industry" and "location_type".${
    isEs ? '\n\nWrite the "summary" field in Spanish. Keep all ids and JSON keys exactly as specified.' : ""
  }

Return ONLY the JSON. No other text.`;
}

function parseInterpretation(raw: string): Record<string, unknown> | null {
  const cleaned = (raw || "").replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Defense in depth: strip any id the model invented that was not offered as a
 * candidate. The client validates again against the full active KB.
 */
function stripUnknownIds(
  data: Record<string, unknown>,
  candidates: KbCandidates
): Record<string, unknown> {
  const typeIds = new Set(candidates.businessTypes.map((b) => b.id));
  const questionIds = new Set(candidates.questions.map((q) => q.id));
  const municipalities = new Set(candidates.municipalities.map((m) => m.toLowerCase()));

  const bt = data.businessType as { id?: unknown } | undefined | null;
  if (bt && (typeof bt.id !== "string" || !typeIds.has(bt.id))) delete data.businessType;

  const muni = data.municipality as { value?: unknown } | undefined | null;
  if (muni && (typeof muni.value !== "string" || !municipalities.has(muni.value.toLowerCase()))) {
    delete data.municipality;
  }

  if (Array.isArray(data.answers)) {
    data.answers = (data.answers as Array<{ questionId?: unknown }>).filter(
      (a) => typeof a?.questionId === "string" && questionIds.has(a.questionId)
    );
  }

  // The model must never emit requirements; drop any such field defensively.
  delete data.requirements;
  delete data.documents;

  return data;
}

export async function POST(request: Request) {
  if (!OPENROUTER_API_KEY) {
    return Response.json(
      { error: "OPENROUTER_API_KEY is not configured on the server." },
      { status: 503 }
    );
  }

  let payload: InterpretPayload;
  try {
    payload = (await request.json()) as InterpretPayload;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const description = (payload.description || "").slice(0, MAX_DESCRIPTION_CHARS).trim();
  if (!description) {
    return Response.json({ error: "A business description is required." }, { status: 400 });
  }

  const candidates = clampCandidates(
    payload.candidates ?? { businessTypes: [], municipalities: [], questions: [] }
  );
  const isEs = payload.lang === "es";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: "system", content: buildSystemPrompt(candidates, isEs) },
          { role: "user", content: description },
        ],
        max_tokens: 900,
        temperature: 0.1,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      return Response.json(
        { error: `OpenRouter error ${res.status}`, detail: errText.slice(0, 500) },
        { status: 502 }
      );
    }

    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content || "";
    const parsed = parseInterpretation(text);
    if (!parsed) {
      return Response.json({ error: "Could not parse the AI response." }, { status: 502 });
    }

    return Response.json({
      interpretation: stripUnknownIds(parsed, candidates),
      ai_model: OPENROUTER_MODEL,
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return Response.json(
      { error: aborted ? "AI request timed out" : "AI request failed" },
      { status: 504 }
    );
  } finally {
    clearTimeout(timer);
  }
}
