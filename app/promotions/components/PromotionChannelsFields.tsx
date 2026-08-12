"use client"

import { useEffect, useState } from "react"
import { Label } from "@/app/components/ui/label"
import { Switch } from "@/app/components/ui/switch"
import { Checkbox } from "@/app/components/ui/checkbox"
import { Skeleton } from "@/app/components/ui/skeleton"
import { useLocalization } from "@/app/context/LocalizationContext"
import { listLocations } from "@/app/inventory/actions"
import type { Location, PromotionChannel } from "@/app/types"
import {
  DEFAULT_PROMOTION_CHANNELS,
  normalizePromotionChannels,
  normalizePromotionLocationIds,
} from "../promotion-channels"

const CHANNEL_OPTIONS: {
  id: PromotionChannel
  labelKey: string
  labelFallback: string
  descriptionKey: string
  descriptionFallback: string
}[] = [
  {
    id: "marketplace",
    labelKey: "promotions.detail.channels.marketplace",
    labelFallback: "Marketplace",
    descriptionKey: "promotions.detail.channels.marketplaceDesc",
    descriptionFallback: "Public marketplace checkout",
  },
  {
    id: "shop",
    labelKey: "promotions.detail.channels.shop",
    labelFallback: "Shop",
    descriptionKey: "promotions.detail.channels.shopDesc",
    descriptionFallback: "Online storefront for this site",
  },
  {
    id: "pos",
    labelKey: "promotions.detail.channels.pos",
    labelFallback: "POS",
    descriptionKey: "promotions.detail.channels.posDesc",
    descriptionFallback: "Point of Sale registers and locations",
  },
]

function isFullChannelSet(channels: PromotionChannel[]): boolean {
  return (
    channels.length === DEFAULT_PROMOTION_CHANNELS.length &&
    DEFAULT_PROMOTION_CHANNELS.every((c) => channels.includes(c))
  )
}

interface RestrictionToggleProps {
  id: string
  title: string
  description: string
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  children?: React.ReactNode
}

function RestrictionToggle({
  id,
  title,
  description,
  enabled,
  onEnabledChange,
  children,
}: RestrictionToggleProps) {
  return (
    <div className="rounded-lg border">
      <div className="flex flex-row items-center justify-between p-3">
        <div className="space-y-0.5 pr-4">
          <Label htmlFor={id} className="text-sm cursor-pointer">
            {title}
          </Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Switch
          id={id}
          checked={enabled}
          onCheckedChange={(v) => onEnabledChange(!!v)}
        />
      </div>
      {enabled && children && (
        <div className="border-t p-3 bg-muted/20 space-y-3">{children}</div>
      )}
    </div>
  )
}

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
}: PromotionChannelsFieldsProps) {
  const { t } = useLocalization()
  const [locations, setLocations] = useState<Location[]>([])
  const [loadingLocations, setLoadingLocations] = useState(false)

  const channels = normalizePromotionChannels(channelsProp)
  const locationIds = normalizePromotionLocationIds(locationIdsProp)
  const posEnabled = channels.includes("pos")

  const [channelsOn, setChannelsOn] = useState(!isFullChannelSet(channels))
  const [locationsOn, setLocationsOn] = useState(locationIds.length > 0)

  // Only auto-enable from data when channels are already restricted.
  // Do not force OFF when the full set is selected — user may have just
  // turned the restriction on to edit it.
  useEffect(() => {
    if (!isFullChannelSet(channels)) {
      setChannelsOn(true)
    }
  }, [channels])

  useEffect(() => {
    if (locationIds.length > 0) setLocationsOn(true)
  }, [locationIds.length])

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

  const setChannels = (next: PromotionChannel[]) => {
    const normalized =
      next.length > 0 ? next : [...DEFAULT_PROMOTION_CHANNELS]
    onChange({
      channels: normalized,
      location_ids: normalized.includes("pos") ? locationIds : [],
    })
  }

  const toggleChannel = (channel: PromotionChannel, enabled: boolean) => {
    let next = enabled
      ? Array.from(new Set([...channels, channel]))
      : channels.filter((c) => c !== channel)

    if (next.length === 0) {
      // Keep at least one channel while restriction is on
      next = [channel]
    }

    setChannels(next)
  }

  const toggleLocation = (locationId: string, enabled: boolean) => {
    const next = enabled
      ? Array.from(new Set([...locationIds, locationId]))
      : locationIds.filter((id) => id !== locationId)
    onChange({ channels, location_ids: next })
  }

  return (
    <div className="space-y-3">
      <RestrictionToggle
        id={`${idPrefix}-limit-channels`}
        title={t("promotions.detail.channels.limitTitle") || "Channels"}
        description={
          t("promotions.detail.channels.limitDescription") ||
          "Limit the promotion to specific sales channels"
        }
        enabled={channelsOn}
        onEnabledChange={(enabled) => {
          setChannelsOn(enabled)
          if (!enabled) {
            setLocationsOn(false)
            onChange({
              channels: [...DEFAULT_PROMOTION_CHANNELS],
              location_ids: [],
            })
          }
        }}
      >
        <div className="space-y-2">
          {CHANNEL_OPTIONS.map((option) => {
            const fieldId = `${idPrefix}-${option.id}`
            const checked = channels.includes(option.id)
            return (
              <div key={option.id} className="flex items-start space-x-2 py-1">
                <Checkbox
                  id={fieldId}
                  checked={checked}
                  onCheckedChange={(value) =>
                    toggleChannel(option.id, !!value)
                  }
                  className="mt-0.5"
                />
                <div className="space-y-0.5">
                  <label htmlFor={fieldId} className="text-sm cursor-pointer font-medium">
                    {t(option.labelKey) || option.labelFallback}
                  </label>
                  <p className="text-xs text-muted-foreground">
                    {t(option.descriptionKey) || option.descriptionFallback}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </RestrictionToggle>

      {posEnabled && (
        <RestrictionToggle
          id={`${idPrefix}-limit-locations`}
          title={
            t("promotions.detail.channels.locationsTitle") || "POS locations"
          }
          description={
            t("promotions.detail.channels.locationsDescription") ||
            "Limit the promotion to specific POS locations"
          }
          enabled={locationsOn}
          onEnabledChange={(enabled) => {
            setLocationsOn(enabled)
            if (!enabled) {
              onChange({ channels, location_ids: [] })
            }
          }}
        >
          <div className="max-h-[220px] overflow-y-auto space-y-2">
            <p className="text-xs text-muted-foreground">
              {t("promotions.detail.channels.locationsHint") ||
                "If none are selected, the promotion applies at every active location."}
            </p>
            {loadingLocations && (
              <div className="space-y-2 py-1">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-52" />
              </div>
            )}
            {!loadingLocations && locations.length === 0 && (
              <p className="text-sm text-muted-foreground italic">
                {t("promotions.detail.channels.noLocations") ||
                  "No locations found"}
              </p>
            )}
            {locations.map((loc) => {
              const locId = `${idPrefix}-loc-${loc.id}`
              return (
                <div key={loc.id} className="flex items-center space-x-2 py-1">
                  <Checkbox
                    id={locId}
                    checked={locationIds.includes(loc.id)}
                    onCheckedChange={(checked) =>
                      toggleLocation(loc.id, !!checked)
                    }
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
        </RestrictionToggle>
      )}
    </div>
  )
}
