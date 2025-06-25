import { useState, useEffect } from 'react'
import { useSite } from '@/app/context/SiteContext'
import { createClient } from '@/lib/supabase/client'

export function useBilling() {
  const { currentSite, refreshSites } = useSite()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshCredits = async () => {
    if (!currentSite) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      // Force refresh of site data to get latest billing info
      await refreshSites()
    } catch (err) {
      console.error('Error refreshing credits:', err)
      setError(err instanceof Error ? err.message : 'Failed to refresh credits')
    } finally {
      setIsLoading(false)
    }
  }

  const getBillingData = async () => {
    if (!currentSite) return null
    
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('billing')
        .select('*')
        .eq('site_id', currentSite.id)
        .single()
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching billing data:', error)
        return null
      }
      
      return data
    } catch (err) {
      console.error('Error getting billing data:', err)
      return null
    }
  }

  return {
    currentSite,
    billingData: currentSite?.billing,
    creditsAvailable: currentSite?.billing?.credits_available || 0,
    isLoading,
    error,
    refreshCredits,
    getBillingData
  }
} 