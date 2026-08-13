"use client"

import React, { useState, useEffect } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSite } from "@/app/context/SiteContext"
import { useRouter } from "next/navigation"
import { getCatalogItem, upsertCatalogItem, deleteCatalogItem, listCatalogCategories } from "../actions"
import { CatalogItem, CatalogCategory } from "@/app/types"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Switch } from "@/app/components/ui/switch"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardDescription,
  SectionCardContent,
  SectionCardFooter,
} from "@/app/components/ui/section-card"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { EmptyCard } from "@/app/components/ui/empty-card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog"
import { toast } from "sonner"
import { ChevronLeft, Save, Trash2, Activity } from "@/app/components/ui/icons"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Textarea } from "@/app/components/ui/textarea"
import { ImageUpload } from "@/app/components/ui/image-upload"
import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { resolveRelationId } from "@/app/commerce/resolve-relation"
import { PlanItemsTab } from "../components/PlanItemsTab"
import { PassRedeemableItemsTab } from "../components/PassRedeemableItemsTab"
import { ProductTaxesCard } from "../components/ProductTaxesCard"
import { ProductDeliveryOptionsCard } from "../components/ProductDeliveryOptionsCard"
import { ProductDownloadableFilesCard } from "../components/ProductDownloadableFilesCard"
import { CatalogItemDetailsMarketingCard } from "../components/CatalogItemDetailsMarketingCard"
import { VariantsCard } from "../components/VariantsCard"
import { CatalogItemPricingSection } from "../components/CatalogItemPricingSection"
import { MarketplaceTab } from "../components/MarketplaceTab"
import { ChannelsTab } from "../components/ChannelsTab"
import { ModifiersTab } from "../components/ModifiersTab"

export default function CatalogItemDetail(props: { params: Promise<{ id: string }> }) {
  const params = React.use(props.params)
  const { t } = useLocalization()
  const { currentSite } = useSite()
  const router = useRouter()
  const [item, setItem] = useState<CatalogItem | null>(null)
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showArchiveDialog, setShowArchiveDialog] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [categoryValue, setCategoryValue] = useState<RelationSelectValue>(null)
  const [formData, setFormData] = useState<Partial<CatalogItem>>({
    is_pos_available: true,
    is_recurring: false,
    is_reservation: false,
    is_dynamic_price: false,
  })

  useEffect(() => {
    async function load() {
      if (currentSite) {
        const { data: cats } = await listCatalogCategories(currentSite.id)
        if (cats) setCategories(cats as CatalogCategory[])
      }

      if (params.id === 'new') {
        setLoading(false)
        return
      }

      const { data, error } = await getCatalogItem(params.id)
      if (error) {
        toast.error("Failed to load item")
      } else if (data) {
        setItem(data)
        setFormData(data)
        if (data.category_id) {
          setCategoryValue({ mode: "existing", id: data.category_id, label: data.category?.name || "Unknown Category" })
        }
      }
      setLoading(false)
    }
    load()
  }, [params.id, currentSite])

  useEffect(() => {
    if (categoryValue?.mode === "existing" && categoryValue.label === "Unknown Category") {
      const match = categories.find(c => c.id === categoryValue.id)
      if (match) setCategoryValue({ ...categoryValue, label: match.name })
    }
  }, [categories, categoryValue])

  const handleSave = async () => {
    if (!currentSite) return
    setSaving(true)

    try {
      const { id: resolvedCategoryId, error: catError } = await resolveRelationId("catalog_category", categoryValue, currentSite.id)
      if (catError) throw new Error(`Category error: ${catError}`)

      const { data, error } = await upsertCatalogItem({
        ...formData,
        category_id: resolvedCategoryId || undefined,
        site_id: currentSite.id,
        id: item?.id
      })
      
      if (error) {
        toast.error(error)
      } else {
        toast.success("Saved successfully")
        if (!item && data) {
          router.replace(`/catalog/${data.id}`)
        } else if (data) {
          setItem(data)
          setFormData(data)
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!currentSite || !item) return
    setArchiving(true)
    const { error } = await deleteCatalogItem(currentSite.id, item.id)
    if (error) {
      toast.error(error)
      setArchiving(false)
    } else {
      toast.success("Item archived")
      setShowArchiveDialog(false)
      router.push("/catalog")
    }
  }

  // Trigger breadcrumb update
  useEffect(() => {
    if (item) {
      const event = new CustomEvent('breadcrumb:update', {
        detail: {
          title: item.name,
          parent: {
            title: t('layout.sidebar.catalog') || 'Catalog',
            path: '/catalog'
          }
        }
      });
      window.dispatchEvent(event);
    }
  }, [item, t]);

  if (loading) {
    return <div className="p-8 space-y-4"><Skeleton className="h-10 w-1/3"/><Skeleton className="h-64 w-full"/></div>
  }

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))]">
      <Tabs defaultValue="details" className="flex-1 flex flex-col">
        <StickyHeader>
          <div className="w-full pt-0 flex justify-between items-center">
            <TabsList>
              <TabsTrigger value="details">{t('catalog.tabs.details') || 'Details'}</TabsTrigger>
              <TabsTrigger value="variants">{t('catalog.tabs.variants') || 'Variants'}</TabsTrigger>
              {item && formData.is_purchasable !== false && (
                <TabsTrigger value="modifiers">{t('catalog.tabs.modifiers') || 'Modifiers'}</TabsTrigger>
              )}
              <TabsTrigger value="delivery">{t('catalog.tabs.delivery') || 'Delivery'}</TabsTrigger>
              <TabsTrigger value="marketplace">{t('catalog.tabs.marketplace') || 'Marketplace'}</TabsTrigger>
              <TabsTrigger value="channels">{t('catalog.tabs.channels') || 'Channels'}</TabsTrigger>
              <TabsTrigger value="inventory">{t('catalog.tabs.inventory') || 'Inventory'}</TabsTrigger>
              <TabsTrigger value="sales">{t('catalog.tabs.sales') || 'Sales'}</TabsTrigger>
              {formData.is_recurring && (
                <TabsTrigger value="plan_items">{t('catalog.tabs.planItems') || 'Plan Items'}</TabsTrigger>
              )}
              {formData.kind === 'digital_asset' && formData.digital_subtype === 'pass' && (
                <TabsTrigger value="pass_items">{t('catalog.tabs.passItems') || 'Pass Services'}</TabsTrigger>
              )}
            </TabsList>
          </div>
        </StickyHeader>

        <div className="flex-1 overflow-auto">
          <TabsContent value="details" className="m-0 border-0 p-4 md:p-6 w-full focus-visible:outline-none">
            <div className="mx-auto max-w-[800px] space-y-6">
              <SectionCard>
                <SectionCardHeader>
                  <SectionCardTitle>{t('catalog.form.basicDetails') || 'Basic Details'}</SectionCardTitle>
                </SectionCardHeader>
                <SectionCardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t('catalog.form.image') || 'Image'}</Label>
                <ImageUpload 
                  value={formData.image_url || ''} 
                  onChange={val => setFormData({...formData, image_url: val})} 
                  onRemove={() => setFormData({...formData, image_url: undefined})} 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2 md:col-span-1">
                  <Label>{t('catalog.form.name') || 'Name'}</Label>
                  <Input 
                    value={formData.name || ''} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                  />
                </div>
                <div className="space-y-2 col-span-2 md:col-span-1">
                  <Label>{t('catalog.form.type') || 'Type'}</Label>
                  <Select 
                    value={formData.kind || 'product'} 
                    onValueChange={(val: any) => setFormData({...formData, kind: val, digital_subtype: val !== 'digital_asset' ? null : formData.digital_subtype})}
                  >
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="product">Product (Physical)</SelectItem>
                      <SelectItem value="service">Service</SelectItem>
                      <SelectItem value="digital_asset">Digital Asset</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.kind === 'digital_asset' && (
                  <div className="space-y-2 col-span-2 md:col-span-1">
                    <Label>{t('catalog.form.subtype') || 'Subtype'}</Label>
                    <Select 
                      value={formData.digital_subtype || 'file'} 
                      onValueChange={(val: any) => setFormData({...formData, digital_subtype: val})}
                    >
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="file">Digital File</SelectItem>
                        <SelectItem value="ticket">Ticket / Event</SelectItem>
                        <SelectItem value="course">Course</SelectItem>
                        <SelectItem value="pass">Redeemable Pass</SelectItem>
                        <SelectItem value="license">License</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2 col-span-2 md:col-span-1">
                  <Label>{t('catalog.form.category') || 'Category'}</Label>
                  <RelationSelect
                    value={categoryValue}
                    onValueChange={setCategoryValue}
                    options={categories.map(c => ({ id: c.id, label: c.name }))}
                    placeholder="Select or create category..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('catalog.form.description') || 'Description'}</Label>
                <Textarea 
                  value={formData.description || ''} 
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  rows={4} 
                />
              </div>
              
              <div className="space-y-2">
                <Label>{t('catalog.form.sku') || 'SKU'}</Label>
                <Input 
                  value={formData.sku || ''} 
                  onChange={e => setFormData({...formData, sku: e.target.value})} 
                  className="font-mono"
                  placeholder="Optional unique identifier"
                />
              </div>
                </SectionCardContent>
                <ActionFooter>
                  <Button variant="outline" type="button" onClick={handleSave} disabled={saving} size="sm">
                    {saving ? (t('common.saving') || 'Saving...') : (t('common.saveChanges') || 'Save Changes')}
                  </Button>
                </ActionFooter>
              </SectionCard>

              <CatalogItemPricingSection
                item={item}
                formData={formData}
                setFormData={setFormData}
                handleSave={handleSave}
                saving={saving}
              />

              <SectionCard>
                <SectionCardHeader>
                  <SectionCardTitle>{t('catalog.form.availabilityInventory') || 'Availability & Inventory'}</SectionCardTitle>
                </SectionCardHeader>
                <SectionCardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t('catalog.form.availabilityMode') || 'Availability Mode'}</Label>
                    <Select 
                      value={formData.availability_mode || 'always'} 
                      onValueChange={(val: any) => setFormData({...formData, availability_mode: val})}
                    >
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="always">{t('catalog.form.availability.always') || 'Always Available'}</SelectItem>
                        <SelectItem value="inventory">{t('catalog.form.availability.inventory') || 'Based on Inventory'}</SelectItem>
                        <SelectItem value="manual">{t('catalog.form.availability.manual') || 'Manual Status'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.availability_mode === 'manual' && (
                    <div className="space-y-2 pt-2 border-t">
                      <Label>{t('catalog.form.manualStatus') || 'Manual Status'}</Label>
                      <Select 
                        value={formData.availability_status || 'available'} 
                        onValueChange={(val: any) => setFormData({...formData, availability_status: val})}
                      >
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="available">{t('catalog.status.available') || 'Available'}</SelectItem>
                          <SelectItem value="unavailable">{t('catalog.status.unavailable') || 'Unavailable'}</SelectItem>
                          <SelectItem value="sold_out">{t('catalog.status.soldOut') || 'Sold Out'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-4 pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="track_inventory" className="text-base cursor-pointer">{t('catalog.form.trackInventory') || 'Track inventory levels'}</Label>
                        <p className="text-sm text-muted-foreground">{t('catalog.form.trackInventoryHint') || 'Keep counts per location'}</p>
                      </div>
                      <Switch 
                        id="track_inventory" 
                        checked={formData.track_inventory || false}
                        onCheckedChange={(checked) => setFormData({...formData, track_inventory: checked as boolean})}
                      />
                    </div>
                  </div>
                </SectionCardContent>
                <ActionFooter>
                  <Button variant="outline" onClick={handleSave} disabled={saving} size="sm">{saving ? (t('common.saving') || 'Saving...') : (t('common.saveChanges') || 'Save Changes')}</Button>
                </ActionFooter>
              </SectionCard>

              {item && <ProductTaxesCard catalogItemId={item.id} />}
              {item && (
                <CatalogItemDetailsMarketingCard
                  formData={formData}
                  setFormData={setFormData}
                  handleSave={handleSave}
                  saving={saving}
                />
              )}

              {item && (
                <SectionCard className="border-destructive/20 bg-destructive/5">
                  <SectionCardHeader>
                    <SectionCardTitle className="text-destructive">{t('catalog.form.dangerZone') || 'Danger Zone'}</SectionCardTitle>
                    <SectionCardDescription className="text-destructive/80">
                      {t('catalog.form.dangerDescription') || 'Irreversible actions for this product.'}
                    </SectionCardDescription>
                  </SectionCardHeader>
                  <SectionCardContent>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowArchiveDialog(true)}
                      className="gap-2"
                    >
                      <Trash2 size={16} /> {t('catalog.form.archive') || 'Archive Product'}
                    </Button>
                  </SectionCardContent>
                </SectionCard>
              )}
            </div>
          </TabsContent>

          <TabsContent value="variants" className="m-0 border-0 p-4 md:p-6 w-full focus-visible:outline-none">
            <div className="mx-auto max-w-[800px]">
              {item && (
                <VariantsCard 
                  item={item} 
                  onUpdate={(updated) => {
                    setItem({ ...item, ...updated });
                    setFormData({ ...formData, ...updated });
                  }} 
                />
              )}
            </div>
          </TabsContent>

          {item && formData.is_purchasable !== false && (
            <TabsContent value="modifiers" className="m-0 border-0 p-4 md:p-6 w-full focus-visible:outline-none">
              <div className="mx-auto max-w-[800px]">
                <ModifiersTab catalogItemId={item.id} />
              </div>
            </TabsContent>
          )}

          <TabsContent value="delivery" className="m-0 border-0 p-4 md:p-6 w-full focus-visible:outline-none">
            <div className="mx-auto max-w-[800px] space-y-6">
              {item && (
                <ProductDeliveryOptionsCard
                  formData={formData}
                  setFormData={setFormData}
                  handleSave={handleSave}
                  saving={saving}
                />
              )}
              {item && (
                <ProductDownloadableFilesCard item={item} />
              )}
            </div>
          </TabsContent>

          <TabsContent value="marketplace" className="m-0 border-0 p-4 md:p-6 w-full focus-visible:outline-none">
            <MarketplaceTab
              item={item}
              formData={formData}
              setFormData={setFormData}
              handleSave={handleSave}
              saving={saving}
            />
          </TabsContent>

          <TabsContent value="channels" className="m-0 border-0 p-4 md:p-6 w-full focus-visible:outline-none">
            <ChannelsTab
              item={item}
              formData={formData}
              setFormData={setFormData}
              handleSave={handleSave}
              saving={saving}
            />
          </TabsContent>

          {formData.is_recurring && (
            <TabsContent value="plan_items" className="m-0 border-0 p-4 md:p-6 w-full focus-visible:outline-none">
              <div className="mx-auto max-w-[800px]">
                <PlanItemsTab planItemId={item?.id || ''} isReservation={formData.is_reservation} />
              </div>
            </TabsContent>
          )}

          {formData.kind === 'digital_asset' && formData.digital_subtype === 'pass' && (
            <TabsContent value="pass_items" className="m-0 border-0 p-4 md:p-6 w-full focus-visible:outline-none">
              <div className="mx-auto max-w-[800px]">
                <PassRedeemableItemsTab passCatalogItemId={item?.id || ''} />
              </div>
            </TabsContent>
          )}

          <TabsContent value="inventory" className="m-0 border-0 p-4 md:p-6 w-full focus-visible:outline-none">
            <div className="mx-auto max-w-[800px]">
              <EmptyCard
                icon={<Activity className="h-12 w-12 text-muted-foreground/50" />}
                title={t('catalog.tabs.inventoryTracking') || "Inventory Tracking (Coming Soon)"}
                description={t('catalog.tabs.inventoryTrackingDesc') || "View stock levels and movement history across locations."}
              />
            </div>
          </TabsContent>

          <TabsContent value="sales" className="m-0 border-0 p-4 md:p-6 w-full focus-visible:outline-none">
            <div className="mx-auto max-w-[800px]">
              <EmptyCard
                icon={<Activity className="h-12 w-12 text-muted-foreground/50" />}
                title={t('catalog.tabs.salesHistory') || "Sales History (Coming Soon)"}
                description={t('catalog.tabs.salesHistoryDesc') || "Track revenue and units sold over time for this item."}
              />
            </div>
          </TabsContent>
        </div>
      </Tabs>

      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('catalog.form.archiveTitle') || 'Archive Product'}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('catalog.form.archiveConfirm', { name: item?.name || '' }) || `Are you sure you want to archive "${item?.name}"? This will hide it from the active catalog.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>{t('common.cancel') || 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={archiving}
              className="!bg-destructive !text-destructive-foreground hover:!bg-destructive/90"
            >
              {archiving ? (t('common.archiving') || "Archiving...") : (t('catalog.form.archive') || "Archive Product")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}