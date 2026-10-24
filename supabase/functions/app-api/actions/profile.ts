import { db } from '../../_shared/supabase.ts'

// The fixed tag list (same as AI #1's): interests must come from it so feed matching works.
export const TAGS = [
  'hackathon', 'workshop', 'talk', 'placement', 'internship', 'sports', 'cultural',
  'club', 'academic', 'fest', 'competition', 'scholarship', 'civic', 'other',
]

// profile.set_interests { interests[] } → upsert profiles
async function setInterests(p: Record<string, unknown>, ctx: { userId: string }) {
  const interests = p.interests
  if (!Array.isArray(interests) || interests.length === 0) return { ok: false, error: 'pick at least one interest' }
  const bad = interests.filter((t) => typeof t !== 'string' || !TAGS.includes(t))
  if (bad.length) return { ok: false, error: `unknown interests: ${bad.join(', ')}` }

  const { error } = await db
    .from('profiles')
    .upsert({ id: ctx.userId, interests: [...new Set(interests as string[])] })
  if (error) throw error
  return { ok: true }
}

export const profileActions = { 'profile.set_interests': setInterests }
