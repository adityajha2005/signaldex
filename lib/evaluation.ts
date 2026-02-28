const XAI_URL = "https://api.x.ai/v1/chat/completions";
const MODEL = process.env.XAI_MODEL ?? "grok-4-1-fast-reasoning";
const TIMEOUT_MS = 8_000;

function timedFetch(url: string, options: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() =>
    clearTimeout(id)
  );
}

async function chat(content: string): Promise<string> {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error("XAI_API_KEY is not set");

  const res = await timedFetch(XAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content }],
      temperature: 0,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`xAI API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (text == null) throw new Error("xAI API: empty or invalid response");
  return text;
}

class JsonParseError extends Error {}

function parseScoreJson(raw: string): { score: number } {
  const trimmed = raw.trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new JsonParseError("Invalid JSON: no object found");
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      throw new JsonParseError("Invalid JSON: could not parse extracted object");
    }
  }
  if (typeof parsed !== "object" || parsed === null || !("score" in parsed))
    throw new JsonParseError("Invalid JSON: missing score field");
  const score = (parsed as { score: unknown }).score;
  if (typeof score !== "number" || score < 0 || score > 1)
    throw new JsonParseError("Invalid JSON: score must be a number 0–1");
  return { score };
}

function buildGradingPrompt(testInput: string, output: string): string {
  return `You are a strict evaluator. Score the model output below based on the original task.

Evaluate on:
- Relevance: does the output address the task in testInput?
- Clarity: is the output clear and readable?
- Task completion: does it fully complete what was asked?

Return only valid JSON in this exact format:
{
  "score": <number between 0 and 1>,
  "reason": "<one sentence>"
}

--- Task (testInput) ---
${testInput}

--- Model Output ---
${output}

Only return JSON.`;
}

export type EvaluateSingleRunResult = { output: string; score: number };

/**
 * Run prompt + testInput through xAI, then grade the output with testInput included.
 * Timeout: 8s per call. Retries grading ONLY if response is not valid JSON.
 * Network errors and API 5xx are NOT retried.
 */
export async function evaluateSingleRun(
  promptContent: string,
  testInput: string
): Promise<EvaluateSingleRunResult> {
  const userContent = [promptContent, testInput].filter(Boolean).join("\n\n");
  const output = await chat(userContent);

  const gradingPrompt = buildGradingPrompt(testInput, output);

  let score: number;
  let raw: string;
  try {
    raw = await chat(gradingPrompt);
    score = parseScoreJson(raw).score;
  } catch (e) {
    // Retry only on JSON parse failure — not on network or API errors
    if (!(e instanceof JsonParseError)) throw e;
    raw = await chat(gradingPrompt);
    score = parseScoreJson(raw).score;
  }

  return { output, score };
}
