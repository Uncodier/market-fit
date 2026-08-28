"use client"

import React, { useEffect, useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Label } from "@/app/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { useAuthContext as useAuth } from "@/app/components/auth/auth-provider"
import { useLocalization } from "@/app/context/LocalizationContext"
import { mergeDestinationSites, sameDestinationSites } from "@/app/components/commerce/destination-sites"

interface DestinationSelectorProps {
  value: string | null // null = personal
  onChange: (siteId: string | null) => void
  label?: string
  locked?: boolean
}

export function DestinationSelector({ value, onChange, label, locked = false }: DestinationSelectorProps) {
  const { user } = useAuth()
  const { t } = useLocalization()
  const userId = user?.id ?? null
  const [sites, setSites] = useState<{ id: string, name: string }[]>([])
  const [loading, setLoading] = useState(Boolean(userId))

  useEffect(() => {
    if (!userId) {
      setSites([])
      setLoading(false)
      return
    }

    let cancelled = false

    async function loadSites() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('sites')
        .select(`
          id,
          name,
          site_members!inner (user_id, status)
        `)
        .eq('site_members.user_id', userId)
        .eq('site_members.status', 'active')

      const { data: ownedSites, error: ownedError } = await supabase
        .from('sites')
        .select('id, name')
        .eq('user_id', userId)

      if (cancelled) return

      const memberSites = !error && data
        ? data.map((site: { id: string; name: string }) => ({ id: site.id, name: site.name }))
        : []
      const owned = !ownedError && ownedSites ? ownedSites : []
      const next = mergeDestinationSites(memberSites, owned)

      setSites((prev) => (sameDestinationSites(prev, next) ? prev : next))
      setLoading(false)
    }

    void loadSites()
    return () => {
      cancelled = true
    }
  }, [userId])

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
