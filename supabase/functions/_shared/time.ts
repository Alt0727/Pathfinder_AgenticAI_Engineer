// IST helpers. Dates are 'YYYY-MM-DD' strings in Asia/Kolkata; timestamps are ISO with +05:30.
export const TZ = 'Asia/Kolkata'

const parts = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ, weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})
const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })

// Today's date in IST.
export const todayIST = (d = new Date()) => ymd.format(d)

// 'YYYY-MM-DD' + n days.
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// The rolling week: today → today + 6.
export function weekRange() {
  const from = todayIST()
  return { from, to: addDays(from, 6) }
}

// '2026-10-24' + '18:30' → '2026-10-24T18:30:00+05:30'
export const istISO = (date: string, hhmm: string) => `${date}T${hhmm}:00+05:30`

// For prompts: 'Sat 24 Oct 2026, 15:40 IST'
export function nowLabel(d = new Date()): string {
  const p = Object.fromEntries(parts.formatToParts(d).map((x) => [x.type, x.value]))
  return `${p.weekday} ${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute} IST`
}
