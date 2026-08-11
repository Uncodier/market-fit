"use client"

import { useEffect, useState } from "react"
import { Label } from "@/app/components/ui/label"
import { Switch } from "@/app/components/ui/switch"
import { Checkbox } from "@/app/components/ui/checkbox"
import { listLocations } from "@/app/inventory/actions"
import type { Location, PromotionChannel } from "@/app/types"
import {
  DEFAULT_PROMOTION_CHANNELS,
  normalizePromotionChannels,
  normalizePromotionLocationIds,
} from "../promotion-channels"

const CHANNEL_OPTIONS: { id: PromotionChannel; label: string; description: string }[] = [
  {
    id: "marketplace",
    label: "Marketplace",
    description: "Public marketplace checkout",
  },
  {
    id: "shop",
    label: "Shop",
    description: "Online storefront for this site",
  },
  {
    id: "pos",
    label: "POS",
    description: "Point of Sale registers and locations",
  },
]

interface PromotionChannelsFieldsProps {
  siteId?: string | null
  channels?: PromotionChannel[] | null
  locationIds?: string[] | null
  onChange: (patch: {
    channels: PromotionChannel[]
    location_ids: string[]
  }) => void
  idPrefix?: string
  compact?: boolean
}

export function PromotionChannelsFields({
  siteId,
  channels: channelsProp,
  locationIds: locationIdsProp,
  onChange,
  idPrefix = "promo-channel",
  compact = false,
}: PromotionChannelsFieldsProps) {
  const [locations, setLocations] = useState<Location[]>([])
  const [loadingLocations, setLoadingLocations] = useState(false)

  const channels = normalizePromotionChannels(channelsProp)
  const locationIds = normalizePromotionLocationIds(locationIdsProp)
  const posEnabled = channels.includes("pos")

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!siteId) return
      setLoadingLocations(true)
      const res = await listLocations(siteId)
      if (!cancelled && res.data) {
        setLocations(res.data.filter((l: Location) => l.is_active !== false))
      }
      setLoadingLocations(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [siteId])

  const toggleChannel = (channel: PromotionChannel, enabled: boolean) => {
    let next = enabled
      ? Array.from(new Set([...channels, channel]))
      : channels.filter((c) => c !== channel)

    if (next.length === 0) {
      next = [...DEFAULT_PROMOTION_CHANNELS]
    }

    onChange({
      channels: next,
      location_ids: next.includes("pos") ? locationIds : [],
    })
  }

  const toggleLocation = (locationId: string, enabled: boolean) => {
    const next = enabled
      ? Array.from(new Set([...locationIds, locationId]))
      : locationIds.filter((id) => id !== locationId)
    onChange({ channels, location_ids: next })
  }

  return (
    <div className="space-y-3">
      {CHANNEL_OPTIONS.map((option) => {
        const checked = channels.includes(option.id)
        const fieldId = `${idPrefix}-${option.id}`
        return (
          <div
            key={option.id}
            className={`flex flex-row items-center justify-between rounded-lg border ${compact ? "p-3" : "p-4"}`}
          >
            <div className="space-y-0.5 pr-4">
              <Label htmlFor={fieldId} className={`${compact ? "text-sm" : "text-base"} cursor-pointer`}>
                {option.label}
              </Label>
              <p className="text-xs text-muted-foreground">{option.description}</p>
            </div>
            <Switch
              id={fieldId}
              checked={checked}
              onCheckedChange={(value) => toggleChannel(option.id, !!value)}
            />
          </div>
        )
      })}

      {posEnabled && (
        <div className="border rounded-md p-3 max-h-[220px] overflow-y-auto space-y-2 bg-muted/20">
          <Label className="block">POS Locations</Label>
          <p className="text-xs text-muted-foreground">
            Optional. If none are selected, the promotion applies at every active location.
          </p>
          {loadingLocations && (
            <p className="text-sm text-muted-foreground italic">Loading locations…</p>
          )}
          {!loadingLocations && locations.length === 0 && (
            <p className="text-sm text-muted-foreground italic">No locations found</p>
          )}
          {locations.map((loc) => {
            const locId = `${idPrefix}-loc-${loc.id}`
            return (
              <div key={loc.id} className="flex items-center space-x-2 py-1">
                <Checkbox
                  id={locId}
                  checked={locationIds.includes(loc.id)}
                  onCheckedChange={(checked) => toggleLocation(loc.id, !!checked)}
                />
                <label htmlFor={locId} className="text-sm cursor-pointer">
                  {loc.name}
                  {(loc.city || loc.address) && (
                    <span className="text-muted-foreground">
                      {" "}
                      — {[loc.address, loc.city].filter(Boolean).join(", ")}
                    </span>
                  )}
                </label>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
