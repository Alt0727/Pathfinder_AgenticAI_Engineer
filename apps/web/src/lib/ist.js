// IST helpers for the browser. Dates are 'YYYY-MM-DD' in Asia/Kolkata; times are ISO with +05:30.
const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' })

export const todayIST = (d = new Date()) => ymd.format(d)

export function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// The rolling week shown everywhere: today → today + 6.
export function weekRange() {
  const from = todayIST()
  return { from, to: addDays(from, 6) }
}

// '2026-10-24' + '18:30' → '2026-10-24T18:30:00+05:30'
export const istISO = (date, hhmm) => `${date}T${hhmm}:00+05:30`

// 0 = Sunday, same as day_of_week in the database.
export const dayOfWeek = (date) => new Date(`${date}T00:00:00Z`).getUTCDay()
