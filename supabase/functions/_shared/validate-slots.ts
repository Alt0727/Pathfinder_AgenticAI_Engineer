// Timetable row validation, shared by timetable.parse (AI output) and every slots.* save.
// Bad rows are skipped with a warning, never saved.

export type Slot = {
  day_of_week: number          // 0 = Sunday … 6 = Saturday
  start_time: string           // 'HH:MM'
  end_time: string
  label: string
  kind: 'class' | 'personal'
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Any common way a timetable (or a model) writes a time → 'HH:MM' (24 h), or null.
// '08:00', '8:00', '8.00', '08:00:00', '0800', '2:00 PM', '2 pm', '12:30am'.
// No am/pm and an hour of 1–6 → afternoon (college timetables write 2:00 for 14:00; no class starts at 2 am).
export function toHHMM(raw: unknown): string | null {
  const t = String(raw ?? '').trim().toLowerCase().replace(/\s+/g, '').replace(/\./g, ':').replace(/(a|p):m:?$/, '$1m')
  const m = t.match(/^(\d{1,2}):?(\d{2})?(?::\d{2})?(am|pm)?$/) ?? t.match(/^(\d{1,2})(\d{2})(am|pm)?$/)
  if (!m) return null
  let h = Number(m[1])
  const min = Number(m[2] ?? 0)
  const ampm = m[3]
  if (ampm === 'pm' && h < 12) h += 12
  else if (ampm === 'am' && h === 12) h = 0
  else if (!ampm && h >= 1 && h <= 6) h += 12
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

export function validateSlots(rows: unknown, defaultKind: Slot['kind'] = 'class') {
  const slots: Slot[] = []
  const warnings: string[] = []
  const seen = new Set<string>()
  const list = Array.isArray(rows) ? rows.slice(0, 100) : []

  list.forEach((raw, i) => {
    const r = (raw ?? {}) as Record<string, unknown>
    const row = `Row ${i + 1}`
    const day = Number(r.day_of_week)
    const s = toHHMM(r.start_time)
    const e = toHHMM(r.end_time)
    const label = String(r.label ?? '').trim().slice(0, 80)
    const kind = r.kind === 'class' || r.kind === 'personal' ? r.kind : defaultKind

    if (!Number.isInteger(day) || day < 0 || day > 6) return void warnings.push(`${row}: day must be 0–6, skipped`)
    if (!s || !e) return void warnings.push(`${row}: couldn't read the time "${r.start_time}–${r.end_time}", skipped`)
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
