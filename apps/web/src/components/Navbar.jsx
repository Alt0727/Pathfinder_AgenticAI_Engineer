/*
  Navbar
  Top bar: unmute logo (left), Home "YOUR BLOCK" / Explore "THE CITY" (centre),
  a Deadlines button with an orange count that opens the "Signals on the horizon"
  dropdown (most urgent first), and the profile avatar (right).

  Props:
    items:         all items (see lib/adapt.js cardToItem)
    onOpen:        function(item), called when a deadline in the dropdown is clicked
    deadlinesOpen: whether the dropdown is open (App owns this so "See all" can open it too)
    onDeadlinesOpenChange: function(open)

  Needs: shadcn button, dropdown-menu; Logo.jsx; src/lib/time.js
*/
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Logo } from "@/components/Logo"
import { CountdownPill } from "@/components/CountdownPill"
import { shortDateTime, upcomingDeadlines, useNow } from "@/lib/time"

function NavLink({ href, label, tag, active }) {
  return (
    <a
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex h-9 items-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-colors ${
        active ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
      <small className="font-code hidden text-[10px] tracking-[0.12em] text-teal uppercase sm:inline">{tag}</small>
    </a>
  )
}

export function Navbar({ items, onOpen, deadlinesOpen, onDeadlinesOpenChange }) {
  const now = useNow()
  const deadlines = upcomingDeadlines(items, now)

  return (
    <header className="sticky top-0 z-40 border-b bg-[rgba(9,13,11,0.78)] backdrop-blur-[8px]">
      <div className="mx-auto flex h-[68px] max-w-[1440px] items-center justify-between gap-4 px-5 sm:px-10">
        <a href="#block" aria-label="unmute home">
          <Logo />
        </a>

        <nav aria-label="Main" className="hidden gap-1 md:flex">
          <NavLink href="#block" label="Home" tag="Your block" active />
          <NavLink href="#city" label="Explore" tag="The city" />
        </nav>

        <div className="flex items-center gap-3">
          <DropdownMenu open={deadlinesOpen} onOpenChange={onDeadlinesOpenChange}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Bell className="size-4" />
                Deadlines
                <span className="font-code rounded-sm bg-signal px-[7px] py-px text-xs font-semibold text-signal-ink">
                  {deadlines.length}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              aria-label="Deadlines"
              className="w-[340px] gap-1 rounded-2xl border border-line-2 bg-surface p-3 shadow-[0_16px_40px_rgba(0,0,0,0.5)] ring-0"
            >
              <div className="flex items-center justify-between px-2.5 pt-1 pb-2">
                <span className="text-[15px] font-semibold">Signals on the horizon</span>
                <span className="text-[13px] text-muted-foreground">Nearest first</span>
              </div>
              {deadlines.length === 0 && (
                <p className="px-2.5 py-2 text-sm text-muted-foreground">No open deadlines.</p>
              )}
              {deadlines.map((d, i) => (
                <DropdownMenuItem
                  key={d.id}
                  onSelect={() => onOpen(d)}
                  className="gap-2.5 rounded-lg p-2.5 focus:bg-[rgba(243,239,230,0.05)]"
                >
                  <CountdownPill deadline={d.deadline_at} now={now} hot={i === 0} />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium">{d.title}</span>
                    <span className="truncate text-[13px] text-muted-foreground">{shortDateTime(d.deadline_at)}</span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div
            role="img"
            aria-label="Your profile"
            className="flex size-9 items-center justify-center rounded-full border border-line-2 bg-surface-2 text-xs font-semibold text-soft"
          >
            ME
          </div>
        </div>
      </div>
    </header>
  )
}
