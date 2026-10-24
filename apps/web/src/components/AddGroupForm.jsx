/*
  AddGroupForm
  Dashed "+ Add a group" button. Clicking it opens an inline form above it to
  paste a WhatsApp invite link, with a note that the bot only listens.

  Props:
    onSubmit: function(link), called with the pasted link when the form is sent
    children: optional, rendered between the form and the button (the skyline)

  Needs: shadcn input, button
*/
import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function AddGroupForm({ onSubmit, children }) {
  const [open, setOpen] = useState(false)
  const [link, setLink] = useState("")
  const looksValid = link.trim().startsWith("https://chat.whatsapp.com/")

  function handleSubmit(e) {
    e.preventDefault() // stop the browser reloading the page
    if (!looksValid) return
    onSubmit(link.trim())
    setLink("")
    setOpen(false)
  }

  function cancel() {
    setLink("")
    setOpen(false)
  }

  return (
    <>
      {open && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-xl border border-line-2 p-3">
          <label htmlFor="invite" className="text-[13px] font-medium">
            Paste the group's invite link
          </label>
          <Input
            id="invite"
            type="url"
            autoFocus
            placeholder="https://chat.whatsapp.com/…"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            aria-invalid={link !== "" && !looksValid}
          />
          {link && !looksValid && (
            <p className="text-[13px] text-destructive">That doesn't look like a WhatsApp invite link.</p>
          )}
          <p className="text-[13px] leading-[1.45] text-muted-foreground">
            Our bot joins as a silent, read-only listener. It never posts.
          </p>
          <div className="flex gap-2">
            <Button type="submit" size="sm" className="flex-1" disabled={!looksValid}>
              Connect
            </Button>
            <Button type="button" variant="outline" size="sm" className="flex-1" onClick={cancel}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <div className="flex-1" />
      {children}

      <Button variant="outline" className="w-full border-dashed" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Plus className="size-4" /> Add a group
      </Button>
    </>
  )
}
