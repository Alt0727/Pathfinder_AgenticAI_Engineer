// IST helpers for prompts. The model gets weekday + date + time so "Thursday" / "tomorrow" resolve correctly.
const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata', weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

// ISO (any zone) → '2026-10-29T18:00:00+05:30', so the model only ever sees IST times. null stays null.
export function toIST(iso) {
  if (!iso) return null
  const d = new Date(Date.parse(iso) + 5.5 * 3600_000)
  return `${d.toISOString().slice(0, 19)}+05:30`
}

// Date | ISO string → 'Mon 26 Oct 2026, 10:12 IST'
export function istLabel(d = new Date()) {
  const p = Object.fromEntries(fmt.formatToParts(new Date(d)).map((x) => [x.type, x.value]))
  return `${p.weekday} ${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute} IST`
}
