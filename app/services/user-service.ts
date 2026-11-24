import { createClient } from '@/lib/supabase/client'
import { readVisibleProfile } from './read-visible-profile'

export async function getUserData(userId: string): Promise<{ name: string; avatar_url: string | null } | null> {
  return readVisibleProfile(createClient(), userId)
}