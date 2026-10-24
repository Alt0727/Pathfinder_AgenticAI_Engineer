import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ensureSession } from '@/lib/session'

// { session, userId, loading, error }: every other hook passes userId to its RPCs.
export function useSession() {
  const [session, setSession] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ensureSession()
      .then(setSession)
      .catch(setError)
      .finally(() => setLoading(false))

    // Keep the session fresh when supabase-js refreshes the token.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (next) setSession(next)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return { session, userId: session?.user.id ?? null, loading, error }
}
