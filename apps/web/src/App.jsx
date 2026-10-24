/*
  App
  The whole unmute main page ("Your block"), on live data. Every section reads
  through a hook (load + realtime, see hooks/useLive.js) and every change goes
  through app-api (lib/api.js); nothing is kept only in this component.

    items       – campus cards (AI #1), as UI items (lib/adapt.js)
    groups      – the WhatsApp invite links this user added
    calendar    – this week's plan entries (yours + the agent's, dashed)
    runs        – the planner agent's runs: status line, transit progress, steps
    questions   – the agent's pending questions (answer → it may act for one date)
    slots       – the class timetable
    interests   – the user's tags (picker opens on first sign-in)

  Props:
    arriving: true when the page mounts under the loader's exit: the panels
              settle in (week first) and focus moves to the hero title.

  Motion follows the motion spec §4: calm by default, and only reacting to
  things that really happened.
*/
import { useEffect, useMemo, useRef, useState } from "react"
import { format } from "date-fns"
import { toast } from "sonner"
import { Toaster } from "@/components/ui/sonner"
import { AroundCampus } from "@/components/AroundCampus"
import { ClosingSoonStrip } from "@/components/ClosingSoonStrip"
import { DeadlinesPanel } from "@/components/DeadlinesPanel"
import { Footer } from "@/components/Footer"
import { Greeting } from "@/components/Greeting"
import { GroupsPanel } from "@/components/GroupsPanel"
import { InterestCarousels } from "@/components/InterestCarousels"
import { InterestPicker } from "@/components/InterestPicker"
import { ItemDetail } from "@/components/ItemDetail"
import { Navbar } from "@/components/Navbar"
import { TimetableReview } from "@/components/TimetableReview"
import { UrgentBanner } from "@/components/UrgentBanner"
import { YourWeek } from "@/components/YourWeek"
import { useCards } from "@/hooks/useCards"
import { useGroups } from "@/hooks/useGroups"
import { useProfile } from "@/hooks/useProfile"
import { useQuestions } from "@/hooks/useQuestions"
import { useRuns } from "@/hooks/useRuns"
import { useSession } from "@/hooks/useSession"
import { useTimetable } from "@/hooks/useTimetable"
import { useWeek } from "@/hooks/useWeek"
import { cardToItem, entryToItem, inviteToGroup, labelFor, stepWords } from "@/lib/adapt"
import { api } from "@/lib/api"
import { supabase } from "@/lib/supabase"
import { flyChip, prefersReducedMotion } from "@/lib/motion"
import { pillarStyle } from "@/lib/pillars"
import { itemDate } from "@/lib/time"

const MAX_STEPS = 8 // the agent's step cap: progress along the transit line = steps / 8
const RECENT_MS = 2 * 3600_000 // the status line shows the latest run if it's from the last 2 hours

// Arrival stagger: class + start time (ms after this page mounts, ~200 ms into the loader's exit)
const arrive = (on, kind, ms) => (on ? { className: kind === "up" ? "arrive-up" : "arrive-fade", style: { "--arrive": `${ms}ms` } } : {})

// Entries a finished run added or moved (to ring them once on the calendar)
const touchedEntries = (run) =>
  run.steps
    .filter((s) => ["add_entry", "move_entry"].includes(s.tool) && s.result?.ok)
    .map((s) => s.result.entry_id)
    .filter(Boolean)

// Wait for one agent run to finish (the Ask box shows its answer). Reads the user's own row (RLS).
async function waitForRun(runId, timeoutMs = 90_000) {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    const { data } = await supabase.from("agent_runs").select("status, summary, steps").eq("id", runId).maybeSingle()
    if (data && data.status !== "running") return data
    await new Promise((r) => setTimeout(r, 1500))
  }
  return { status: "timeout", summary: "Still working on it: the answer will appear in your week shortly.", steps: [] }
}

export default function App({ arriving = false }) {
  const { userId } = useSession()
  const { cards } = useCards(userId)
  const { groups: invites } = useGroups(userId)
  const { entries, conflicts } = useWeek(userId)
  const { runs } = useRuns(userId)
  const { questions } = useQuestions(userId)
  const { slots } = useTimetable(userId)
  const profile = useProfile(userId)

  const [selected, setSelected] = useState(null)
  const [ringIds, setRingIds] = useState([]) // calendar entries getting a one-time sage ring
  const [deadlinesOpen, setDeadlinesOpen] = useState(false) // the nav's deadlines dropdown
  const [timetableOpen, setTimetableOpen] = useState(false)
  const [editingInterests, setEditingInterests] = useState(false)
  const [pendingRun, setPendingRun] = useState(null) // "starting" | the run id Generate plan started
  const ringTimer = useRef(null)
  const lastRun = useRef(null)

  // ---- backend rows → the UI's shapes (lib/adapt.js) ----
  const items = useMemo(() => cards.map(cardToItem), [cards])
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const activeItems = useMemo(() => items.filter((i) => i.status === "active"), [items])
  const calendarItems = useMemo(() => entries.map((e) => entryToItem(e, itemById.get(e.card_id))), [entries, itemById])
  const suggestedIds = calendarItems.filter((i) => i.placed_by === "agent").map((i) => i.id)
  const addedIds = [...new Set(entries.filter((e) => e.card_id).map((e) => e.card_id))]
  const groups = invites.map((inv) => inviteToGroup(inv, cards))
  const interests = profile.interests.map(labelFor)
  const listening = groups.filter((g) => g.status === "listening").length
  const classCount = slots.filter((s) => s.kind === "class").length

  // ---- the agent: status line, transit-line progress, rings when a run finishes ----
  const latest = runs[0] && Date.now() - Date.parse(runs[0].created_at) < RECENT_MS ? runs[0] : null
  const starting = pendingRun !== null && latest?.id !== pendingRun // until realtime shows the run we started
  const running = starting || latest?.status === "running"

  // A sage ring fades over 900 ms (a static outline for 2 s under reduced motion)
  function ring(ids) {
    clearTimeout(ringTimer.current)
    setRingIds(ids)
    ringTimer.current = setTimeout(() => setRingIds([]), prefersReducedMotion() ? 2000 : 900)
  }

  useEffect(() => {
    if (!latest) return
    const before = lastRun.current
    lastRun.current = { id: latest.id, status: latest.status }
    if (before?.id === latest.id && before.status === "running" && latest.status !== "running") ring(touchedEntries(latest))
  }, [latest])

  const scrollToWeek = () =>
    document.getElementById("week")?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" })

  let planStatus = null
  if (starting) planStatus = { state: "working", text: "Starting the agent…" }
  else if (latest?.status === "running") {
    const step = latest.steps.at(-1)
    planStatus = { state: "working", text: step ? `${stepWords(step.tool)}…` : "The agent is reading your week…" }
  } else if (latest?.status === "asked") planStatus = { state: "ready", text: "The agent has a question for you.", onReview: scrollToWeek }
  else if (latest?.status === "done") planStatus = { state: "ready", text: latest.summary, onReview: scrollToWeek }
  else if (latest?.status === "failed") planStatus = { state: "error", text: "The agent couldn't finish. Try Generate plan again." }
  const agentProgress = latest?.status === "running" ? Math.min(0.95, latest.steps.length / MAX_STEPS) : starting ? 0 : null

  // After the loader: focus the hero title once everything has settled (≤ 700 ms)
  useEffect(() => {
    if (!arriving) return
    const timer = setTimeout(() => document.getElementById("hero-title")?.focus({ preventScroll: true }), 500)
    return () => clearTimeout(timer)
  }, [arriving])

  // ---- actions (all through app-api) ----
  async function toggleWeek(cardId, buttonEl) {
    if (addedIds.includes(cardId)) {
      const r = await api("week.remove", { card_id: cardId })
      return r.ok ? toast("Removed from your week") : toast.error(r.error)
    }
    const r = await api("week.add", { card_id: cardId })
    if (!r.ok) return toast.error(r.error)
    toast(r.conflicts?.length ? `Added. It overlaps ${r.conflicts.map((c) => c.title).join(", ")}` : "Added to your week")

    // Fly a chip to its day column (if that day is on screen) and ring the new calendar entry
    const item = itemById.get(cardId)
    const day = item && itemDate(item)
    const column = day && document.querySelector(`[data-day="${format(new Date(day), "yyyy-MM-dd")}"]`)
    if (item && column && buttonEl) {
      const style = pillarStyle[item.pillar] ?? pillarStyle.announcement
      flyChip(buttonEl, column, { title: item.title, letter: style.letter, roundelClass: style.dot })
    }
    if (r.entry_id) setTimeout(() => ring([r.entry_id]), 400) // after realtime brings the entry in
  }

  async function addGroup(link) {
    const r = await api("groups.add", { invite_link: link })
    if (r.ok) toast("Bot is joining the group…")
    else toast.error(r.error)
  }

  async function handleGenerate(kind) {
    setPendingRun("starting")
    const r = await api("plan.week", { style: kind })
    setPendingRun(r.ok ? r.run_id : null)
    if (!r.ok) toast.error(r.error)
  }

  async function answer(questionId, option) {
    const r = await api("question.answer", { question_id: questionId, answer: option })
    if (!r.ok) toast.error(r.error)
  }

  // Ask box = chat with the agent (user mode): it can answer AND change your plan when you ask it to
  async function ask(question) {
    const r = await api("chat.send", { text: question })
    if (!r.ok) return { answer: r.error, itemIds: [] }
    const run = await waitForRun(r.run_id)
    const cardIds = run.steps.map((s) => s.args?.card_id).filter((id) => id && itemById.has(id))
    return { answer: run.summary ?? "Done.", itemIds: [...new Set(cardIds)] }
  }

  const needsInterests = profile.ready && profile.interests.length === 0

  return (
    <div className="min-h-svh text-foreground">
      <Toaster theme="dark" position="bottom-right" />
      <Navbar
        items={activeItems}
        onOpen={setSelected}
        deadlinesOpen={deadlinesOpen}
        onDeadlinesOpenChange={setDeadlinesOpen}
      />
      <div {...arrive(arriving, "fade", 180)}>
        <UrgentBanner items={activeItems} onOpen={setSelected} maxHours={24} />
      </div>

      <main id="block" className="mx-auto max-w-[1440px] px-5 sm:px-10">
        <div {...arrive(arriving, "fade", 180)}>
          <Greeting
            weekCount={calendarItems.filter((i) => !i.cancelled).length}
            items={activeItems}
            listeningCount={listening}
            onEditInterests={() => setEditingInterests(true)}
          />
        </div>

        <div {...arrive(arriving, "fade", 180)}>
          <ClosingSoonStrip items={activeItems} onOpen={setSelected} onSeeAll={() => setDeadlinesOpen(true)} />
        </div>

        {/* Main row, as in the mockup: buildings | week | signals (from 1024px).
            Tablet: week on top, buildings and signals side by side under it.
            Phone: signals, week, buildings. */}
        <div className="mt-5 grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 lg:grid-cols-[240px_minmax(0,1fr)_280px] min-[1440px]:grid-cols-[264px_minmax(0,1fr)_304px]">
          <div className="order-3 md:order-2 lg:order-1">
            <div className={`h-full ${arriving ? "arrive-up" : ""}`} style={arriving ? { "--arrive": "100ms" } : undefined}>
              <GroupsPanel groups={groups} onAddGroup={addGroup} />
            </div>
          </div>
          <div className="order-2 min-w-0 md:order-1 md:col-span-2 lg:order-2 lg:col-span-1">
            <div className={`h-full ${arriving ? "arrive-up" : ""}`} style={arriving ? { "--arrive": "20ms" } : undefined}>
              <YourWeek
                items={items}
                calendarItems={calendarItems}
                suggestedIds={suggestedIds}
                plans={[]}
                activePlanId={null}
                onSelectPlan={() => {}}
                onGenerate={handleGenerate}
                generating={running}
                onOpen={setSelected}
                onAsk={ask}
                timetableCount={classCount}
                onOpenTimetable={() => setTimetableOpen(true)}
                questions={questions}
                onAnswer={answer}
                run={latest}
                conflicts={conflicts}
                ringIds={ringIds}
                agentProgress={agentProgress}
                planStatus={planStatus}
              />
            </div>
          </div>
          <div className="order-1 md:order-3">
            <div className={`h-full ${arriving ? "arrive-up" : ""}`} style={arriving ? { "--arrive": "160ms" } : undefined}>
              <DeadlinesPanel items={activeItems} onOpen={setSelected} onViewAll={() => setDeadlinesOpen(true)} />
            </div>
          </div>
        </div>

        {/* Your network */}
        <div {...arrive(arriving, "fade", 260)}>
          <InterestCarousels
            items={activeItems}
            interests={interests}
            addedIds={addedIds}
            onToggle={toggleWeek}
            onOpen={setSelected}
          />
        </div>

        {/* New on the block */}
        <div {...arrive(arriving, "fade", 260)}>
          <AroundCampus
            items={activeItems}
            interests={interests}
            addedIds={addedIds}
            onToggle={toggleWeek}
            onOpen={setSelected}
          />
        </div>
      </main>

      <Footer />

      {/* Item card, opens from anywhere (a calendar tile is a plan entry: added-ness is its card's) */}
      <ItemDetail
        item={selected}
        isAdded={selected ? addedIds.includes(selected.cardId ?? selected.id) : false}
        onToggle={toggleWeek}
        onClose={() => setSelected(null)}
        interests={interests}
      />

      <TimetableReview open={timetableOpen} onOpenChange={setTimetableOpen} slots={slots} />

      {/* key: start from the saved tags each time it opens */}
      <InterestPicker
        key={`${needsInterests || editingInterests}-${profile.interests.join(",")}`}
        open={needsInterests || editingInterests}
        required={needsInterests}
        onOpenChange={setEditingInterests}
        initial={profile.interests}
        onSaved={profile.reload}
      />
    </div>
  )
}
