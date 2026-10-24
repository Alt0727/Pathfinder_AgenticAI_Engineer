/*
  ItemDetail
  The item card (dialog). Opens from anywhere an item is clicked.
  Left: panel in the line's colour with the big date, the key fact (deadline and
  time left, or when it starts) and its source group. The original WhatsApp text
  is deleted after processing (privacy), so the card says so instead of quoting it.
  Right: line badge and "Matches …" chip, title, Date / Time / Location / Organizer,
  About, a cancelled note, the agent's reason (calendar entries it placed), and
  actions (Open form / Register / Apply, Add to my week). No Share.
  Calendar tiles are plan entries: Add / remove acts on their card (item.cardId).

  Props:
    item:      the item to show, or null to keep it closed
    isAdded:   true/false
    onToggle:  function(id, buttonEl), adds the item to the week, or removes it if already added
    onClose:   function(), called when the pop-up is closed
    interests: optional array of the student's interests, to show "Matches X"

  Needs: shadcn dialog, button; PillarBadge.jsx; src/lib/pillars.js;
         src/lib/time.js; date-fns
*/
import { format } from "date-fns"
import { ArrowUpRight, Calendar, Check, Clock, MapPin, Plus, User, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { PillarBadge } from "@/components/PillarBadge"
import { pillarStyle } from "@/lib/pillars"
import { daysLeftLabel, useNow } from "@/lib/time"

// Button label depends on what kind of item it is
const actionLabel = { deadline: "Open form", event: "Register", opportunity: "Apply", announcement: "Open link" }

// Label for the key-fact box on the left
const deadlineLabel = { deadline: "Closes", event: "Registration closes", opportunity: "Application deadline" }

export function ItemDetail({ item, isAdded, onToggle, onClose, interests = [] }) {
  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[90vh] gap-0 overflow-y-auto rounded-3xl border border-line-2 bg-surface p-0 shadow-[0_24px_64px_rgba(0,0,0,0.5)] ring-0 sm:max-w-[980px]"
      >
        {item && <DetailBody item={item} isAdded={isAdded} onToggle={onToggle} interests={interests} />}
      </DialogContent>
    </Dialog>
  )
}

// One "Date / Time / Location / Organizer" cell
function Fact({ icon: Icon, label, value }) {
  if (!value) return null
  return (
    <div className="flex min-w-0 gap-3">
      <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <span className="text-[13px] text-muted-foreground">{label}</span>
        <b className="block text-[15px] font-semibold">{value}</b>
      </div>
    </div>
  )
}

// The left panel's key fact: the deadline if there is one, otherwise when it starts
function keyFact(item, now) {
  if (item.deadline_at) {
    return {
      label: deadlineLabel[item.pillar] ?? "Closes",
      value: format(new Date(item.deadline_at), "EEE d MMM, h:mm a"),
      note: `${daysLeftLabel(item.deadline_at, now)} left`,
    }
  }
  if (item.starts_at) {
    return {
      label: "Starts",
      value: format(new Date(item.starts_at), "EEE d MMM, h:mm a"),
      note: `In ${daysLeftLabel(item.starts_at, now)}`,
    }
  }
  return null
}

// Split out so useNow() only ticks while the card is open
function DetailBody({ item, isAdded, onToggle, interests }) {
  const now = useNow(60000)
  const style = pillarStyle[item.pillar] ?? pillarStyle.announcement
  const mainDate = new Date(item.starts_at ?? item.deadline_at ?? item.posted_at)
  const matches = item.interests.filter((i) => interests.includes(i))
  const key = keyFact(item, now)
  const cancelled = item.cancelled || item.status === "cancelled"

  return (
    <div className="flex flex-wrap">
      {/* Left: line colour panel */}
      <div className={`flex min-w-0 flex-[1_1_320px] flex-col gap-6 p-7 text-foreground sm:p-9 ${style.panel}`}>
        <div className="flex flex-col gap-0.5">
          <span className="eyebrow text-[rgba(243,239,230,0.8)]">{format(mainDate, "EEEE")}</span>
          <span className="font-display text-[96px] leading-[0.9] font-black sm:text-[132px]">{format(mainDate, "d")}</span>
          <span className="text-[22px] font-medium">{format(mainDate, "MMMM")}</span>
        </div>

        {key && (
          <div className="flex flex-col gap-1 rounded-xl border border-[rgba(243,239,230,0.12)] bg-[rgba(0,0,0,0.22)] p-4">
            <span className="text-[13px] text-[rgba(243,239,230,0.75)]">{key.label}</span>
            <span className="text-lg font-semibold">{key.value}</span>
            <span className="text-sm text-[rgba(243,239,230,0.8)]">{key.note}</span>
          </div>
        )}

        {/* The original WhatsApp text is deleted seconds after AI #1 reads it (privacy), so we show its source */}
        <div className="mt-auto flex flex-col gap-2">
          <span className="text-[13px] text-[rgba(243,239,230,0.75)]">Source</span>
          <p className="rounded-lg bg-[rgba(0,0,0,0.25)] px-3.5 py-3 text-sm leading-[1.55]">
            Read from <span className="font-semibold">{item.source_group}</span>. The original message was deleted
            right after it was processed, for privacy.
          </p>
          {item.posted_at && (
            <span className="text-xs text-[rgba(243,239,230,0.7)]">{format(new Date(item.posted_at), "EEE d MMM, h:mm a")}</span>
          )}
        </div>
      </div>

      {/* Right: details and actions */}
      <div className="flex min-w-0 flex-[999_1_420px] flex-col gap-[22px] p-7 sm:p-9">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            <PillarBadge pillar={item.pillar} />
            {matches.length > 0 && (
              <span className="rounded-sm bg-surface-2 px-3 py-1 text-xs font-medium text-soft">
                Matches {matches.join(", ")}
              </span>
            )}
          </div>
          <DialogClose asChild>
            <Button variant="outline" size="icon" aria-label="Close" className="shrink-0">
              <X className="size-[18px]" />
            </Button>
          </DialogClose>
        </div>

        <DialogTitle className="text-[40px] leading-[0.95] sm:text-[56px]">{item.title}</DialogTitle>

        <div className="grid grid-cols-1 gap-x-6 gap-y-[18px] sm:grid-cols-2">
          <Fact icon={Calendar} label="Date" value={format(mainDate, "EEE d MMM yyyy")} />
          <Fact
            icon={Clock}
            label="Time"
            value={
              item.starts_at
                ? format(new Date(item.starts_at), "h:mm a")
                : item.deadline_at && `by ${format(new Date(item.deadline_at), "h:mm a")}`
            }
          />
          <Fact icon={MapPin} label="Location" value={item.venue} />
          <Fact icon={User} label="Organizer" value={item.organizer ?? item.source_group} />
        </div>

        {item.description && (
          <div className="flex flex-col gap-2">
            <h4 className="text-[22px]">About</h4>
            <DialogDescription className="text-[15px] leading-[1.6] text-soft">{item.description}</DialogDescription>
          </div>
        )}

        {cancelled && (
          <p className="rounded-lg border border-destructive/50 px-3.5 py-3 text-sm text-destructive">
            This was cancelled. {item.isEntry ? "The agent will tidy it out of your week." : ""}
          </p>
        )}

        {item.reason && (
          <div className="flex flex-col gap-1.5 rounded-xl border border-line-2 bg-surface-2/60 p-4">
            <span className="text-[13px] text-muted-foreground">
              {item.placed_by === "agent" ? "Why the agent put this in your week" : "Note"}
            </span>
            <p className="text-sm leading-[1.5]">{item.reason}</p>
          </div>
        )}

        <div className="mt-auto flex flex-wrap gap-2.5">
          {item.link && (
            <Button asChild className="flex-[1_1_160px]">
              <a href={item.link} target="_blank" rel="noreferrer">
                {actionLabel[item.pillar]} <ArrowUpRight className="size-4" />
              </a>
            </Button>
          )}
          {/* Calendar tiles are plan entries: add / remove acts on the card they belong to */}
          {!cancelled && (item.cardId ?? !item.isEntry) && (
            <Button
              variant={isAdded ? "done" : "outline"}
              aria-pressed={isAdded}
              className="flex-[1_1_160px] active:scale-[0.98]"
              onClick={(e) => onToggle(item.cardId ?? item.id, e.currentTarget)}
            >
              {isAdded ? <Check className="size-4" /> : <Plus className="size-4" />}
              {isAdded ? "Added to your week" : "Add to my week"}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
