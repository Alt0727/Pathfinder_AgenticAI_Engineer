import { GoogleGenAI } from '@google/genai'
import { config } from '../config.js'

const ai = new GoogleGenAI({ apiKey: config.geminiApiKey })

// Overloaded / rate-limited / server error: worth retrying. Anything else (bad key, bad request) is not.
const RETRYABLE = [429, 500, 503]
const WAITS_MS = [2000, 5000]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Which model actually answered, and how often (the fallback may answer when the main model is busy)
export const modelsUsed = new Map()

// One structured call: the model must answer with JSON matching `schema` (no free text to parse).
// Retries twice on overload; the last try uses GEMINI_FALLBACK_MODEL if set.
export async function generateJSON({ system, prompt, schema }) {
  for (let attempt = 0; ; attempt++) {
    const last = attempt === WAITS_MS.length
    const model = last && config.geminiFallbackModel ? config.geminiFallbackModel : config.geminiModel
    try {
      const res = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: system,
          responseMimeType: 'application/json',
          responseJsonSchema: schema,
          temperature: 0,          // same input → same cards
        },
      })
      modelsUsed.set(model, (modelsUsed.get(model) ?? 0) + 1)
      return JSON.parse(res.text)
    } catch (err) {
      if (last || !RETRYABLE.includes(err.status)) throw err
      console.log(`gemini busy (${err.status}), retrying in ${WAITS_MS[attempt] / 1000}s`)
      await sleep(WAITS_MS[attempt])
    }
  }
}
