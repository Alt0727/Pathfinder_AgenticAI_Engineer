/*
  Root
  The app flow (motion spec §1):
    landing / sign-in  →  sign-in succeeds  →  "Loading your city"  →  main page (App)

  "Loading your city" runs the main page's first requests (lib/data.js) and
  hands the results to App ~200 ms into its exit, so the main page settles in
  underneath while the skyline sinks away.

  A returning visitor (this browser already has an anonymous session) skips the
  landing page and starts at "Loading your city".
*/
import { useCallback, useEffect, useState } from "react"
import App from "./App.jsx"
import { LandingPage } from "@/components/LandingPage"
import { LoadingCity } from "@/components/LoadingCity"
import { signIn } from "@/lib/auth"
import { LOAD_STEPS, toAppData } from "@/lib/data"
import { validSession } from "@/lib/session"

export default function Root() {
  const [stage, setStage] = useState(null) // null (checking) | "landing" | "loading" | "main"
  const [data, setData] = useState(null)
  const [loaderShown, setLoaderShown] = useState(false)

  // A valid saved session → straight to the loader; none (or its user was reset) → the landing page
  useEffect(() => {
    validSession().then((session) => {
      setStage(session ? "loading" : "landing")
      setLoaderShown(Boolean(session))
    })
  }, [])

  const handleReady = useCallback((results) => {
    setData(toAppData(results))
    setStage("main")
  }, [])
  const handleExited = useCallback(() => setLoaderShown(false), [])

  if (stage === null) return null // a few ms: checking for a saved session

  if (stage === "landing") {
    return (
      <LandingPage
        onSignIn={signIn}
        onSignedIn={() => {
          setStage("loading")
          setLoaderShown(true)
        }}
      />
    )
  }

  return (
    <>
      {data && <App data={data} arriving />}
      {loaderShown && <LoadingCity steps={LOAD_STEPS} onReady={handleReady} onExited={handleExited} />}
    </>
  )
}
