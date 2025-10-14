import { useState, useEffect } from 'react'
import { getUserData } from '@/app/services/user-service'

interface UserProfile {
  name: string | null
  avatar_url: string | null
}

// Cache to prevent repeated API calls
const userProfileCache = new Map<string, UserProfile>()

export const useUserProfile = (userId: string | null | undefined) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!userId) {
      setUserProfile(null)
      return
    }

    // Check cache first
    if (userProfileCache.has(userId)) {
      setUserProfile(userProfileCache.get(userId)!)
      return
    }

    const fetchUserProfile = async () => {
      setIsLoading(true)
      try {
        const userData = await getUserData(userId)
        
        const profile = userData ? {
          name: userData.name,
          avatar_url: userData.avatar_url
        } : { name: null, avatar_url: null }
        
        // Cache the result
        userProfileCache.set(userId, profile)
        setUserProfile(profile)
      } catch (error) {
        console.error('Error fetching user profile:', error)
        const profile = { name: null, avatar_url: null }
        userProfileCache.set(userId, profile)
        setUserProfile(profile)
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserProfile()
  }, [userId])

  return { userProfile, isLoading }
}
