/*
  TimetableImport
  Button for the header of Your week. Before a timetable exists it reads
  "Import class timetable"; after, "Timetable · 21 classes". Either way it opens
  the timetable dialog (TimetableReview), which uploads, reviews and saves.

  Props:
    count:  how many class slots are saved (0 = none yet)
    onOpen: function(), opens the timetable dialog

  Needs: shadcn button
*/
import { CalendarClock, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"

export function TimetableImport({ count = 0, onOpen }) {
  return (
    <Button variant="outline" size="sm" onClick={onOpen}>
      {count > 0 ? <CalendarClock className="size-4" /> : <Upload className="size-4" />}
      {count > 0 ? `Timetable · ${count} ${count === 1 ? "class" : "classes"}` : "Import class timetable"}
    </Button>
  )
}
