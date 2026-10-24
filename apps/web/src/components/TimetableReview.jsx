/*
  TimetableReview
  The class timetable dialog (opened from "Import class timetable" in Your week).
  1. Upload a photo or PDF → the AI reads the weekly classes (nothing is saved yet;
     the image is never stored).
  2. Review: fix day / times / name, delete wrong rows (e.g. the other batch's lab),
     add a row.
  3. Save: "Replace my class timetable" (keeps personal slots like Gym) or "Add".
  Below that, the classes already saved, each with a delete.

  Props:
    open, onOpenChange: dialog state
    slots:              saved timetable_slots (useTimetable)

  Needs: shadcn dialog, button, input; src/lib/api.js, src/lib/files.js
*/
import { useState } from "react"
import { Loader2, Plus, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"
import { TIMETABLE_TYPES, toBase64 } from "@/lib/files"

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const cell = "h-8 rounded-md border bg-deep px-2 text-[13px]"

export function TimetableReview({ open, onOpenChange, slots }) {
  const [section, setSection] = useState("")
  const [stage, setStage] = useState("idle") // idle | reading | saving
  const [rows, setRows] = useState(null) // the AI's proposal, editable
  const [warnings, setWarnings] = useState([])

  const classes = slots.filter((s) => s.kind === "class")
  const personal = slots.filter((s) => s.kind !== "class")
  const setRow = (i, patch) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  async function upload(e) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!TIMETABLE_TYPES.includes(file.type)) return toast.error("Upload a PNG, JPEG or PDF")
    setStage("reading")
    setRows(null)
    const { data, mime } = await toBase64(file)
    const r = await api("timetable.parse", { file_base64: data, mime_type: mime, section: section.trim() || undefined })
    setStage("idle")
    if (!r.ok) return toast.error(r.error)
    setRows(r.slots)
    setWarnings(r.warnings ?? [])
  }

  async function save(mode) {
    setStage("saving")
    const r = await api("slots.save_import", { mode, slots: rows })
    setStage("idle")
    if (!r.ok) return toast.error(r.error)
    toast(`Saved ${r.saved} ${r.saved === 1 ? "class" : "classes"}`)
    setRows(null)
    setWarnings([])
  }

  async function remove(slotId) {
    const r = await api("slots.delete", { slot_id: slotId })
    if (!r.ok) toast.error(r.error)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-5 overflow-y-auto rounded-3xl border border-line-2 bg-surface p-7 ring-0 sm:max-w-[760px]">
        <div className="flex flex-col gap-1.5">
          <DialogTitle className="text-[32px] leading-none">Your class timetable</DialogTitle>
          <DialogDescription className="text-[13px] text-muted-foreground">
            Crop out your name and roll number: we only need the grid. The image is read once and never stored.
          </DialogDescription>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Input value={section} onChange={(e) => setSection(e.target.value)} placeholder="Section (optional)" className="h-9 w-40" />
          <Button asChild disabled={stage !== "idle"}>
            <label className={stage !== "idle" ? "pointer-events-none opacity-60" : "cursor-pointer"}>
              {stage === "reading" ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {stage === "reading" ? "Reading your timetable…" : "Upload photo or PDF"}
              <input type="file" accept="image/png,image/jpeg,application/pdf" className="hidden" onChange={upload} />
            </label>
          </Button>
        </div>

        {rows && (
          <div className="flex flex-col gap-3">
            {warnings.map((w) => (
              <p key={w} className="text-[13px] text-signal">⚠ {w}</p>
            ))}
            <p className="text-[13px] text-muted-foreground">
              Check the rows: fix anything wrong, delete classes that aren't yours (e.g. the other batch's lab).
            </p>
            <div className="flex flex-col gap-1.5">
              {rows.map((r, i) => (
                <div key={i} className="flex flex-wrap items-center gap-1.5">
                  <select aria-label="Day" className={cell} value={r.day_of_week} onChange={(e) => setRow(i, { day_of_week: Number(e.target.value) })}>
                    {DAYS.map((d, n) => <option key={d} value={n}>{d}</option>)}
                  </select>
                  <input aria-label="Start" type="time" className={cell} value={r.start_time} onChange={(e) => setRow(i, { start_time: e.target.value })} />
                  <input aria-label="End" type="time" className={cell} value={r.end_time} onChange={(e) => setRow(i, { end_time: e.target.value })} />
                  <input aria-label="Class" className={`${cell} min-w-0 flex-1`} value={r.label} onChange={(e) => setRow(i, { label: e.target.value })} />
                  <Button variant="ghost" size="icon-sm" aria-label="Delete row" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                    <Trash2 />
                  </Button>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="self-start" onClick={() => setRows([...rows, { day_of_week: 1, start_time: "09:00", end_time: "10:00", label: "", kind: "class" }])}>
                <Plus className="size-4" /> Add a row
              </Button>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Button onClick={() => save("replace")} disabled={!rows.length || stage !== "idle"}>
                {stage === "saving" && <Loader2 className="size-4 animate-spin" />} Replace my class timetable
              </Button>
              <Button variant="outline" onClick={() => save("add")} disabled={!rows.length || stage !== "idle"}>Add to it</Button>
              <Button variant="ghost" onClick={() => setRows(null)}>Discard</Button>
            </div>
          </div>
        )}

        {!rows && (
          <div className="flex flex-col gap-2">
            <span className="eyebrow">Saved · {classes.length} {classes.length === 1 ? "class" : "classes"}{personal.length ? ` · ${personal.length} personal` : ""}</span>
            {slots.length === 0 && <p className="text-[13px] text-muted-foreground">Nothing yet. Upload your timetable above.</p>}
            <div className="grid gap-1 sm:grid-cols-2">
              {slots.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-[13px]">
                  <span className="min-w-0 truncate">
                    <span className="font-code text-muted-foreground">{DAYS[s.day_of_week]} {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}</span>{" "}
                    {s.label}
                  </span>
                  <Button variant="ghost" size="icon-xs" aria-label={`Delete ${s.label}`} onClick={() => remove(s.id)}>
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
