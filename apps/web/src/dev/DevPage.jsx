import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useChat } from '@/hooks/useChat'
import { useFeed } from '@/hooks/useFeed'
import { useGroups } from '@/hooks/useGroups'
import { useQuestions } from '@/hooks/useQuestions'
import { useRadar } from '@/hooks/useRadar'
import { useRuns } from '@/hooks/useRuns'
import { useSession } from '@/hooks/useSession'
import { useTimetable } from '@/hooks/useTimetable'
import { useWeek } from '@/hooks/useWeek'
import { api } from '@/lib/api'
import { addDays, dayOfWeek, istISO, todayIST } from '@/lib/time'

// Temporary test page: ✅ D (user id) + app-api actions. Replaced when Medha's screens are wired.
const tomorrow = addDays(todayIST(), 1)

// Each test: call an action, then check the reply. `ids` carries created ids to later tests.
const TESTS = [
  ['set interests', () => api('profile.set_interests', { interests: ['hackathon', 'workshop'] }), (r) => r.ok],
  ['reject unknown interest', () => api('profile.set_interests', { interests: ['badtag'] }), (r) => !r.ok],
  ['reject bad group link', () => api('groups.add', { invite_link: 'hello' }), (r) => !r.ok],
  ['add slot: Gym tomorrow 18:00–19:00', async (ids) => {
    const r = await api('slots.add', { day_of_week: dayOfWeek(tomorrow), start_time: '18:00', end_time: '19:00', label: 'Gym (test)' })
    ids.slot = r.slot_id
    return r
  }, (r) => r.ok],
  ['edit slot: end 19:30', (ids) => api('slots.edit', { slot_id: ids.slot, end_time: '19:30' }), (r) => r.ok],
  ['reject slot ending before it starts', () => api('slots.add', { day_of_week: 1, start_time: '10:00', end_time: '09:00', label: 'x' }), (r) => !r.ok],
  ['add entry 18:30, no end → 1 h estimated, clashes with Gym', async (ids) => {
    const r = await api('entry.add', { title: 'Test entry', starts_at: istISO(tomorrow, '18:30') })
    ids.entry = r.entry_id
    return r
  }, (r) => r.ok && r.end_estimated && r.conflicts.length === 1],
  ['move entry to 21:00 → no clash', (ids) => api('entry.move', { entry_id: ids.entry, starts_at: istISO(tomorrow, '21:00') }), (r) => r.ok && r.conflicts.length === 0],
  ['delete entry', (ids) => api('entry.delete', { entry_id: ids.entry }), (r) => r.ok],
  ['import 2 rows (1 bad) → 1 saved + 1 warning', async (ids) => {
    const r = await api('slots.save_import', { mode: 'add', slots: [
      { day_of_week: 1, start_time: '08:00', end_time: '08:55', label: 'MA104N (test)' },
      { day_of_week: 9, start_time: '08:00', end_time: '08:55', label: 'bad day' },
    ] })
    ids.imported = r.slot_ids ?? []
    return r
  }, (r) => r.ok && r.saved === 1 && r.warnings.length === 1],
  ['clean up test slots', async (ids) => {
    const results = await Promise.all([ids.slot, ...ids.imported].map((slot_id) => api('slots.delete', { slot_id })))
    return { ok: results.every((r) => r.ok), deleted: results.length }
  }, (r) => r.ok],
  ['reject unknown card', () => api('card.act', { card_id: crypto.randomUUID(), kind: 'saved' }), (r) => !r.ok],
  ['reject empty chat message', () => api('chat.send', { text: '  ' }), (r) => !r.ok],
  ['reject answer to unknown question', () => api('question.answer', { question_id: crypto.randomUUID(), answer: 'Yes' }), (r) => !r.ok],
  ['reject timetable upload of wrong type', () => api('timetable.parse', { file_base64: 'aGVsbG8=', mime_type: 'text/plain' }), (r) => !r.ok],
  ['reject unknown action', () => api('nope'), (r) => !r.ok],
]

// One row per hook: item count + the live data. Changes in the database show up here without a reload.
function HookRow({ name, hook, items }) {
  const label = hook.error ? `error: ${hook.error.message}` : hook.loading ? 'loading…' : `${items.length} item(s)`
  return (
    <details className="text-sm">
      <summary className={hook.error ? 'text-destructive' : ''}>{name}: {label}</summary>
      <pre className="bg-muted mt-1 max-h-64 overflow-auto rounded p-2 text-xs">{JSON.stringify(items, null, 2)}</pre>
    </details>
  )
}

function HooksTest({ userId }) {
  const groups = useGroups(userId)
  const feed = useFeed(userId)
  const radar = useRadar(userId)
  const week = useWeek(userId)
  const timetable = useTimetable(userId)
  const runs = useRuns(userId)
  const questions = useQuestions(userId)
  const chat = useChat(userId)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Data hooks (live)</CardTitle>
        <CardDescription>Week {week.from} → {week.to}. Insert a row in Supabase and watch the count change.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <HookRow name="useGroups" hook={groups} items={groups.groups} />
        <HookRow name="useFeed" hook={feed} items={feed.cards} />
        <HookRow name="useRadar" hook={radar} items={radar.deadlines} />
        <HookRow name="useWeek (entries)" hook={week} items={week.entries} />
        <HookRow name="useWeek (timetable clashes)" hook={week} items={week.conflicts.timetable} />
        <HookRow name="useWeek (plan clashes)" hook={week} items={week.conflicts.plan} />
        <HookRow name="useTimetable (this week)" hook={timetable} items={timetable.week} />
        <HookRow name="useTimetable (slots)" hook={timetable} items={timetable.slots} />
        <HookRow name="useRuns" hook={runs} items={runs.runs} />
        <HookRow name="useQuestions" hook={questions} items={questions.questions} />
        <HookRow name="useChat" hook={chat} items={chat.messages} />
      </CardContent>
    </Card>
  )
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// File → base64 (no "data:" prefix). Photos are downscaled to ≤ 2000 px first (timetable-import spec).
async function toBase64(file) {
  if (file.type === 'application/pdf') {
    const buf = new Uint8Array(await file.arrayBuffer())
    let bin = ''
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
    return { data: btoa(bin), mime: file.type }
  }
  const img = await createImageBitmap(file)
  const scale = Math.min(1, 2000 / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
  return { data: canvas.toDataURL('image/jpeg', 0.85).split(',')[1], mime: 'image/jpeg' }
}

// Temporary timetable import: upload → review (delete rows) → save. Nothing is saved until you click save.
function TimetableTest() {
  const [section, setSection] = useState('')
  const [busy, setBusy] = useState(false)
  const [parsed, setParsed] = useState(null)   // { slots, warnings }
  const [status, setStatus] = useState('')

  async function upload(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true); setParsed(null); setStatus('Reading timetable…')
    const { data, mime } = await toBase64(file)
    const r = await api('timetable.parse', { file_base64: data, mime_type: mime, section: section || undefined })
    setBusy(false)
    if (!r.ok) return setStatus(`Error: ${r.error}`)
    setParsed({ slots: r.slots, warnings: r.warnings })
    setStatus(`${r.slots.length} slot(s) found. Review, then save.`)
  }

  async function save(mode) {
    const r = await api('slots.save_import', { mode, slots: parsed.slots })
    setStatus(r.ok ? `Saved ${r.saved} slot(s) (${mode}).` : `Error: ${r.error}`)
    if (r.ok) setParsed(null)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Timetable upload</CardTitle>
        <CardDescription>Crop out your name and roll number. We only need the grid. The image is never stored.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <input className="w-28 rounded border px-2 py-1" value={section} onChange={(e) => setSection(e.target.value)} placeholder="Section (opt.)" />
          <label className={`bg-primary text-primary-foreground cursor-pointer rounded-md px-3 py-1.5 ${busy ? 'pointer-events-none opacity-50' : ''}`}>
            {busy ? 'Reading…' : 'Upload timetable (PNG, JPEG, PDF)'}
            <input type="file" accept="image/png,image/jpeg,application/pdf" className="hidden" onChange={upload} />
          </label>
        </div>
        {status && <p className={status.startsWith('Error') ? 'text-destructive' : 'text-muted-foreground'}>{status}</p>}
        {parsed?.warnings.map((w) => <p key={w} className="text-amber-600">⚠ {w}</p>)}
        {parsed && (
          <>
            <table className="w-full text-left">
              <thead><tr><th>Day</th><th>Start</th><th>End</th><th>Label</th><th /></tr></thead>
              <tbody>
                {parsed.slots.map((s, i) => (
                  <tr key={`${s.day_of_week}-${s.start_time}-${s.label}`}>
                    <td>{DAYS[s.day_of_week]}</td><td>{s.start_time}</td><td>{s.end_time}</td><td>{s.label}</td>
                    <td><Button variant="ghost" size="sm" onClick={() => setParsed({ ...parsed, slots: parsed.slots.filter((_, j) => j !== i) })}>✕</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex gap-2">
              <Button onClick={() => save('replace')} disabled={!parsed.slots.length}>Replace my class timetable</Button>
              <Button variant="outline" onClick={() => save('add')} disabled={!parsed.slots.length}>Add</Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// Temporary agent panel: plan my week, answer questions, chat, and watch the latest run's steps live.
function AgentTest({ userId }) {
  const { runs } = useRuns(userId)
  const { questions } = useQuestions(userId)
  const { messages } = useChat(userId)
  const [text, setText] = useState('')
  const [reply, setReply] = useState(null)
  const call = async (action, params) => setReply(await api(action, params))
  const run = runs[0]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent (live)</CardTitle>
        <CardDescription>Each button starts a real agent run (uses Gemini).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex items-center gap-2">
          <Button onClick={() => call('plan.week')}>Plan my next 7 days</Button>
          {reply && <span className={reply.ok ? 'text-muted-foreground' : 'text-destructive'}>{reply.ok ? 'run started' : reply.error}</span>}
        </div>

        {questions.map((q) => (
          <div key={q.id} className="space-y-2 rounded border p-3">
            <p className="font-medium">{q.question}</p>
            <div className="flex flex-wrap gap-2">
              {q.options.map((o) => (
                <Button key={o} variant="outline" size="sm" onClick={() => call('question.answer', { question_id: q.id, answer: o })}>{o}</Button>
              ))}
            </div>
          </div>
        ))}

        <div className="max-h-48 space-y-1 overflow-y-auto rounded border p-3">
          {messages.length === 0 && <p className="text-muted-foreground">No chat yet.</p>}
          {messages.map((m) => (
            <p key={m.id}><span className="font-medium">{m.role === 'user' ? 'You' : 'Agent'}:</span> {m.text}</p>
          ))}
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); call('chat.send', { text }); setText('') }}>
          <input className="flex-1 rounded border px-2 py-1" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. I'm busy Tuesday evening" />
          <Button type="submit" disabled={!text.trim()}>Send</Button>
        </form>

        {run && (
          <div className="space-y-1">
            <p className="font-medium">Latest run: {run.trigger} · {run.status}</p>
            {run.steps.map((s) => (
              <details key={s.step}>
                <summary>{s.step}. {s.tool} {s.result?.ok === false ? '❌' : '✅'}</summary>
                <pre className="bg-muted overflow-x-auto rounded p-2 text-xs">{JSON.stringify({ args: s.args, result: s.result }, null, 2)}</pre>
              </details>
            ))}
            {run.summary && <p className="text-muted-foreground">{run.summary}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function App() {
  const { userId, loading, error } = useSession()
  const [results, setResults] = useState([])
  const [running, setRunning] = useState(false)

  async function runTests() {
    setRunning(true)
    setResults([])
    const ids = {}
    for (const [name, run, check] of TESTS) {
      const res = await run(ids)
      setResults((prev) => [...prev, { name, pass: check(res), res }])
    }
    setRunning(false)
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>unmute</CardTitle>
          <CardDescription>Anonymous session test</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && <p>Signing in…</p>}
          {error && <p className="text-destructive">Error: {error.message}</p>}
          {userId && (
            <>
              <p className="font-mono text-sm break-all">{userId}</p>
              <Button onClick={() => navigator.clipboard.writeText(userId)}>Copy user id</Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>app-api tests</CardTitle>
          <CardDescription>
            {results.length
              ? `${results.filter((r) => r.pass).length} / ${TESTS.length} passed`
              : `${TESTS.length} tests; they clean up after themselves`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button onClick={runTests} disabled={!userId || running}>{running ? 'Running…' : 'Run tests'}</Button>
          {results.map((r) => (
            <details key={r.name} className="text-sm">
              <summary className={r.pass ? '' : 'text-destructive'}>{r.pass ? '✅' : '❌'} {r.name}</summary>
              <pre className="bg-muted mt-1 overflow-x-auto rounded p-2 text-xs">{JSON.stringify(r.res, null, 2)}</pre>
            </details>
          ))}
        </CardContent>
      </Card>

      {userId && <TimetableTest />}
      {userId && <AgentTest userId={userId} />}
      {userId && <HooksTest userId={userId} />}
    </main>
  )
}

export default App
