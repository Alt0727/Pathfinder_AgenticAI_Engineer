/*
  data.js
  The main page's first requests, as named steps. "Loading your city" runs them
  in parallel and lights its windows as each one really finishes. Throwing shows
  the loader's "Couldn't load …" + Retry; an optional step can be skipped.
  These are one-shot reads that warm the page; after it opens, App keeps every
  section live with the hooks (realtime).
*/
import { supabase } from "@/lib/supabase"
import { ensureSession } from "@/lib/session"
import { weekRange } from "@/lib/ist"

async function must(query) {
  const { data, error } = await query
  if (error) throw error
  return data
}
const userId = async () => (await ensureSession()).user.id

export const LOAD_STEPS = [
  {
    key: "groups",
    label: "Reading your buildings…",
    thing: "your groups",
    load: async () => must(supabase.from("group_invites").select("id").eq("requested_by", await userId())),
  },
  {
    key: "deadlines",
    label: "Finding signals…",
    thing: "your deadlines",
    load: async () => must(supabase.from("cards").select("id").eq("status", "active").limit(200)),
  },
  {
    key: "week",
    label: "Laying out your week…",
    thing: "your week",
    load: async () => {
      const { from, to } = weekRange()
      return must(supabase.rpc("get_week", { p_user: await userId(), p_from: from, p_to: to }))
    },
  },
  {
    key: "network",
    label: "Mapping your network…",
    thing: "your network",
    optional: true,
    load: async () => must(supabase.from("profiles").select("interests").eq("id", await userId())),
  },
]

// App reads everything live through hooks; the loader's results only tell it the page is warm.
export function toAppData(results) {
  return { ready: true, results }
}
