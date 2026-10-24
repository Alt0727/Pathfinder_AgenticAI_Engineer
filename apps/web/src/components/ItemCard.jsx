/*
  ItemCard
  One campus item, used in the interest carousels:
  line badge, title, when (or "Apply by" / orange "Closes … · 2 days left"),
  place (real places only), "from AI Club", and "View details" + "Add to my week"
  (which turns into "Added to your week"; click again to remove it).

  Props:
    item:    one item (see lib/adapt.js cardToItem)
    isAdded: true/false, whether it's already in the student's week
    onToggle: function(id, buttonEl), called when "Add to my week" / "Added" is clicked
              (adds it, or removes it if it's already added; buttonEl is where the flight starts)
    onOpen:  function(item), called when "View details" is clicked

  Needs: shadcn button; PillarBadge.jsx; src/lib/pillars.js; src/lib/time.js; date-fns
*/
import { format } from "date-fns"
import { Check, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PillarBadge } from "@/components/PillarBadge"
import { isPhysicalPlace } from "@/lib/pillars"
import { daysLeftLabel } from "@/lib/time"

// The main "when" line, worded per pillar
export function whenLine(item) {
  const d = (iso) => format(new Date(iso), "EEE d MMM")
  if (item.pillar === "deadline" && item.deadline_at) {
    return { text: `Closes ${d(item.deadline_at)} · ${daysLeftLabel(item.deadline_at, Date.now())} left`, urgent: true }
  }
  if (item.pillar === "opportunity" && item.deadline_at) {
    return { text: `Apply by ${d(item.deadline_at)}` }
  }
  if (item.starts_at) return { text: `${d(item.starts_at)} · ${format(new Date(item.starts_at), "h:mm a")}` }
  if (item.deadline_at) return { text: `Closes ${d(item.deadline_at)}` }
  return null
}

export function ItemCard({ item, isAdded, onToggle, onOpen }) {
  const when = whenLine(item)

  return (
    <div className="flex h-full min-h-[212px] flex-col gap-2.5 rounded-xl border bg-[rgba(9,13,11,0.45)] p-[18px] transition-[transform,border-color] duration-150 hover:-translate-y-px hover:border-line-2">
      <PillarBadge pillar={item.pillar} />
      <button onClick={() => onOpen(item)} className="line-clamp-2 text-left text-[17px] leading-snug font-semibold">
        {item.title}
      </button>

      {when && <p className={`text-[13px] ${when.urgent ? "font-medium text-signal" : "text-soft"}`}>{when.text}</p>}
      {isPhysicalPlace(item.venue) && (
        <p className="flex items-baseline gap-1.5 text-[13px] text-soft">
          <span aria-hidden="true" className="size-1.5 shrink-0 translate-y-px rounded-full border-2 border-soft" />
          <span className="truncate">{item.venue}</span>
        </p>
      )}
      <p className="truncate text-xs text-muted-foreground">from {item.source_group}</p>

      <div className="mt-auto flex flex-wrap gap-2">
        <Button variant="outline" className="min-w-[128px] flex-1" onClick={() => onOpen(item)}>
          View details
        </Button>
        <Button
          variant={isAdded ? "done" : "default"}
          aria-pressed={isAdded}
          className="min-w-[128px] flex-1 active:scale-[0.98]"
          onClick={(e) => onToggle(item.id, e.currentTarget)}
        >
          {isAdded ? <Check className="size-4" /> : <Plus className="size-4" />}
          {isAdded ? "Added to your week" : "Add to my week"}
        </Button>
      </div>
    </div>
  )
}
