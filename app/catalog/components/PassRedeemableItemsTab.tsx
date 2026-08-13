"use client"

import { useState, useEffect } from "react"
import { useSite } from "@/app/context/SiteContext"
import { getPassRedeemableItems, updatePassRedeemableItems } from "../pass-actions"
import { listCatalogItems } from "../actions"
import { Button } from "@/app/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Trash2, PlusCircle, Calendar } from "@/app/components/ui/icons"
import { toast } from "sonner"
import { Skeleton } from "@/app/components/ui/skeleton"
import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { resolveRelationId } from "@/app/commerce/resolve-relation"
import { useLocalization } from "@/app/context/LocalizationContext"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardDescription,
  SectionCardContent,
  SectionCardFooter,
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
import { EmptyCard } from "@/app/components/ui/empty-card"

export function PassRedeemableItemsTab({ passCatalogItemId }: { passCatalogItemId: string }) {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const [redeemableIds, setRedeemableIds] = useState<string[]>([])
  const [availableServices, setAvailableServices] = useState<any[]>([])
  const [serviceValue, setServiceValue] = useState<RelationSelectValue>(null)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const loadData = async () => {
    if (!currentSite) return
    setLoading(true)
    try {
      const [idsRes, servicesRes] = await Promise.all([
        getPassRedeemableItems(passCatalogItemId),
        listCatalogItems({ siteId: currentSite.id, isReservation: true })
      ])
      setRedeemableIds(idsRes || [])
      if (servicesRes.data) setAvailableServices(servicesRes.data)
    } catch (error) {
      toast.error(t('catalog.passItems.errorLoading') || "Failed to load pass items")
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [passCatalogItemId, currentSite])

  const handleAdd = async () => {
    if (!currentSite || !serviceValue) return
    setAdding(true)

    try {
      const { id: resolvedServiceId, error: resolveError } = await resolveRelationId(
        "catalog_item", 
        serviceValue, 
        currentSite.id, 
        { is_reservation: true }
      )
      
      if (resolveError) throw new Error(`Service error: ${resolveError}`)
      if (!resolvedServiceId) throw new Error(t('catalog.passItems.errorServiceRequired') || "Service is required")

      const newIds = [...redeemableIds, resolvedServiceId]
      const { error } = await updatePassRedeemableItems(currentSite.id, passCatalogItemId, newIds)
      
      if (error) {
        toast.error(error.message)
      } else {
        toast.success(t('catalog.passItems.successAdded') || "Service added to pass")
        setServiceValue(null)
        setIsModalOpen(false)
        loadData()
      }
    } catch (err: any) {
      toast.error(err.message || t('catalog.passItems.errorAdding') || "Failed to add service")
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (id: string) => {
    if (!currentSite) return
    const newIds = redeemableIds.filter(rid => rid !== id)
    try {
      const { error } = await updatePassRedeemableItems(currentSite.id, passCatalogItemId, newIds)
      if (error) {
        toast.error(error.message)
      } else {
        toast.success(t('catalog.passItems.successRemoved') || "Service removed from pass")
        loadData()
      }
    } catch(err: any) {
       toast.error(err.message)
    }
  }

  if (loading) {
    return (
      <SectionCard className="border dark:border-white/5 border-black/5 shadow-sm">
        <SectionCardContent className="p-6 space-y-4">
          <Skeleton className="h-10 w-full"/>
          <Skeleton className="h-20 w-full"/>
        </SectionCardContent>
      </SectionCard>
    )
  }

  const currentItems = availableServices.filter(s => redeemableIds.includes(s.id))

  return (
    <SectionCard id="pass-items">
      <SectionCardHeader className="flex flex-row items-center justify-between">
        <SectionCardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" /> {t('catalog.passItems.title') || 'Pass Services'}
        </SectionCardTitle>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <PlusCircle className="mr-2 h-4 w-4" /> {t('common.add') || 'Add Service'}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{t('catalog.passItems.addTitle') || 'Add Reservable Service to Pass'}</DialogTitle>
              <DialogDescription>
                {t('catalog.passItems.addDescription') || 'Select a reservable item (a plan or a service) that this pass will grant access to. The default for memberships is to link the plan itself; add external services only to share capacity or offer multiple bookable resources.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t('catalog.passItems.service') || 'Service'}</Label>
                <RelationSelect 
                  options={availableServices
                    .filter(service => !redeemableIds.includes(service.id))
                    .map(service => ({ 
                      id: service.id, 
                      label: service.name
                    }))}
                  value={serviceValue} 
                  onValueChange={setServiceValue}
                  placeholder={t('catalog.passItems.selectPlaceholder') || "Select a service..."}
                  emptyMessage={t('catalog.passItems.emptyServices') || "No available reservable services found"}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={adding}>
                {t('common.cancel') || 'Cancel'}
              </Button>
              <Button onClick={handleAdd} disabled={!serviceValue || adding}>
                {adding ? (t('common.adding') || "Adding...") : (t('common.add') || 'Add Service')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SectionCardHeader>

      <SectionCardContent>
        {currentItems.length > 0 ? (
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="px-6 py-4 text-sm font-semibold text-left">{t('catalog.passItems.table.name') || 'Name'}</th>
                  <th className="px-6 py-4 text-sm font-semibold text-right w-24"></th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map((item) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium">
                      {item.name}
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
            icon={<Calendar className="h-10 w-10 text-destructive/70" />}
            title={t('catalog.passItems.emptyTitle') || "No services linked"}
            description={t('catalog.passItems.emptyDescription') || "This pass cannot be redeemed for anything yet. Link the reservable plan or service it grants access to."}
            className="border-0 shadow-none bg-transparent"
          />
        )}
      </SectionCardContent>
    </SectionCard>
  )
}
