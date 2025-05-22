"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { AllowedDomain } from "@/app/types/domains"
import { useSite } from "@/app/context/SiteContext"

export function useAllowedDomains() {
  const { currentSite } = useSite()
  const [domains, setDomains] = useState<AllowedDomain[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Load domains
  useEffect(() => {
    if (!currentSite) {
      setDomains([])
      setIsLoading(false)
      return
    }

    const loadDomains = async () => {
      try {
        setIsLoading(true)
        const supabase = createClient()
        
        const { data, error } = await supabase
          .from('allowed_domains')
          .select('*')
          .eq('site_id', currentSite.id)
          .order('created_at', { ascending: false })

        if (error) throw error

        setDomains(data || [])
      } catch (error) {
        console.error('Error loading domains:', error)
        toast.error('Failed to load allowed domains')
      } finally {
        setIsLoading(false)
      }
    }

    loadDomains()
  }, [currentSite])

  // Add domain
  const addDomain = async (domain: string): Promise<boolean> => {
    if (!currentSite) {
      toast.error('Please select a site first')
      return false
    }

    try {
      setIsSubmitting(true)
      const supabase = createClient()

      const { data, error } = await supabase
        .from('allowed_domains')
        .insert([
          {
            site_id: currentSite.id,
            domain: domain.toLowerCase().trim()
          }
        ])
        .select()
        .single()

      if (error) throw error

      setDomains(prev => [data, ...prev])
      toast.success('Domain added successfully')
      return true
    } catch (error: any) {
      console.error('Error adding domain:', error)
      if (error.code === '23505') {
        toast.error('This domain is already allowed')
      } else if (error.code === '23514') {
        toast.error('Invalid domain format')
      } else {
        toast.error('Failed to add domain')
      }
      return false
    } finally {
      setIsSubmitting(false)
    }
  }

  // Delete domain
  const deleteDomain = async (id: string) => {
    try {
      setIsSubmitting(true)
      const supabase = createClient()

      const { error } = await supabase
        .from('allowed_domains')
        .delete()
        .eq('id', id)

      if (error) throw error

      setDomains(prev => prev.filter(domain => domain.id !== id))
      toast.success('Domain removed successfully')
    } catch (error) {
      console.error('Error deleting domain:', error)
      toast.error('Failed to remove domain')
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    domains,
    isLoading,
    isSubmitting,
    addDomain,
    deleteDomain
  }
} 