import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

// The pattern every data hook follows (unmute-integration.md §5):
// load → subscribe to the tables it depends on → on ANY change, re-load (never patch locally).
// Realtime respects RLS, so this browser only hears about its own rows (and cards).
//   name:   label for the realtime channel
//   tables: tables whose changes trigger a re-load
//   load:   async () => data
//   ready:  false until inputs exist (e.g. no user id yet)
export function useLive(name, tables, load, ready = true) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const loadRef = useRef(load)
  loadRef.current = load   // always the latest load (it may close over new arguments)
  const reloadRef = useRef(() => {})

  useEffect(() => {
    if (!ready) return
    let active = true
    let timer

    const run = async () => {
      try {
        const next = await loadRef.current()
        if (active) { setData(next); setError(null) }
      } catch (err) {
        if (active) setError(err)
      } finally {
        if (active) setLoading(false)
      }
    }
    // Several rows often change together (e.g. an agent run): collapse them into one re-load.
    const soon = () => { clearTimeout(timer); timer = setTimeout(run, 150) }
    reloadRef.current = run

    const channel = supabase.channel(`${name}-${crypto.randomUUID()}`)
    for (const table of tables) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, soon)
    }
    // Load on every (re)subscribe, so changes missed while offline or asleep are picked up.
    channel.subscribe((status) => { if (status === 'SUBSCRIBED') run() })

    return () => {
      active = false
      clearTimeout(timer)
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, ready, tables.join(',')])

  return { data, loading, error, reload: () => reloadRef.current() }
}

// Unwraps a supabase-js reply: returns data or throws its error (so useLive can show it).
export async function must(query) {
  const { data, error } = await query
  if (error) throw error
  return data
}
