import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useSession } from '@/hooks/useSession'
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
  ['reject unknown card', () => api('card.act', { card_id: crypto.randomUUID(), action: 'saved' }), (r) => !r.ok],
  ['agent actions: not yet', () => api('plan.week'), (r) => r.error === 'not yet'],
  ['reject unknown action', () => api('nope'), (r) => !r.ok],
]

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
    </main>
  )
}

export default App
