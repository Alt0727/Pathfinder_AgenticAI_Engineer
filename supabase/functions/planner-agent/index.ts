// planner-agent (AI #2): POST { trigger, user_id, payload } with header x-agent-secret.
// Callers: the listener (new_card, card_changed) and app-api (plan_week, chat, answer). Never a browser.
// Opens an agent_runs row, replies { run_id } AT ONCE, and runs the agent in the background.
import { db } from '../_shared/supabase.ts'
import { json, safeEqual } from '../_shared/cors.ts'
import { runAgent } from './loop.ts'

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void }

const SECRET = Deno.env.get('AGENT_SECRET') ?? ''
const TRIGGERS = ['new_card', 'card_changed', 'plan_week', 'chat', 'answer']
const UUID = /^[0-9a-f-]{36}$/i
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Two runs must never edit one user's plan at once: wait (3 s steps, up to 30 s) for a running one.
async function waitForRunningRun(userId: string) {
  for (let i = 0; i < 10; i++) {
    const { data } = await db.from('agent_runs').select('id').eq('user_id', userId).eq('status', 'running')
      .gte('created_at', new Date(Date.now() - 120_000).toISOString()).limit(1)
    if (!data?.length) return
    await sleep(3000)
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405)
  if (!SECRET || !safeEqual(req.headers.get('x-agent-secret') ?? '', SECRET)) return json({ ok: false, error: 'unauthorized' }, 401)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: 'invalid JSON' }, 400)
  }
  const { trigger, user_id, payload } = body ?? {}
  if (typeof trigger !== 'string' || !TRIGGERS.includes(trigger)) return json({ ok: false, error: 'unknown trigger' }, 400)
  if (typeof user_id !== 'string' || !UUID.test(user_id)) return json({ ok: false, error: 'invalid user_id' }, 400)

  await waitForRunningRun(user_id)

  const input = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>
  const { data, error } = await db.from('agent_runs').insert({ user_id, trigger, input }).select('id').single()
  if (error) return json({ ok: false, error: 'could not open run (unknown user?)' }, 400)

  // Reply now; the run continues in the background and streams its steps through realtime.
  EdgeRuntime.waitUntil(runAgent({ runId: data.id, userId: user_id, trigger, payload: input }))
  return json({ ok: true, run_id: data.id })
})
