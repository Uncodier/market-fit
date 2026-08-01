"use client"

import React, { useEffect, useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Label } from "@/app/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { useAuthContext as useAuth } from "@/app/components/auth/auth-provider"

import { useLocalization } from "@/app/context/LocalizationContext"

interface DestinationSelectorProps {
  value: string | null // null = personal
  onChange: (siteId: string | null) => void
  label?: string
  locked?: boolean
}

export function DestinationSelector({ value, onChange, label, locked = false }: DestinationSelectorProps) {
  const { user } = useAuth()
  const { t } = useLocalization()
  const session = user ? { user } : null
  const [sites, setSites] = useState<{ id: string, name: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadSites() {
      if (!session?.user) {
        setLoading(false)
        return
      }
      
      const supabase = createClient()
      // Need to find sites where this user is an active member or owner
      const { data, error } = await supabase
        .from('sites')
        .select(`
          id,
          name,
          site_members!inner (user_id, status)
        `)
        .eq('site_members.user_id', session.user.id)
        .eq('site_members.status', 'active')
        
      if (!error && data) {
        setSites(data.map(s => ({ id: s.id, name: s.name })))
      }
      
      // Also get owned sites directly
      const { data: ownedSites, error: ownedError } = await supabase
        .from('sites')
        .select('id, name')
        .eq('user_id', session.user.id)
        
      if (!ownedError && ownedSites) {
        setSites(prev => {
          const combined = [...prev]
          ownedSites.forEach(os => {
            if (!combined.some(s => s.id === os.id)) {
              combined.push(os)
            }
          })
          return combined
        })
      }
      
      setLoading(false)
    }
    
    loadSites()
  }, [session])

  // If not logged in or no sites (and not locked with a value), don't show the selector
  if (loading || (sites.length === 0 && !locked)) {
    return null
  }

  return (
    <div className="space-y-2">
      <Label>{label || t('destination.label') || "Purchase Destination"}</Label>
      <Select 
        value={value === null ? "personal" : value} 
        onValueChange={(val) => onChange(val === "personal" ? null : val)}
        disabled={locked}
      >
        <SelectTrigger className={locked ? "opacity-80 cursor-default" : ""}>
          <SelectValue placeholder={t('checkout.selectDestination') || "Select destination..."} />
        </SelectTrigger>
        <SelectContent>
          {!locked && <SelectItem value="personal">{t('destination.personal') || "Personal Account"}</SelectItem>}
          {sites.map(s => (
            <SelectItem key={s.id} value={s.id}>{s.name} ({t('destination.business') || "Business"})</SelectItem>
          ))}
          {locked && value && !sites.find(s => s.id === value) && (
            <SelectItem value={value}>{t('destination.business') || "Business Account"}</SelectItem>
          )}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        {locked 
          ? (t('destination.lockedDesc') || "This purchase is locked to the current business account.")
          : (t('destination.desc') || "Choose where this purchase should be filed. Personal purchases stay in your private account.")}
      </p>
    </div>
  )
}
