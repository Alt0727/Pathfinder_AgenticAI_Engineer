// Timetable row validation, shared by timetable.parse (AI output) and every slots.* save.
// Bad rows are skipped with a warning, never saved.

export type Slot = {
  day_of_week: number          // 0 = Sunday … 6 = Saturday
  start_time: string           // 'HH:MM'
  end_time: string
  label: string
  kind: 'class' | 'personal'
}

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)(:00)?$/
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function validateSlots(rows: unknown, defaultKind: Slot['kind'] = 'class') {
  const slots: Slot[] = []
  const warnings: string[] = []
  const seen = new Set<string>()
  const list = Array.isArray(rows) ? rows.slice(0, 100) : []

  list.forEach((raw, i) => {
    const r = (raw ?? {}) as Record<string, unknown>
    const row = `Row ${i + 1}`
    const day = Number(r.day_of_week)
    const start = String(r.start_time ?? '').trim()
    const end = String(r.end_time ?? '').trim()
    const label = String(r.label ?? '').trim().slice(0, 80)
    const kind = r.kind === 'class' || r.kind === 'personal' ? r.kind : defaultKind

    if (!Number.isInteger(day) || day < 0 || day > 6) return void warnings.push(`${row}: day must be 0–6, skipped`)
    if (!HHMM.test(start) || !HHMM.test(end)) return void warnings.push(`${row}: times must be HH:MM, skipped`)
    const s = start.slice(0, 5), e = end.slice(0, 5)
    if (e <= s) return void warnings.push(`${row}: end must be after start, skipped`)
    if (!label) return void warnings.push(`${row}: empty label, skipped`)

    const key = `${day}|${s}|${e}|${label.toLowerCase()}`
    if (seen.has(key)) return void warnings.push(`${row}: duplicate of ${DAYS[day]} ${s} ${label}, skipped`)
    seen.add(key)
    slots.push({ day_of_week: day, start_time: s, end_time: e, label, kind })
  })

  if (Array.isArray(rows) && rows.length > 100) warnings.push('Only the first 100 rows were read')
  slots.sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time))
  return { slots, warnings }
}
