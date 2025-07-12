import { useState, useEffect } from 'react'
import { getUserData } from '@/app/services/user-service'

interface UserData {
  name: string
  avatar_url: string | null
}

export function useUserData(userIds: string[]) {
  const [userData, setUserData] = useState<Record<string, UserData>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchUserData = async () => {
      if (userIds.length === 0) return

      // Filter out IDs we already have
      const missingUserIds = userIds.filter(id => !userData[id])
      if (missingUserIds.length === 0) return

      setLoading(true)
      try {
        const promises = missingUserIds.map(async (userId) => {
          const data = await getUserData(userId)
          return { userId, data }
        })

        const results = await Promise.all(promises)
        const newUserData: Record<string, UserData> = {}
        
        results.forEach(({ userId, data }) => {
          if (data) {
            newUserData[userId] = data
          }
        })

        setUserData(prev => ({ ...prev, ...newUserData }))
      } catch (error) {
        console.error('Error fetching user data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchUserData()
  }, [userIds.join(',')]) // Only re-run if the userIds array changes

  return { userData, loading }
} 