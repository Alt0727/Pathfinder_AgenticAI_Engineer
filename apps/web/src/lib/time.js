/*
  time.js
  Date helpers shared by the countdowns, calendar and deadline lists.
*/
import { format, isToday, isTomorrow } from "date-fns"
import { useEffect, useState } from "react"

// Returns the current time and re-renders the component every `ms` milliseconds.
// Any component that calls useNow() will tick, which is what makes countdowns live.
export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

// Turns a deadline into "2d 4h", "6h 12m", "45m 10s" (or with seconds: "6h 12m 07s")
export function timeLeft(isoDate, now, withSeconds = false) {
  const diff = new Date(isoDate).getTime() - now
  if (diff <= 0) return "Closed"
  const s = Math.floor(diff / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n) => String(n).padStart(2, "0")
  if (d > 0) return `${d}d ${h}h`
  if (withSeconds) return `${h}h ${pad(m)}m ${pad(sec)}s`
  return h > 0 ? `${h}h ${m}m` : `${m}m ${pad(sec)}s`
}

// Short form for the small tags: "6h", "2d", "45m"
export function shortLeft(isoDate, now) {
  const s = Math.max(0, Math.floor((new Date(isoDate).getTime() - now) / 1000))
  if (s >= 86400) return `${Math.floor(s / 86400)}d`
  if (s >= 3600) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 60)}m`
}

// Friendly form for the deadline list: "2 days", "1 day", "5 hours"
export function daysLeftLabel(isoDate, now) {
  const hours = (new Date(isoDate).getTime() - now) / 3600000
  if (hours >= 48) return `${Math.floor(hours / 24)} days`
  if (hours >= 24) return "1 day"
  return timeLeft(isoDate, now)
}

// "tonight at 11:59 PM", "today at 3:00 PM", "tomorrow at 5:00 PM", "on Sat 17 Oct at 8:00 PM"
export function whenText(isoDate) {
  const d = new Date(isoDate)
  const time = format(d, "h:mm a")
  if (isToday(d)) return `${d.getHours() >= 17 ? "tonight" : "today"} at ${time}`
  if (isTomorrow(d)) return `tomorrow at ${time}`
  return `on ${format(d, "EEE d MMM")} at ${time}`
}

// "Today, 11:59 PM" / "Tomorrow, 5:00 PM" / "Sat 17 Oct, 8:00 PM"
export function shortDateTime(isoDate) {
  const d = new Date(isoDate)
  if (isToday(d)) return `Today, ${format(d, "h:mm a")}`
  if (isTomorrow(d)) return `Tomorrow, ${format(d, "h:mm a")}`
  return format(d, "EEE d MMM, h:mm a")
}

// Hours until a date (can be negative if it has passed)
export function hoursUntil(isoDate, now) {
  return (new Date(isoDate).getTime() - now) / 3600000
}

// Deadline items (the orange "D" line) that haven't passed yet, most urgent first.
// Events and opportunities with a registration date aren't counted here; their
// dates still show on their own cards.
export function upcomingDeadlines(items, now) {
  return items
    .filter((i) => i.pillar === "deadline" && i.deadline_at && new Date(i.deadline_at).getTime() > now)
    .sort((a, b) => new Date(a.deadline_at) - new Date(b.deadline_at))
}

// The date an item belongs on in the calendar: when it happens, or else when it closes
export function itemDate(item) {
  return item.starts_at ?? item.deadline_at
}
