import type { createClient } from '@/lib/supabase/client'

type ProfileClient = Pick<ReturnType<typeof createClient>, 'from'>
export type VisibleProfile = { name: string; avatar_url: string | null }

function label(row: { name?: unknown; avatar_url?: unknown }): VisibleProfile {
  return { name: typeof row.name === 'string' && row.name.trim() ? row.name : 'Team Member',
    avatar_url: typeof row.avatar_url === 'string' ? row.avatar_url : null }
}

// A profile ID is not an Auth access token. If RLS hides a display name use
// an ordinary label rather than issuing an Auth request or borrowing a cached
// name populated under a previous session. Callers may batch in their own scope.
export async function readVisibleProfile(client: ProfileClient, userId: string) {
  const fallback = { name: `Team Member (${userId.substring(0, 8)}...)`, avatar_url: null }
  try {
    const { data, error } = await client.from('profiles').select('id, name, avatar_url')
      .eq('id', userId).maybeSingle()
    if (error || !data || data.id !== userId) return fallback
    return label(data)
  } catch { return fallback }
}

export async function readVisibleProfiles(client: ProfileClient, ids: readonly string[], signal: AbortSignal) {
  const profiles: Record<string, VisibleProfile> = Object.create(null)
  const unique = [...new Set(ids)]
  for (let i = 0; i < unique.length; i += 50) {
    if (signal.aborted) throw new Error('Profile lookup cancelled')
    const batch = unique.slice(i, i + 50)
    const { data, error } = await client.from('profiles').select('id, name, avatar_url')
      .in('id', batch).retry(false).abortSignal(signal)
    if (error || signal.aborted || !Array.isArray(data)) throw new Error('Profiles unavailable')
    for (const row of data) if (row && batch.includes(row.id)) profiles[row.id] = label(row)
  }
  return profiles
}