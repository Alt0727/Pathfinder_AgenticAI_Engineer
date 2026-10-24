/*
  GroupsPanel
  Left column, "Your buildings" (panel tag GROUPS): each connected WhatsApp group
  as a little building whose lit orange windows are its new items, with its
  status ("Listening" or "Joining… a few minutes") and "3 new" in orange.
  A thin skyline and the dashed "+ Add a group" button sit at the bottom.

  Props:
    groups:     array of { id, name, status: "listening" | "joining" | "failed", newCount, error? }
    onAddGroup: function(link), called when a new invite link is submitted

  Needs: AddGroupForm.jsx; src/lib/pillars.js (panelClass)
*/
import { AddGroupForm } from "@/components/AddGroupForm"
import { panelClass } from "@/lib/pillars"

// A stable number from the group id, so the teal "listening" windows never shuffle
function seedFor(id) {
  return [...String(id)].reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
}

// The building glyph: 3 × 3 windows; lit (orange) = new items, capped at 9
function Facade({ id, newCount }) {
  const lit = Math.min(newCount, 9)
  const seed = seedFor(id)
  return (
    <span
      aria-hidden="true"
      className="relative grid h-[38px] w-[30px] shrink-0 grid-cols-3 gap-[3px] rounded-t-[2px] border-[1.5px] border-[rgba(188,201,190,0.45)] bg-[linear-gradient(180deg,rgba(79,201,180,0.06),transparent)] px-[5px] pt-2 pb-1"
    >
      <span className="absolute -top-1.5 left-2 h-[5px] w-2.5 border-[1.5px] border-b-0 border-[rgba(188,201,190,0.45)]" />
      {Array.from({ length: 9 }, (_, w) => {
        const tone =
          w < lit
            ? "bg-signal shadow-[0_0_6px_rgba(242,138,60,0.7)]"
            : (w * 7 + seed) % 5 === 0
              ? "bg-[rgba(79,201,180,0.55)]"
              : "bg-[rgba(188,201,190,0.16)]"
        return <i key={w} className={`h-1 w-full ${tone}`} />
      })}
    </span>
  )
}

function Skyline() {
  return (
    <svg viewBox="0 0 220 34" preserveAspectRatio="none" aria-hidden="true" className="mt-1 block h-[34px] w-full">
      <path
        d="M0 33 H14 V20 H24 V12 H34 V33 H42 V16 H50 V8 H58 V33 H70 V22 H84 V33 H92 V4 H100 V14 H106 V33 H118 V18 H132 V33 H140 V10 H152 V33 H162 V24 H174 V14 H182 V33 H194 V20 H206 V33 H220"
        fill="none"
        stroke="#bcc9be"
        strokeOpacity=".28"
        strokeWidth="1"
      />
      <rect x="94" y="8" width="2" height="2" fill="#f28a3c" />
      <rect x="52" y="12" width="2" height="2" fill="#4fc9b4" />
      <rect x="143" y="15" width="2" height="2" fill="#4fc9b4" />
    </svg>
  )
}

export function GroupsPanel({ groups, onAddGroup }) {
  return (
    <aside aria-labelledby="grp-h" className={`flex h-full flex-col gap-3 p-[22px] ${panelClass}`}>
      <span className="panel-tag">Groups</span>
      <div>
        <h2 id="grp-h" className="text-[28px] leading-none">Your buildings</h2>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          {groups.length} {groups.length === 1 ? "group" : "groups"} unmute listens to
        </p>
      </div>

      <ul className="flex flex-col gap-0.5">
        {groups.length === 0 && <li className="text-sm text-muted-foreground">No groups yet.</li>}
        {groups.map((g) => (
          <li key={g.id} className="flex items-center gap-3 rounded-xl px-2 py-[9px] transition-colors hover:bg-[rgba(243,239,230,0.04)]">
            <Facade id={g.id} newCount={g.newCount} />
            <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <span className="truncate text-sm font-medium">{g.name}</span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <i aria-hidden="true" className={`size-1.5 rounded-full ${g.status === "failed" ? "bg-destructive" : "bg-teal"}`} />
                {g.status === "failed"
                  ? `Couldn't join${g.error ? `: ${g.error}` : ""}`
                  : g.status === "joining" ? "Joining… a few minutes" : "Listening"}
              </span>
            </div>
            {g.newCount > 0 && (
              <span className="font-code shrink-0 text-[11px] font-semibold whitespace-nowrap text-signal">
                {g.newCount} new
              </span>
            )}
          </li>
        ))}
      </ul>

      <AddGroupForm onSubmit={onAddGroup}>
        <Skyline />
      </AddGroupForm>
    </aside>
  )
}
