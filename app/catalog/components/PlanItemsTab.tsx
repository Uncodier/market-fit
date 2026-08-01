"use client"

import { useState, useEffect } from "react"
import { useSite } from "@/app/context/SiteContext"
import { getSubscriptionPlanItems, addSubscriptionPlanItem, removeSubscriptionPlanItem, listCatalogItems } from "../actions"
import { Button } from "@/app/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Trash2, PlusCircle, Package } from "@/app/components/ui/icons"
import { toast } from "sonner"
import { Skeleton } from "@/app/components/ui/skeleton"
import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { resolveRelationId } from "@/app/commerce/resolve-relation"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
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
import { EmptyCard } from "@/app/components/ui/empty-card"

export function PlanItemsTab({ planItemId, isReservation }: { planItemId: string, isReservation?: boolean }) {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const [items, setItems] = useState<any[]>([])
  const [availableDigitalAssets, setAvailableDigitalAssets] = useState<any[]>([])
  const [assetValue, setAssetValue] = useState<RelationSelectValue>(null)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const loadData = async () => {
    if (!currentSite) return
    setLoading(true)
    try {
      const [planRes, assetsRes] = await Promise.all([
        getSubscriptionPlanItems(planItemId),
        listCatalogItems({ siteId: currentSite.id, kind: 'digital_asset' })
      ])
      if (planRes.data) setItems(planRes.data)
      if (assetsRes.data) setAvailableDigitalAssets(assetsRes.data)
    } catch (error) {
      toast.error(t('catalog.planItems.errorLoading') || "Failed to load plan items")
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [planItemId, currentSite])

  const handleAdd = async () => {
    if (!currentSite || !assetValue) return
    setAdding(true)

    try {
      const { id: resolvedAssetId, error: resolveError } = await resolveRelationId(
        "catalog_item", 
        assetValue, 
        currentSite.id, 
        { kind: "digital_asset" }
      )
      
      if (resolveError) throw new Error(`Asset error: ${resolveError}`)
      if (!resolvedAssetId) throw new Error(t('catalog.planItems.errorAssetRequired') || "Digital asset is required")

      const { error } = await addSubscriptionPlanItem(currentSite.id, planItemId, resolvedAssetId)
      if (error) {
        toast.error(error)
      } else {
        toast.success(t('catalog.planItems.successAdded') || "Item added to plan")
        setAssetValue(null)
        setIsModalOpen(false)
        loadData()
      }
    } catch (err: any) {
      toast.error(err.message || t('catalog.planItems.errorAdding') || "Failed to add item")
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (id: string) => {
    const { error } = await removeSubscriptionPlanItem(id)
    if (error) {
      toast.error(error)
    } else {
      toast.success(t('catalog.planItems.successRemoved') || "Item removed from plan")
      loadData()
    }
  }

  if (loading) {
    return (
      <Card className="border dark:border-white/5 border-black/5 shadow-sm">
        <CardContent className="p-6 space-y-4">
          <Skeleton className="h-10 w-full"/>
          <Skeleton className="h-20 w-full"/>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card id="plan-items" className="border dark:border-white/5 border-black/5 shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardHeader className="px-6 md:px-8 py-6 flex flex-row items-center justify-between">
        <div className="space-y-2">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <Package className="h-5 w-5" /> {t('catalog.planItems.title') || 'Plan Items'}
          </CardTitle>
          {isReservation && !items.some(i => i.digital_catalog_item?.digital_subtype === 'pass') && (
            <div className="text-sm text-destructive font-medium flex items-center gap-2 mt-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              This plan requires a reservation, but has no pass attached. Add a pass to grant booking access.
            </div>
          )}
        </div>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <PlusCircle className="mr-2 h-4 w-4" /> {t('common.add') || 'Add Item'}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{t('catalog.planItems.addTitle') || 'Add Digital Asset to Plan'}</DialogTitle>
              <DialogDescription>
                {t('catalog.planItems.addDescription') || 'Select a digital asset to include in this plan.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t('catalog.planItems.digitalAsset') || 'Digital Asset'}</Label>
                <RelationSelect 
                  options={availableDigitalAssets
                    .filter(asset => !items.some(i => i.digital_catalog_item_id === asset.id))
                    .map(asset => ({ 
                      id: asset.id, 
                      label: `${asset.name} ${asset.digital_subtype ? `(${asset.digital_subtype})` : ''}` 
                    }))}
                  value={assetValue} 
                  onValueChange={setAssetValue}
                  placeholder={t('catalog.planItems.selectPlaceholder') || "Select a digital asset..."}
                  emptyMessage={t('catalog.planItems.emptyAssets') || "No available digital assets found"}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={adding}>
                {t('common.cancel') || 'Cancel'}
              </Button>
              <Button onClick={handleAdd} disabled={!assetValue || adding}>
                {adding ? (t('common.adding') || "Adding...") : (t('common.add') || 'Add Item')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent className="px-6 md:px-8 pb-8">
        {items.length > 0 ? (
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="px-6 py-4 text-sm font-semibold text-left">{t('catalog.planItems.table.name') || 'Name'}</th>
                  <th className="px-6 py-4 text-sm font-semibold text-left">{t('catalog.planItems.table.subtype') || 'Subtype'}</th>
                  <th className="px-6 py-4 text-sm font-semibold text-right w-24"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium">
                      {item.digital_catalog_item?.name || t('catalog.planItems.table.unknownItem') || 'Unknown Item'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className="text-xs px-2 py-1 bg-muted rounded-md capitalize">
                        {item.digital_catalog_item?.digital_subtype ? (t(`buyer.library.subtypes.${item.digital_catalog_item.digital_subtype.toLowerCase()}`) || item.digital_catalog_item.digital_subtype) : (t('buyer.library.digitalAsset') || 'Digital Asset')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleRemove(item.id)} className="text-destructive hover:bg-destructive/10">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyCard 
            icon={<Package className="h-10 w-10 text-muted-foreground" />}
            title={t('catalog.planItems.empty.title') || "No plan items"}
            description={t('catalog.planItems.empty.desc') || "Add digital assets that users will get access to when they subscribe to this plan."}
            className="border-0 shadow-none bg-transparent"
          />
        )}
      </CardContent>
    </Card>
  )
}
