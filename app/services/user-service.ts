import { createClient } from "@/utils/supabase/client"

// Cache for user data to avoid redundant fetches
const userCache: Record<string, { name: string, avatar_url: string | null }> = {}

/**
 * Fetch user data by user ID
 */
export async function getUserData(userId: string): Promise<{ name: string, avatar_url: string | null } | null> {
  // Check cache first
  if (userCache[userId]) {
    return userCache[userId]
  }

  try {
    const supabase = createClient()
    
    // First try to get the user from the profiles table
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, name, avatar_url")
      .eq("id", userId)
      .single()

    if (!profileError && profile) {
      // Cache the user data from profiles
      const userData = {
        name: profile.name || (profile.email ? profile.email.split('@')[0] : 'Team Member'),
        avatar_url: profile.avatar_url
      }
      
      userCache[userId] = userData
      return userData
    }

    // If profile not found, try to get auth user data directly
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(userId)
      
      if (!authError && authUser) {
        const userData = {
          name: authUser.user_metadata?.name || 
                authUser.user_metadata?.full_name || 
                (authUser.email ? authUser.email.split('@')[0] : 'Team Member'),
          avatar_url: authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || null
        }
        
        userCache[userId] = userData
        return userData
      }
    } catch (authError) {
      console.error("Error getting auth user data:", authError)
    }
    
    // If we still don't have user data, return a fallback with truncated ID
    console.log("Could not find user data for user ID:", userId)
    const fallbackData = {
      name: `Team Member (${userId.substring(0, 8)}...)`,
      avatar_url: null
    }
    
    // Still cache this fallback to avoid repeated lookups
    userCache[userId] = fallbackData
    return fallbackData
  } catch (error) {
    console.error("Unexpected error fetching user data:", error)
    return {
      name: `Team Member (${userId.substring(0, 8)}...)`,
      avatar_url: null
    }
  }
} 