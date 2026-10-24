/*
  SignIn
  The sign-in card that sits under the horizon on the landing page. For now it
  is just the label and a "Sign in →" button; the real fields (email, password,
  Google…) go in the form marked below once they're decided.
  While signing in, the button reads "Signing in…" with a spinner; an error
  shows inline above the button (the card never shakes).

  Props:
    onSignIn: function(), may be async. Resolve to continue, throw to show an error.

  Needs: shadcn button; styles/landing.css (.signin)
*/
import { useState } from "react"
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export function SignIn({ onSignIn }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault() // stop the browser reloading the page
    setSubmitting(true)
    setError(null)
    try {
      await onSignIn()
    } catch (err) {
      setError(err?.message || "Couldn't sign you in. Try again.")
      setSubmitting(false)
    }
  }

  return (
    <div className="signin">
      <p className="font-code mb-5 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        Sign in to your block
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Sign-in fields go here: 44px tall inputs, e.g. <Input className="h-11" /> */}

        <div aria-live="polite">
          {error && (
            <p className="flex animate-in items-start gap-2 rounded-lg border border-[rgba(240,180,168,0.45)] bg-[rgba(240,180,168,0.08)] px-3 py-2.5 text-[13px] text-destructive duration-[180ms] fade-in-0">
              <AlertCircle className="mt-px size-4 shrink-0" />
              {error}
            </p>
          )}
        </div>

        <Button type="submit" disabled={submitting} className="h-[46px] w-full text-[15px]">
          {submitting ? (
            <>
              <Loader2 className="size-3.5 animate-spin" /> Signing in…
            </>
          ) : (
            <>
              Sign in <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </form>
    </div>
  )
}
