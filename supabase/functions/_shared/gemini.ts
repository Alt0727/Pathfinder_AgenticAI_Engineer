import { GoogleGenAI, FunctionCallingConfigMode, type Content, type FunctionDeclaration } from 'npm:@google/genai@^2.31.0'

// Gemini client for the edge functions. Model from GEMINI_MODEL (+ optional GEMINI_FALLBACK_MODEL).
const ai = new GoogleGenAI({ apiKey: Deno.env.get('GEMINI_API_KEY') ?? '' })
const MODEL = Deno.env.get('GEMINI_MODEL') ?? ''
const FALLBACK = Deno.env.get('GEMINI_FALLBACK_MODEL') || null

// Overloaded / rate-limited / server error: worth retrying. Anything else is not.
const RETRYABLE = [429, 500, 503]
const WAITS_MS = [2000, 5000]
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// One agent step: the model MUST answer with tool call(s) (mode ANY): finish / ask_user end the run.
// Retries twice on overload; the last try uses the fallback model if set.
export async function callWithTools(opts: { system: string; contents: Content[]; tools: FunctionDeclaration[] }) {
  for (let attempt = 0; ; attempt++) {
    const last = attempt === WAITS_MS.length
    try {
      return await ai.models.generateContent({
        model: last && FALLBACK ? FALLBACK : MODEL,
        contents: opts.contents,
        config: {
          systemInstruction: opts.system,
          tools: [{ functionDeclarations: opts.tools }],
          toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY } },
          temperature: 0,
        },
      })
    } catch (err) {
      const status = (err as { status?: number }).status ?? 0
      if (last || !RETRYABLE.includes(status)) throw err
      console.log(`gemini busy (${status}), retrying`)
      await sleep(WAITS_MS[attempt])
    }
  }
}

export type { Content, FunctionDeclaration }

