"use client"

import React, { useState, useEffect } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSite } from "@/app/context/SiteContext"
import { useRouter } from "next/navigation"
import {
  getPromotion,
  upsertPromotion,
  listPromotionItems,
  setPromotionItems,
  deletePromotion,
  listPromotionCategories,
  setPromotionCategories,
  listPromotionRequiredItems,
  setPromotionRequiredItems,
  listPromotionRequiredCategories,
  setPromotionRequiredCategories,
} from "../actions"
import { PromotionWithCampaign } from "../types"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardDescription,
  SectionCardContent,
  SectionCardFooter,
} from "@/app/components/ui/section-card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { toast } from "sonner"
import { Trash2 } from "@/app/components/ui/icons"
import { Skeleton } from "@/app/components/ui/skeleton"
import { PromotionChannelsCard } from "../components/PromotionChannelsCard"
import { PromotionRestrictionsCard } from "../components/PromotionRestrictionsCard"
import { PromotionRulesCard } from "../components/PromotionRulesCard"
import {
  PromotionStatusBar,
  type PromotionStatus,
} from "../components/PromotionStatusBar"
import {
  normalizePromotionChannels,
  normalizePromotionLocationIds,
} from "../promotion-channels"
import { formatBogoLabel } from "../bogo-discount"
import { PromotionMerchandisingFields } from "../components/PromotionMerchandisingFields"
import { PromotionCurrencyField } from "../components/PromotionCurrencyField"
import { resolvePromotionCurrency } from "../promotion-currency"
import { PromotionPerformanceTab } from "../components/PromotionPerformanceTab"

export default function PromotionDetail(props: { params: Promise<{ id: string }> }) {
  const params = React.use(props.params)
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const router = useRouter()
  
  const [promo, setPromo] = useState<PromotionWithCampaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [requiredItems, setRequiredItems] = useState<
    { catalog_item_id: string; min_quantity: number; name?: string }[]
  >([])
  const [requiredCategories, setRequiredCategories] = useState<
    { catalog_category_id: string; min_quantity: number; name?: string }[]
  >([])

  const siteTimezone = currentSite?.settings?.business_hours?.[0]?.timezone || null

  useEffect(() => {
    async function load() {
      if (!currentSite) return
      const [{ data, error }, itemsRes, promoCatsRes, reqRes, reqCatsRes] =
        await Promise.all([
          getPromotion(params.id),
          listPromotionItems(params.id, currentSite.id),
          listPromotionCategories(params.id, currentSite.id),
          listPromotionRequiredItems(params.id, currentSite.id),
          listPromotionRequiredCategories(params.id, currentSite.id),
        ])
      
      if (error) {
        toast.error(t("promotions.detail.loadFailed") || "Failed to load promotion")
      } else if (data) {
        setPromo({
          ...data,
          channels: normalizePromotionChannels(data.channels),
          location_ids: normalizePromotionLocationIds(data.location_ids),
        })
      }
      if (itemsRes.data) setSelectedItemIds(itemsRes.data.map((i: any) => i.catalog_item_id))
      if (promoCatsRes.data) setSelectedCategoryIds(promoCatsRes.data.map((c: any) => c.catalog_category_id))
      if (reqRes.data) {
        setRequiredItems(
          reqRes.data.map((r: any) => ({
            catalog_item_id: r.catalog_item_id,
            min_quantity: r.min_quantity,
            name: r.catalog_item?.name,
          }))
        )
      }
      if (reqCatsRes.data) {
        setRequiredCategories(
          reqCatsRes.data.map((r: any) => ({
            catalog_category_id: r.catalog_category_id,
            min_quantity: r.min_quantity,
            name: r.catalog_category?.name,
          }))
        )
      }
        
      setLoading(false)
    }
    load()
  }, [params.id, currentSite, t])

  // Trigger breadcrumb update
  useEffect(() => {
    if (promo) {
      const event = new CustomEvent('breadcrumb:update', {
        detail: {
          title: promo.name,
          parent: {
            title: t('layout.sidebar.promotions') || 'Promotions',
            path: '/promotions'
          }
        }
      });
      window.dispatchEvent(event);
    }
  }, [promo, t]);

  const handleSave = async () => {
    if (!currentSite || !promo) return
    setSaving(true)

    const channels = normalizePromotionChannels(promo.channels)
    const location_ids = channels.includes("pos")
      ? normalizePromotionLocationIds(promo.location_ids)
      : []

    // Save basic — strip joined relation before upsert
    const { campaigns: _campaigns, ...promoRow } = promo
    const { error: promoError } = await upsertPromotion({
      ...promoRow,
      channels,
      location_ids,
    })
    if (promoError) toast.error(promoError)
    
    // Save items/categories if applicable
    if (promo.applies_to === 'selected_items') {
      if (selectedItemIds.length === 0 && selectedCategoryIds.length === 0) {
        toast.error(
          t("promotions.detail.selectTargets") ||
            "Select at least one product or category",
        )
        setSaving(false)
        return
      }
      const { error: itemsError } = await setPromotionItems(promo.id, currentSite.id, selectedItemIds)
      if (itemsError) toast.error(itemsError)
      
      const { error: catsError } = await setPromotionCategories(promo.id, currentSite.id, selectedCategoryIds)
      if (catsError) toast.error(catsError)
    }

    const { error: reqError } = await setPromotionRequiredItems(
      promo.id,
      currentSite.id,
      requiredItems
    )
    if (reqError) toast.error(reqError)

    const { error: reqCatsError } = await setPromotionRequiredCategories(
      promo.id,
      currentSite.id,
      requiredCategories
    )
    if (reqCatsError) toast.error(reqCatsError)
    
    if (!promoError) {
      toast.success(t("promotions.detail.saved") || "Saved successfully")
    }
    setSaving(false)
  }

  const handleStatusChange = async (status: PromotionStatus) => {
    if (!promo || updatingStatus) return
    setUpdatingStatus(true)
    const previous = promo.status
    setPromo({ ...promo, status })

    const { campaigns: _campaigns, ...promoRow } = { ...promo, status }
    const { error } = await upsertPromotion(promoRow)
    if (error) {
      setPromo((current) => (current ? { ...current, status: previous } : current))
      toast.error(error)
    } else {
      toast.success(t("promotions.detail.statusUpdated") || "Status updated")
    }
    setUpdatingStatus(false)
  }

  const handleDelete = async () => {
    if (!promo) return
    if (
      !confirm(
        t("promotions.detail.confirmDelete") ||
          "Are you sure you want to delete this promotion?",
      )
    ) {
      return
    }
    
    const { error } = await deletePromotion(promo.id)
    if (error) {
      toast.error(error)
    } else {
      toast.success(t("promotions.detail.deleted") || "Promotion deleted")
      router.push("/promotions")
    }
  }

  if (loading) return <div className="p-8 space-y-4"><Skeleton className="h-10 w-1/3"/><Skeleton className="h-64 w-full"/></div>
  if (!promo) {
    return (
      <div className="p-8">
        {t("promotions.detail.notFound") || "Promotion not found"}
      </div>
    )
  }

  const bogoLabel = formatBogoLabel(promo.bogo_buy_qty, promo.bogo_get_qty, t)
  const saveLabel = saving
    ? t("promotions.detail.saving") || "Saving..."
    : t("promotions.detail.saveChanges") || "Save Changes"

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <Tabs defaultValue="details" className="flex-1 flex flex-col">
        <StickyHeader>
          <div className="w-full pt-0 flex justify-between items-center">
            <TabsList>
              <TabsTrigger value="details">
                {t("promotions.detail.tabs.details") || "Details"}
              </TabsTrigger>
              <TabsTrigger value="performance">
                {t("promotions.detail.tabs.performance") || "Performance"}
              </TabsTrigger>
            </TabsList>
            <PromotionStatusBar
              currentStatus={promo.status}
              onStatusChange={handleStatusChange}
              disabled={updatingStatus}
            />
          </div>
        </StickyHeader>

        <div className="flex-1 p-4 md:p-6 overflow-auto">
          <TabsContent value="details" className="m-0 border-0 p-0">
            <div className="mx-auto max-w-[800px] space-y-6">
              <SectionCard>
            <SectionCardHeader>
              <SectionCardTitle>
                {t("promotions.detail.configuration") || "Configuration"}
              </SectionCardTitle>
            </SectionCardHeader>
            <SectionCardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t("promotions.detail.name") || "Name"}</Label>
                  <Input id="name" value={promo.name} onChange={e => setPromo({...promo, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>
                    {t("promotions.detail.couponCode") || "Coupon Code (Optional)"}
                  </Label>
                  <Input value={promo.code || ''} onChange={e => setPromo({...promo, code: e.target.value})} className="uppercase" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>
                    {t("promotions.detail.discountType") || "Discount Type"}
                  </Label>
                  <Select value={promo.discount_type} onValueChange={(v: any) => setPromo({...promo, discount_type: v})}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">
                        {t("promotions.detail.discountType.percent") || "Percentage (%)"}
                      </SelectItem>
                      <SelectItem value="fixed">
                        {t("promotions.detail.discountType.fixed") || "Fixed ($)"}
                      </SelectItem>
                      <SelectItem value="bogo">
                        {t("promotions.detail.discountType.bogo") || "Buy X Get Y"}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {promo.discount_type !== "bogo" ? (
                  <div className="space-y-2">
                    <Label>{t("promotions.detail.value") || "Value"}</Label>
                    <Input type="number" value={promo.discount_value} onChange={e => setPromo({...promo, discount_value: parseFloat(e.target.value) || 0})} />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>{t("promotions.detail.preview") || "Preview"}</Label>
                    <div className="flex h-10 items-center rounded-md border px-3 text-sm text-muted-foreground">
                      {t("promotions.detail.bogoPreviewHint", { label: bogoLabel }) ||
                        `${bogoLabel} (cheapest unit free)`}
                    </div>
                  </div>
                )}
              </div>

              {promo.discount_type === "bogo" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>
                      {t("promotions.detail.buyQty") || "Buy quantity"}
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={promo.bogo_buy_qty ?? 1}
                      onChange={(e) =>
                        setPromo({
                          ...promo,
                          bogo_buy_qty: Math.max(1, parseInt(e.target.value, 10) || 1),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      {t("promotions.detail.getFree") || "Get free"}
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={promo.bogo_get_qty ?? 1}
                      onChange={(e) =>
                        setPromo({
                          ...promo,
                          bogo_get_qty: Math.max(1, parseInt(e.target.value, 10) || 1),
                        })
                      }
                    />
                  </div>
                </div>
              )}

              <PromotionCurrencyField
                value={resolvePromotionCurrency(
                  promo,
                  currentSite?.settings?.currency,
                )}
                onChange={(currency) => setPromo({ ...promo, currency })}
              />

              <div className="pt-4 border-t">
                <PromotionMerchandisingFields
                  value={{
                    image_url: promo.image_url,
                    show_on_shop: promo.show_on_shop,
                    show_on_marketplace: promo.show_on_marketplace,
                  }}
                  onChange={(patch) =>
                    setPromo((current) =>
                      current ? { ...current, ...patch } : current,
                    )
                  }
                  name={promo.name}
                  discount_type={promo.discount_type}
                  discount_value={promo.discount_value}
                  bogo_buy_qty={promo.bogo_buy_qty}
                  bogo_get_qty={promo.bogo_get_qty}
                  siteName={currentSite?.name}
                />
              </div>
            </SectionCardContent>
            <ActionFooter>
              <Button variant="outline" type="button" onClick={handleSave} disabled={saving} size="sm">
                {saveLabel}
              </Button>
            </ActionFooter>
          </SectionCard>

          {currentSite && (
            <PromotionChannelsCard
              siteId={currentSite.id}
              promo={promo}
              onChange={(patch) => setPromo({ ...promo, ...patch })}
              onSave={handleSave}
              saving={saving}
            />
          )}

          {currentSite && (
            <PromotionRestrictionsCard
              siteId={currentSite.id}
              promo={promo}
              onChange={(patch) => setPromo({ ...promo, ...patch })}
              onSave={handleSave}
              saving={saving}
              siteTimezone={siteTimezone}
              requiredItems={requiredItems}
              onRequiredItemsChange={setRequiredItems}
              requiredCategories={requiredCategories}
              onRequiredCategoriesChange={setRequiredCategories}
            />
          )}

          {currentSite && (
            <PromotionRulesCard
              siteId={currentSite.id}
              promo={promo}
              onChange={(patch) => setPromo({ ...promo, ...patch })}
              onSave={handleSave}
              saving={saving}
              selectedItemIds={selectedItemIds}
              selectedCategoryIds={selectedCategoryIds}
              onItemsChange={setSelectedItemIds}
              onCategoriesChange={setSelectedCategoryIds}
            />
          )}

          <div className="rounded-lg border-destructive/50 border bg-destructive/5 p-6">
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-semibold text-destructive mb-1">
                  {t("promotions.detail.dangerZone") || "Danger Zone"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t("promotions.detail.irreversible") ||
                    "Actions in this section cannot be undone"}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium mb-1">
                    {t("promotions.detail.deleteTitle") || "Delete Promotion"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("promotions.detail.deleteDescription") ||
                      "Permanently delete this promotion"}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  type="button"
                  onClick={handleDelete}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("promotions.detail.delete") || "Delete Promotion"}
                </Button>
              </div>
            </div>
          </div>
        </div>
        </TabsContent>

        <TabsContent value="performance" className="m-0 border-0 p-0 h-full flex flex-col">
          <div className="flex-1 p-4 md:p-6">
            {currentSite && (
              <PromotionPerformanceTab
                siteId={currentSite.id}
                promotionId={promo.id}
                usageCount={promo.usage_count}
                usageLimit={promo.usage_limit}
                currency={resolvePromotionCurrency(
                  promo,
                  currentSite?.settings?.currency,
                )}
              />
            )}
          </div>
        </TabsContent>
      </div>
      </Tabs>
    </div>
  )
}
