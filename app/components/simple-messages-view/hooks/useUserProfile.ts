import { useState, useEffect } from 'react'
import { getUserData } from '@/app/services/user-service'

interface UserProfile {
  name: string | null
  avatar_url: string | null
}

export const useUserProfile = (userId: string | null | undefined) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    console.log('🔍 useUserProfile called with userId:', userId)
    
    if (!userId) {
      console.log('🔍 No userId provided, setting userProfile to null')
      setUserProfile(null)
      return
    }

    const fetchUserProfile = async () => {
      console.log('🔍 Fetching user profile for userId:', userId)
      setIsLoading(true)
      try {
        const userData = await getUserData(userId)
        console.log('🔍 getUserData result:', userData)
        
        if (userData) {
          setUserProfile({
            name: userData.name,
            avatar_url: userData.avatar_url
          })
        } else {
          setUserProfile({ name: null, avatar_url: null })
        }
      } catch (error) {
        console.error('Error fetching user profile:', error)
        setUserProfile({ name: null, avatar_url: null })
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserProfile()
  }, [userId])

  return { userProfile, isLoading }
}
