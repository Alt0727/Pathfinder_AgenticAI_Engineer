/*
  AskBox
  "Ask anything" input with a send button, then up to 3 suggestion chips (with
  anything passed as `aside` on the right). The answer appears in a panel under
  the chips, with any matching items listed as clickable rows.

  Props:
    items:  all items (used by the built-in demo search)
    onOpen: function(item), called when an item in the answer is clicked
    aside:  optional element shown to the right of the chips (YourWeek passes the legend)
    onAsk:  OPTIONAL async function(question) that returns { answer, itemIds }.
            Pass the backend's AI call here when it's ready. Until then a simple
            keyword search over the items is used, so the box still works in demos.

  Needs: shadcn button; PillarBadge.jsx (PillarDot)
*/
import { useState } from "react"
import { ArrowRight, Loader2, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PillarDot } from "@/components/PillarBadge"

const SUGGESTIONS = [
  "Anything on AI this week?",
  "What clashes on Saturday?",
  "Internships for 2nd years",
]

const STOP_WORDS = new Set([
  "the", "and", "for", "this", "that", "what", "anything", "any", "are", "there", "week",
  "show", "me", "my", "is", "on", "in", "of", "to", "a", "can", "you", "with", "about", "years",
  "year", "yrs", "1st", "2nd", "3rd", "4th", "students", "student",
])

// Demo-only answer: keyword search. Replaced by the real AI through the onAsk prop.
function demoAnswer(question, items) {
  const q = question.toLowerCase()
  const now = Date.now()

  if (q.includes("summar")) {
    const recent = [...items].sort((a, b) => new Date(b.posted_at) - new Date(a.posted_at)).slice(0, 5)
    return { answer: `The ${recent.length} most recent updates across your groups:`, itemIds: recent.map((i) => i.id) }
  }

  if (q.includes("clash") || q.includes("overlap")) {
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    const day = days.findIndex((d) => q.includes(d))
    const timed = items
      .filter((i) => i.starts_at && new Date(i.starts_at) > now)
      .filter((i) => day === -1 || new Date(i.starts_at).getDay() === day)
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
    const clashing = new Set()
    for (let a = 0; a < timed.length; a++) {
      for (let b = a + 1; b < timed.length; b++) {
        const gap = Math.abs(new Date(timed[b].starts_at) - new Date(timed[a].starts_at))
        if (gap < 2 * 3600000) clashing.add(timed[a].id).add(timed[b].id) // within 2 hours
      }
    }
    const when = day === -1 ? "this week" : `on ${days[day][0].toUpperCase()}${days[day].slice(1)}`
    return {
      answer: clashing.size ? `These overlap ${when}:` : `No clashes ${when}.`,
      itemIds: [...clashing],
    }
  }

  if (q.includes("close") || q.includes("deadline") || q.includes("due")) {
    const soon = items
      .filter((i) => i.deadline_at && new Date(i.deadline_at) - now > 0 && new Date(i.deadline_at) - now < 48 * 3600000)
      .sort((a, b) => new Date(a.deadline_at) - new Date(b.deadline_at))
    return {
      answer: soon.length ? `${soon.length} things close in the next 2 days:` : "Nothing closes in the next 2 days.",
      itemIds: soon.map((i) => i.id),
    }
  }

  if (q.includes("intern") || q.includes("opportunit")) {
    const opps = items.filter((i) => i.pillar === "opportunity")
    return {
      answer: opps.length ? `${opps.length} open opportunities in your groups:` : "No open opportunities right now.",
      itemIds: opps.map((i) => i.id),
    }
  }

  const words = q
    .replace(/[^a-z0-9 ]/g, " ")
    .split(" ")
    .filter((w) => w && !STOP_WORDS.has(w))
    .map((w) => (w.endsWith("s") ? w.slice(0, -1) : w)) // "internships" -> "internship"

  const matches = items.filter((item) => {
    const text = [item.title, item.description, item.source_group, item.pillar, ...item.interests]
      .join(" ")
      .toLowerCase()
    return words.some((w) => text.includes(w) || (w === "internship" && item.pillar === "opportunity"))
  })

  return {
    answer: matches.length ? `I found ${matches.length} matching items:` : "I couldn't find anything about that in your groups.",
    itemIds: matches.map((i) => i.id),
  }
}

export function AskBox({ items, onOpen, onAsk, aside }) {
  const [question, setQuestion] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null) // { question, answer, itemIds }

  async function ask(text) {
    const q = text.trim()
    if (!q) return
    setQuestion(q)
    setLoading(true)
    try {
      const res = onAsk ? await onAsk(q) : demoAnswer(q, items)
      setResult({ question: q, ...res })
    } catch (err) {
      console.error(err)
      setResult({ question: q, answer: "Something went wrong. Try again.", itemIds: [] })
    } finally {
      setLoading(false)
    }
  }

  const answerItems = result ? items.filter((i) => result.itemIds?.includes(i.id)) : []

  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          ask(question)
        }}
        className="flex items-center gap-2.5 rounded-xl border border-line-2 bg-deep py-1.5 pr-1.5 pl-3.5 transition-[border-color,box-shadow] focus-within:border-teal focus-within:shadow-[0_0_0_3px_rgba(79,201,180,0.12)]"
      >
        <Sparkles className="size-[18px] shrink-0 text-muted-foreground" />
        <label htmlFor="ask" className="sr-only">
          Ask AI about your week
        </label>
        <input
          id="ask"
          className="h-10 min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-[#7a877f]"
          placeholder="Ask anything: “What’s on this weekend?” or “I’m busy Tue eve”"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <Button type="submit" size="icon-lg" disabled={loading || !question.trim()} aria-label="Send">
          {loading ? <Loader2 className="size-[18px] animate-spin" /> : <ArrowRight className="size-[18px]" />}
        </Button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              className="h-[30px] rounded-full border px-3 text-[13px] text-soft transition-colors hover:border-line-2 hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
        {aside}
      </div>

      {result && (
        <div aria-live="polite" className="space-y-2 rounded-xl border bg-deep p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm">
              <span className="text-muted-foreground">You asked: </span>
              {result.question}
            </p>
            <button aria-label="Close answer" onClick={() => setResult(null)} className="text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>
          <p className="text-sm font-medium">{result.answer}</p>
          {answerItems.length > 0 && (
            <ul className="space-y-0.5">
              {answerItems.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => onOpen(item)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-[rgba(243,239,230,0.05)]"
                  >
                    <PillarDot pillar={item.pillar} />
                    <span className="truncate">{item.title}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">{item.source_group}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
