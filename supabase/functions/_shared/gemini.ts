import { GoogleGenAI, FunctionCallingConfigMode, type Content, type FunctionDeclaration, type Part } from 'npm:@google/genai@^2.31.0'

// Gemini client for the edge functions. Model from GEMINI_MODEL (+ optional GEMINI_FALLBACK_MODEL).
const ai = new GoogleGenAI({ apiKey: Deno.env.get('GEMINI_API_KEY') ?? '' })
const MODEL = Deno.env.get('GEMINI_MODEL') ?? ''
const FALLBACK = Deno.env.get('GEMINI_FALLBACK_MODEL') || null

// Overloaded / rate-limited / server error: worth retrying. Anything else is not.
const RETRYABLE = [429, 500, 503]
const WAITS_MS = [2000, 5000]
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Runs call(model), retrying twice on overload; the last try uses the fallback model if set.
async function withRetry<T>(call: (model: string) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const last = attempt === WAITS_MS.length
    try {
      return await call(last && FALLBACK ? FALLBACK : MODEL)
    } catch (err) {
      const status = (err as { status?: number }).status ?? 0
      if (last || !RETRYABLE.includes(status)) throw err
      console.log(`gemini busy (${status}), retrying`)
      await sleep(WAITS_MS[attempt])
    }
  }
}

// One agent step: the model MUST answer with tool call(s) (mode ANY): finish / ask_user end the run.
export function callWithTools(opts: { system: string; contents: Content[]; tools: FunctionDeclaration[] }) {
  return withRetry((model) => ai.models.generateContent({
    model,
    contents: opts.contents,
    config: {
      systemInstruction: opts.system,
      tools: [{ functionDeclarations: opts.tools }],
      toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY } },
      temperature: 0,
    },
  }))
}

// One structured call (e.g. timetable image → slots): the answer must match `schema`.
export async function generateJSON(opts: { system: string; parts: Part[]; schema: unknown }) {
  const res = await withRetry((model) => ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: opts.parts }],
    config: {
      systemInstruction: opts.system,
      responseMimeType: 'application/json',
      responseJsonSchema: opts.schema,
      temperature: 0,
    },
  }))
  return JSON.parse(res.text ?? '{}')
}

export type { Content, FunctionDeclaration }
