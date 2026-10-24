/*
  AgentQuestion
  The agent's questions (ask_user), shown in Your week under the status line.
  The agent asks instead of acting when something clashes with your timetable
  or with an entry you placed: answering is what gives it permission (for that
  one date). One card per pending question, with its 2–4 options as buttons.

  Props:
    questions: array of { id, question, options: [string] } (useQuestions)
    onAnswer:  async function(questionId, answer)

  Needs: shadcn button; tokens (signal colours)
*/
import { useState } from "react"
import { Loader2, MessageCircleQuestion } from "lucide-react"
import { Button } from "@/components/ui/button"

export function AgentQuestion({ questions, onAnswer }) {
  const [busy, setBusy] = useState(null) // "<questionId>|<option>" while sending

  if (!questions.length) return null

  return (
    <div className="flex flex-col gap-2.5">
      {questions.map((q) => (
        <div
          key={q.id}
          role="group"
          aria-label="The agent has a question"
          className="flex flex-col gap-3 rounded-xl border border-signal-line bg-signal-soft p-4 animate-in fade-in-0 duration-200"
        >
          <p className="flex items-start gap-2.5 text-sm leading-[1.45]">
            <MessageCircleQuestion aria-hidden="true" className="mt-px size-[18px] shrink-0 text-signal" />
            <span>
              <span className="eyebrow mb-1 block text-signal">The agent asks</span>
              {q.question}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {q.options.map((option, i) => {
              const key = `${q.id}|${option}`
              return (
                <Button
                  key={option}
                  size="sm"
                  variant={i === 0 ? "default" : "outline"}
                  disabled={busy !== null}
                  onClick={async () => {
                    setBusy(key)
                    try {
                      await onAnswer(q.id, option)
                    } finally {
                      setBusy(null)
                    }
                  }}
                >
                  {busy === key && <Loader2 className="size-4 animate-spin" />}
                  {option}
                </Button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
