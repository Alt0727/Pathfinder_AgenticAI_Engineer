// The tool loop: Gemini picks tool(s) → code runs them (with guardrails) → results go back → repeat.
// Max 8 steps. Every step is saved to agent_runs.steps as it happens (the live run panel).
import { db } from '../_shared/supabase.ts'
import { callWithTools, type Content } from '../_shared/gemini.ts'
import { buildContext } from './context.ts'
import { systemPrompt } from './prompt.ts'
import { type Ctx, type Mode, runTool, toolsFor } from './tools/index.ts'

const MAX_STEPS = 8
const ENDS_RUN = ['ask_user', 'finish']

export async function runAgent(run: { runId: string; userId: string; trigger: string; payload: Record<string, unknown> }) {
  const mode: Mode = run.trigger === 'chat' || run.trigger === 'answer' ? 'user' : 'auto'
  const tools = toolsFor(mode)
  const ctx: Ctx = { userId: run.userId, runId: run.runId, mode, writes: 0, fixedClashes: [] }
  const steps: Record<string, unknown>[] = []
  let status: 'done' | 'asked' | 'failed' = 'done'
  let summary = `Stopped after ${MAX_STEPS} steps.`

  try {
    const { message, interests } = await buildContext(run.userId, run.trigger, run.payload)
    const system = systemPrompt(mode, interests)
    const contents: Content[] = [{ role: 'user', parts: [{ text: message }] }]

    let ended = false
    for (let step = 1; step <= MAX_STEPS && !ended; step++) {
      // Last step: only tools that END the run (ask_user only, if a clash is still unasked),
      // so every run finishes with a summary or a question, never mid-way.
      const offered = step < MAX_STEPS
        ? tools
        : tools.filter((t) => (ctx.fixedClashes.length ? ['ask_user'] : ENDS_RUN).includes(t.declaration.name ?? ''))
      const res = await callWithTools({ system, contents, tools: offered.map((t) => t.declaration) })
      const calls = res.functionCalls ?? []
      if (!calls.length) { summary = res.text?.trim() || 'Done.'; break }

      // Gemini's reply goes back into the history UNCHANGED (it carries thought signatures).
      const reply = res.candidates?.[0]?.content
      if (reply) contents.push(reply)

      const responses = []
      for (const call of calls) {
        const name = call.name ?? ''
        const result = await runTool(offered, name, call.args ?? {}, ctx)
        steps.push({ step, tool: name, args: call.args ?? {}, result, at: new Date().toISOString() })
        await db.from('agent_runs').update({ steps }).eq('id', run.runId)   // → realtime → run panel
        responses.push({ functionResponse: { id: call.id, name, response: result } })

        if (result.ok && ENDS_RUN.includes(name)) {
          ended = true
          status = name === 'ask_user' ? 'asked' : 'done'
          summary = name === 'ask_user' ? `Asked: ${call.args?.question}` : String(call.args?.summary ?? '')
          break
        }
      }
      contents.push({ role: 'user', parts: responses })
    }
  } catch (err) {
    status = 'failed'
    summary = `Error: ${err instanceof Error ? err.message : String(err)}`.slice(0, 500)
    console.error('agent run failed', run.runId, summary)
  }

  await db.from('agent_runs').update({ status, summary, steps, finished_at: new Date().toISOString() }).eq('id', run.runId)
  console.log('agent run', run.runId, run.trigger, status, `${steps.length} step(s), ${ctx.writes} write(s)`)
}
