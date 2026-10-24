// defaultEnd: an end time for cards/entries that have none (spec: unmute-functions.md → Default durations).
// AI #1 never invents an end time; this one helper does, and the entry gets end_estimated = true (UI shows "~").
// First match wins.

const MINUTES: [(e: { title: string; tags: string[] }) => boolean, number][] = [
  [(e) => /^register for\b/i.test(e.title), 30],
  [(e) => e.tags.includes('talk'), 60],
  [(e) => e.tags.includes('workshop') || e.tags.includes('sports'), 120],
  [(e) => ['hackathon', 'fest', 'competition'].some((t) => e.tags.includes(t)), 180],
]
const FALLBACK = 60

export function defaultEnd(e: { starts_at: string; title?: string; tags?: string[] | null }): string {
  const entry = { title: e.title ?? '', tags: e.tags ?? [] }
  const minutes = MINUTES.find(([match]) => match(entry))?.[1] ?? FALLBACK
  return new Date(Date.parse(e.starts_at) + minutes * 60_000).toISOString()
}
