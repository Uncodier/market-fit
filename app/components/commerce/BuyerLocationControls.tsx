"use client"

import type { Location } from "@/app/types"
import { BuyerLocationChip } from "./BuyerLocationChip"
import { BuyerLocationSheet } from "./BuyerLocationSheet"
import { useBuyerLocation } from "./use-buyer-location"

type BuyerLocationApi = ReturnType<typeof useBuyerLocation>

export function buyerLocationLeadingChip(
  location: BuyerLocationApi,
  className?: string,
  restricted = false
) {
  if (!location.showPill) return null
  return (
    <BuyerLocationChip
      label={location.label}
      onClick={() => location.setSheetOpen(true)}
      active={location.sheetOpen}
      restricted={restricted}
      className={className}
    />
  )
}

export function BuyerLocationSheetHost({
  location,
  stores,
}: {
  location: BuyerLocationApi
  stores?: Location[]
}) {
  return (
    <BuyerLocationSheet
      open={location.sheetOpen}
      onOpenChange={location.setSheetOpen}
      stores={stores}
      selectedLocationId={location.selectedLocationId}
      locating={location.locating}
      onSelectStore={stores && stores.length > 0 ? location.applyStore : undefined}
      onSelectPlace={location.applyPlace}
      onUseMyLocation={location.useMyLocation}
      searchPlaces={location.searchPlaces}
      showSearch
    />
  )
}
