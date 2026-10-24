/*
  ClashNote
  Under the calendar: what overlaps this week. Clashes with your class
  timetable are listed separately from clashes between plan items (spec).
  Hidden when nothing clashes.

  Props:
    conflicts: { timetable: [{ entry, other }], plan: [{ entry, other }] } (useWeek)

  Needs: date-fns
*/
import { format } from "date-fns"
import { TriangleAlert } from "lucide-react"

const when = (row) => format(new Date(row.starts_at), "EEE h:mm a")

function Group({ title, pairs }) {
  if (!pairs.length) return null
  return (
    <div className="flex flex-col gap-1">
      <span className="eyebrow">{title}</span>
      {pairs.map(({ entry, other }) => (
        <span key={`${entry.id}-${other.id}`} className="text-[13px]">
          <span className={entry.card_status === "cancelled" ? "line-through" : ""}>{entry.title}</span>
          <span className="text-muted-foreground"> · {when(entry)} overlaps </span>
          {other.title}
          <span className="text-muted-foreground"> · {when(other)}</span>
        </span>
      ))}
    </div>
  )
}

export function ClashNote({ conflicts }) {
  const count = conflicts.timetable.length + conflicts.plan.length
  if (!count) return null
  return (
    <div role="note" className="flex gap-3 rounded-xl border border-signal-line p-3.5">
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-[18px] shrink-0 text-signal" />
      <div className="flex flex-col gap-2.5">
        <Group title="Clashes with your timetable" pairs={conflicts.timetable} />
        <Group title="Clashes between plan items" pairs={conflicts.plan} />
      </div>
    </div>
  )
}
