/*
  InterestPicker
  "What are you into?": the 14 campus tags as chips. Opens by itself on first
  sign-in (no interests yet: the agent needs them to know what to plan), and
  from the Greeting's "Edit interests". Saves through app-api profile.set_interests.

  Props:
    open, onOpenChange: dialog state
    initial:            the saved tags (useProfile), e.g. ["hackathon", "workshop"]
    onSaved:            function(), called after a successful save (re-load the profile)
    required:           true on first sign-in: can't be dismissed without picking

  Needs: shadcn dialog, button; src/lib/adapt.js (TAG_LABELS); src/lib/api.js
*/
import { useState } from "react"
import { Check, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { ALL_TAGS, labelFor } from "@/lib/adapt"
import { api } from "@/lib/api"

export function InterestPicker({ open, onOpenChange, initial = [], onSaved, required = false }) {
  const [picked, setPicked] = useState(initial)
  const [saving, setSaving] = useState(false)
  const toggle = (tag) => setPicked((p) => (p.includes(tag) ? p.filter((t) => t !== tag) : [...p, tag]))

  async function save() {
    setSaving(true)
    const r = await api("profile.set_interests", { interests: picked })
    setSaving(false)
    if (!r.ok) return toast.error(r.error)
    onSaved?.()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (required && !o ? null : onOpenChange(o))}>
      <DialogContent
        showCloseButton={!required}
        className="gap-5 rounded-3xl border border-line-2 bg-surface p-7 ring-0 sm:max-w-[560px]"
      >
        <div className="flex flex-col gap-1.5">
          <DialogTitle className="text-[32px] leading-none">What are you into?</DialogTitle>
          <DialogDescription className="text-[13px] text-muted-foreground">
            The agent plans what matches these, plus placement and academic notices for everyone.
          </DialogDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {ALL_TAGS.filter((t) => t !== "other").map((tag) => {
            const on = picked.includes(tag)
            return (
              <button
                key={tag}
                aria-pressed={on}
                onClick={() => toggle(tag)}
                className={`flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors ${
                  on ? "border-teal bg-teal/15 text-foreground" : "text-muted-foreground hover:border-line-2 hover:text-foreground"
                }`}
              >
                {on && <Check className="size-3.5 text-teal" />}
                {labelFor(tag)}
              </button>
            )
          })}
        </div>
        <Button onClick={save} disabled={!picked.length || saving} className="self-start">
          {saving && <Loader2 className="size-4 animate-spin" />}
          {picked.length ? `Save ${picked.length} interest${picked.length === 1 ? "" : "s"}` : "Pick at least one"}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
