/*
  PlanBar
  Plan tabs ("Plan A · Balanced", "Plan B · Career focus") and the mint
  "Generate plan" button. The button opens a small menu to pick the plan style;
  generating a style that already exists refreshes that plan.

  Props:
    plans:      array of { id, name }
    activeId:   id of the selected plan
    onSelect:   function(id), called when a tab is clicked
    onGenerate: function(kind), kind = "balanced" | "career"
    generating: optional true/false, shows a spinner on the button

  Needs: shadcn button, dropdown-menu; src/lib/plans.js
*/
import { Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PLAN_KINDS } from "@/lib/plans"

export function PlanBar({ plans, activeId, onSelect, onGenerate, generating = false }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {plans.length > 0 && (
        <div role="group" aria-label="Saved plans" className="flex gap-[3px] rounded-[5px] border bg-deep p-[3px]">
          {plans.map((p) => {
            const active = p.id === activeId
            return (
              <button
                key={p.id}
                aria-pressed={active}
                onClick={() => onSelect(p.id)}
                className={`h-8 rounded-sm px-3 text-[13px] font-medium whitespace-nowrap transition-colors ${
                  active ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.name}
              </button>
            )
          })}
        </div>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button disabled={generating}>
            {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Generate plan
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="rounded-2xl border border-line-2 bg-surface ring-0">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Plan style</DropdownMenuLabel>
          {Object.entries(PLAN_KINDS).map(([kind, label]) => (
            <DropdownMenuItem key={kind} onSelect={() => onGenerate(kind)}>
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
