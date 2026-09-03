"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import {
  listLocations,
  listInventoryLevels,
  setInventoryLevel,
} from "@/app/inventory/actions"
import { InventoryLevelWithCatalog } from "@/app/inventory/types"
import { Location } from "@/app/types"
import { Button } from "@/app/components/ui/button"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardContent,
} from "@/app/components/ui/section-card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/ui/dialog"
import { Label } from "@/app/components/ui/label"
import { Input } from "@/app/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { PlusCircle, DatabaseIcon } from "@/app/components/ui/icons"
import { toast } from "sonner"

function parseStockQuantity(value: string): number | null {
  const qty = parseInt(value, 10)
  if (Number.isNaN(qty) || qty < 0) return null
  return qty
}

export function ProductInventoryCard({ catalogItemId }: { catalogItemId: string }) {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  
  const [locations, setLocations] = useState<Location[]>([])
  const [levels, setLevels] = useState<InventoryLevelWithCatalog[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const [selectedLocation, setSelectedLocation] = useState("")
  const [quantity, setQuantity] = useState("1")

  const loadData = async () => {
    if (!currentSite || !catalogItemId) return
    setLoading(true)
    try {
      const [locationsRes, levelsRes] = await Promise.all([
        listLocations(currentSite.id),
        listInventoryLevels({ siteId: currentSite.id, catalogItemId, pageSize: 1000 }),
      ])
      
      if (locationsRes.error) throw new Error(locationsRes.error)
      if (levelsRes.error) throw new Error(levelsRes.error)
      
      setLocations(locationsRes.data || [])
      setLevels(levelsRes.data || [])
    } catch {
      toast.error(t("inventory.error.load") || "Error loading inventory")
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [catalogItemId, currentSite?.id])

  const resetDialog = () => {
    setSelectedLocation("")
    setQuantity("1")
  }

  const handleAddStock = async () => {
    if (!currentSite) return
    if (!selectedLocation) {
      toast.error(t("inventory.selectLocationError") || "Please select a location")
      return
    }

    const qtyNum = parseStockQuantity(quantity)
    if (qtyNum == null) {
      toast.error(t("inventory.invalidQuantity") || "Invalid quantity")
      return
    }

    setAdding(true)
    try {
      const res = await setInventoryLevel(currentSite.id, selectedLocation, catalogItemId, qtyNum)
      if (res.error) throw new Error(res.error)
      
      toast.success(t("inventory.stockAdded") || "Stock added successfully")
      resetDialog()
      setIsModalOpen(false)
      loadData()
    } catch (err: any) {
      toast.error(err.message || t("inventory.toast.updateFailed") || "Failed to update stock")
    } finally {
      setAdding(false)
    }
  }

  const handleUpdateQuantity = async (level: InventoryLevelWithCatalog, newQtyStr: string) => {
    if (!currentSite) return
    const qty = parseStockQuantity(newQtyStr)
    if (qty == null) {
      toast.error(t("inventory.invalidQuantity") || "Invalid quantity")
      return
    }

    const promise = setInventoryLevel(currentSite.id, level.location_id, catalogItemId, qty)
    toast.promise(promise, {
      loading: t("inventory.toast.updating") || "Updating stock...",
      success: t("inventory.toast.updated") || "Stock updated",
      error: t("inventory.toast.updateFailed") || "Failed to update stock",
    })
    
    await promise
    loadData()
  }

  if (loading) {
    return (
      <SectionCard>
        <SectionCardContent className="pt-6 space-y-4">
          <div className="h-10 bg-muted/50 rounded animate-pulse" />
          <div className="h-20 bg-muted/50 rounded animate-pulse" />
        </SectionCardContent>
      </SectionCard>
    )
  }

  const configuredLocationIds = new Set(levels.map((l) => l.location_id))
  const availableLocations = locations.filter((loc) => !configuredLocationIds.has(loc.id))

  return (
    <SectionCard>
      <SectionCardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <SectionCardTitle className="flex items-center gap-2">
            <DatabaseIcon className="h-5 w-5" />
            {t("catalog.inventory.title") || "Inventory"}
          </SectionCardTitle>
          <p className="text-xs text-muted-foreground">
            {t("catalog.tabs.inventoryTrackingDesc") || "View and update stock levels across locations."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isModalOpen} onOpenChange={(open) => {
            setIsModalOpen(open)
            if (!open) resetDialog()
          }}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <PlusCircle className="mr-2 h-4 w-4" />
                {t("inventory.addStock") || "Add Stock"}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>
                  {t("inventory.addStock") || "Add Stock"}
                </DialogTitle>
                <DialogDescription>
                  {t("catalog.inventory.addDescription") || "Set the current stock quantity for this product at a specific location."}
                </DialogDescription>
              </DialogHeader>
              
              {locations.length === 0 ? (
                <div className="py-6 text-center space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {t("inventory.locations.empty.description") || "Add a physical location to manage stock per store or warehouse."}
                  </p>
                  <Button asChild variant="outline">
                    <Link href="/inventory">{t("inventory.locations.add") || "Add Location"}</Link>
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>{t("inventory.location") || "Location"}</Label>
                      <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                        <SelectTrigger>
                          <SelectValue placeholder={t("inventory.selectLocation") || "Select a location"} />
                        </SelectTrigger>
                        <SelectContent>
                          {availableLocations.length > 0 ? (
                            availableLocations.map(loc => (
                              <SelectItem key={loc.id} value={loc.id}>
                                {loc.name}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="none" disabled>
                              {t("catalog.inventory.allLocationsConfigured") || "All locations are configured"}
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("inventory.quantity") || "Quantity"}</Label>
                      <Input 
                        type="number" 
                        value={quantity} 
                        onChange={e => setQuantity(e.target.value)} 
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsModalOpen(false)}
                      disabled={adding}
                    >
                      {t("common.cancel") || "Cancel"}
                    </Button>
                    <Button
                      onClick={handleAddStock}
                      disabled={!selectedLocation || selectedLocation === "none" || adding}
                    >
                      {adding
                        ? t("common.saving") || "Saving..."
                        : t("common.save") || "Save"}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </SectionCardHeader>
      <SectionCardContent>
        {levels.length > 0 ? (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="px-4 py-3 text-sm font-semibold text-left">
                    {t("inventory.levels.location") || "Location"}
                  </th>
                  <th className="px-4 py-3 text-sm font-semibold text-right">
                    {t("inventory.levels.quantity") || "Quantity"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {levels.map((level) => {
                  const loc = locations.find((l) => l.id === level.location_id)
                  return (
                    <tr key={level.id} className="border-b last:border-0">
                      <td className="px-4 py-3 text-sm font-medium">
                        {loc?.name || t("inventory.levels.unknown") || "Unknown location"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Input
                          type="number"
                          defaultValue={level.quantity}
                          onBlur={(e) => {
                            if (e.target.value !== String(level.quantity)) {
                              handleUpdateQuantity(level, e.target.value)
                            }
                          }}
                          className="h-8 w-24 ml-auto text-right text-[15px] font-semibold tabular-nums tracking-tight"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyCard
            icon={<DatabaseIcon className="h-10 w-10 text-muted-foreground" />}
            title={t("catalog.inventory.emptyTitle") || "No stock levels"}
            description={
              t("catalog.inventory.emptyDescription") ||
              "Add stock at a location to start tracking this item."
            }
            className="border-0 shadow-none bg-transparent"
          />
        )}
      </SectionCardContent>
    </SectionCard>
  )
}
