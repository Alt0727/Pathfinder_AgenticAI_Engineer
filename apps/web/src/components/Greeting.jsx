/*
  Greeting
  The "Your block" hero: the eyebrow "YOUR BLOCK · THU 15 OCT", the headline
  "GOOD EVENING. 7 THINGS ON YOUR WEEK, 1 CLOSES TONIGHT." and on the right
  "● 6 BUILDINGS LISTENING". A static perspective floor sits behind the bottom.
  The "closes tonight" clause is dropped when nothing closes tonight.

  Props:
    weekCount:      how many things are on the student's calendar this week
    items:          all items (to count what closes tonight)
    listeningCount: how many groups the bot is listening to
    onEditInterests: optional function(), shows an "Edit interests" link

  Needs: src/lib/time.js, date-fns; unmute.css (.floor, .eyebrow)
*/
import { endOfDay, format } from "date-fns"
import { upcomingDeadlines, useNow } from "@/lib/time"

function greetingFor(hour) {
  if (hour < 12) return "Good morning."
  if (hour < 17) return "Good afternoon."
  return "Good evening."
}

export function Greeting({ weekCount, items, listeningCount, onEditInterests }) {
  const now = useNow(60000) // update once a minute
  const tonight = upcomingDeadlines(items, now).filter(
    (d) => new Date(d.deadline_at) <= endOfDay(new Date(now)),
  ).length

  return (
    <div className="relative flex flex-wrap items-end justify-between gap-x-10 gap-y-4 pt-[52px] pb-[92px]">
      <div aria-hidden="true" className="floor floor-hero" />

      <div className="relative flex flex-col gap-3.5">
        <span className="eyebrow">Your block · {format(new Date(now), "EEE d MMM")}</span>
        <h1 id="hero-title" tabIndex={-1} className="max-w-[1240px] outline-none text-4xl leading-[0.98] md:text-[44px] lg:text-[54px]">
          {greetingFor(new Date(now).getHours())}{" "}
          <span className="text-teal">
            {weekCount} {weekCount === 1 ? "thing" : "things"}
          </span>{" "}
          on your week{tonight > 0 ? "," : "."}
          {tonight > 0 && <span className="text-signal"> {tonight} closes tonight.</span>}
        </h1>
      </div>

      <p className="eyebrow relative flex items-center gap-2">
        <span aria-hidden="true" className="size-[7px] rounded-full bg-teal shadow-[0_0_0_4px_rgba(79,201,180,0.18)]" />
        {listeningCount} {listeningCount === 1 ? "building" : "buildings"} listening
        {onEditInterests && (
          <>
            <span aria-hidden="true">·</span>
            <button onClick={onEditInterests} className="underline-offset-4 hover:text-foreground hover:underline">
              Edit interests
            </button>
          </>
        )}
      </p>
    </div>
  )
}
