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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card"
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
import { COMMON_CURRENCIES } from "@/app/lib/currencies"
import { resolveRelationId } from "@/app/commerce/resolve-relation"
import { PlanItemsTab } from "../components/PlanItemsTab"
import { PassRedeemableItemsTab } from "../components/PassRedeemableItemsTab"
import { ProductTaxesCard } from "../components/ProductTaxesCard"
import { ProductDeliveryOptionsCard } from "../components/ProductDeliveryOptionsCard"
import { ProductPaymentOptionsCard } from "../components/ProductPaymentOptionsCard"
import { ProductDownloadableFilesCard } from "../components/ProductDownloadableFilesCard"
import { ReservationScheduleCard } from "../components/ReservationScheduleCard"
import { CatalogItemDetailsMarketingCard } from "../components/CatalogItemDetailsMarketingCard"
import { VariantsCard } from "../components/VariantsCard"
import { ItemSpecsEditor } from "../components/ItemSpecsEditor"

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
    is_reservation: false
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
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <Tabs defaultValue="details" className="flex-1 flex flex-col">
        <StickyHeader>
          <div className="w-full pt-0 flex justify-between items-center">
            <TabsList>
              <TabsTrigger value="details">{t('catalog.tabs.details') || 'Details'}</TabsTrigger>
              <TabsTrigger value="variants">{t('catalog.tabs.variants') || 'Variants'}</TabsTrigger>
              <TabsTrigger value="delivery">{t('catalog.tabs.delivery') || 'Delivery'}</TabsTrigger>
              <TabsTrigger value="marketplace">{t('catalog.tabs.marketplace') || 'Marketplace'}</TabsTrigger>
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
              <Card>
                <CardHeader>
                  <CardTitle>Basic Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Image</Label>
                <ImageUpload 
                  value={formData.image_url || ''} 
                  onChange={val => setFormData({...formData, image_url: val})} 
                  onRemove={() => setFormData({...formData, image_url: undefined})} 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2 md:col-span-1">
                  <Label>Name</Label>
                  <Input 
                    value={formData.name || ''} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                  />
                </div>
                <div className="space-y-2 col-span-2 md:col-span-1">
                  <Label>Type</Label>
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
                    <Label>Subtype</Label>
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
                  <Label>Category</Label>
                  <RelationSelect
                    value={categoryValue}
                    onValueChange={setCategoryValue}
                    options={categories.map(c => ({ id: c.id, label: c.name }))}
                    placeholder="Select or create category..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea 
                  value={formData.description || ''} 
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  rows={4} 
                />
              </div>
              
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input 
                  value={formData.sku || ''} 
                  onChange={e => setFormData({...formData, sku: e.target.value})} 
                  className="font-mono"
                  placeholder="Optional unique identifier"
                />
              </div>
                </CardContent>
                <ActionFooter>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => router.push('/catalog')}>
                      Cancel
                    </Button>
                    <Button type="button" onClick={handleSave} disabled={saving} className="gap-2">
                      <Save size={16} /> Save Changes
                    </Button>
                  </div>
                </ActionFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Pricing</CardTitle>
                  <CardDescription>Default pricing (can be overridden by Price Lists)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Sale Price</Label>
                      <Input 
                        type="number" 
                        step="0.01"
                        value={formData.target_sale_price || ''} 
                        onChange={e => setFormData({...formData, target_sale_price: parseFloat(e.target.value) || undefined})} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cost</Label>
                      <Input 
                        type="number" 
                        step="0.01"
                        value={formData.cost || ''} 
                        onChange={e => setFormData({...formData, cost: parseFloat(e.target.value) || undefined})} 
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label>Currency</Label>
                      <Select
                        value={formData.currency || 'USD'}
                        onValueChange={(val) => setFormData({...formData, currency: val})}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {COMMON_CURRENCIES.map(c => (
                            <SelectItem key={c.code} value={c.code}>{c.code} - {c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
                <ActionFooter>
                  <Button variant="outline" onClick={handleSave} disabled={saving}>Save Pricing</Button>
                </ActionFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Availability & Inventory</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Availability Mode</Label>
                    <Select 
                      value={formData.availability_mode || 'always'} 
                      onValueChange={(val: any) => setFormData({...formData, availability_mode: val})}
                    >
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="always">Always Available</SelectItem>
                        <SelectItem value="inventory">Based on Inventory</SelectItem>
                        <SelectItem value="manual">Manual Status</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.availability_mode === 'manual' && (
                    <div className="space-y-2 pt-2 border-t">
                      <Label>Manual Status</Label>
                      <Select 
                        value={formData.availability_status || 'available'} 
                        onValueChange={(val: any) => setFormData({...formData, availability_status: val})}
                      >
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="available">Available</SelectItem>
                          <SelectItem value="unavailable">Unavailable</SelectItem>
                          <SelectItem value="sold_out">Sold Out</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-4 pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="track_inventory" className="text-base cursor-pointer">Track inventory levels</Label>
                        <p className="text-sm text-muted-foreground">Keep counts per location</p>
                      </div>
                      <Switch 
                        id="track_inventory" 
                        checked={formData.track_inventory || false}
                        onCheckedChange={(checked) => setFormData({...formData, track_inventory: checked as boolean})}
                      />
                    </div>
                  </div>
                </CardContent>
                <ActionFooter>
                  <Button variant="outline" onClick={handleSave} disabled={saving}>Save Settings</Button>
                </ActionFooter>
              </Card>

              {item && <ProductTaxesCard catalogItemId={item.id} />}
              {item && (
                <CatalogItemDetailsMarketingCard
                  formData={formData}
                  setFormData={setFormData}
                  handleSave={handleSave}
                  saving={saving}
                />
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
            <div className="mx-auto max-w-[800px] space-y-6">
              {item && (
                <ProductPaymentOptionsCard
                  formData={formData}
                  setFormData={setFormData}
                />
              )}

              {item && (
                <ItemSpecsEditor
                  catalogItemId={item.id}
                  item={item}
                  handleSave={handleSave}
                  saving={saving}
                />
              )}

              {item && (
                <Card className="border-destructive/20 bg-destructive/5">
                  <CardHeader>
                    <CardTitle className="text-destructive">Danger Zone</CardTitle>
                    <CardDescription className="text-destructive/80">
                      Irreversible actions for this product.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowArchiveDialog(true)}
                      className="gap-2"
                    >
                      <Trash2 size={16} /> Archive Product
                    </Button>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Marketplace Listing</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="is_marketplace_listed" className="text-base cursor-pointer">List in Marketplace</Label>
                      <p className="text-sm text-muted-foreground">Make visible on the public marketplace</p>
                    </div>
                    <Switch 
                      id="is_marketplace_listed" 
                      checked={formData.is_marketplace_listed ?? true}
                      onCheckedChange={(checked) => setFormData({...formData, is_marketplace_listed: checked as boolean})}
                    />
                  </div>
                </CardContent>
                <ActionFooter>
                  <Button variant="outline" onClick={handleSave} disabled={saving}>Save Listing</Button>
                </ActionFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Channels & Behavior</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="is_pos_available" className="text-base cursor-pointer">Available in POS</Label>
                      <p className="text-sm text-muted-foreground">Show in Point of Sale screens</p>
                    </div>
                    <Switch 
                      id="is_pos_available" 
                      checked={formData.is_pos_available ?? true}
                      onCheckedChange={(checked) => setFormData({...formData, is_pos_available: checked as boolean})}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div>
                      <Label htmlFor="is_recurring" className="text-base cursor-pointer">Recurring Subscription</Label>
                      <p className="text-sm text-muted-foreground">Billed on a schedule instead of one-time</p>
                    </div>
                    <Switch 
                      id="is_recurring" 
                      checked={formData.is_recurring || false}
                      onCheckedChange={(checked) => setFormData({...formData, is_recurring: checked as boolean})}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div>
                      <Label htmlFor="is_reservation" className="text-base cursor-pointer">Requires Reservation</Label>
                      <p className="text-sm text-muted-foreground">Customer must book a time slot</p>
                    </div>
                    <Switch 
                      id="is_reservation" 
                      checked={formData.is_reservation || false}
                      onCheckedChange={(checked) => setFormData({...formData, is_reservation: checked as boolean})}
                    />
                  </div>

                  {formData.kind === 'digital_asset' && formData.digital_subtype === 'pass' && (
                    <div className="pt-4 border-t space-y-4">
                      <div className="space-y-2">
                        <Label>Total Uses (Empty = Unlimited)</Label>
                        <Input 
                          type="number" 
                          value={formData.pass_uses || ''} 
                          onChange={e => setFormData({...formData, pass_uses: e.target.value ? parseInt(e.target.value) : null})} 
                          placeholder="e.g. 10 sessions"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Validity Days (Empty = Never expires)</Label>
                        <Input 
                          type="number" 
                          value={formData.pass_validity_days || ''} 
                          onChange={e => setFormData({...formData, pass_validity_days: e.target.value ? parseInt(e.target.value) : null})} 
                          placeholder="e.g. 30 days"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
                <ActionFooter>
                  <Button variant="outline" onClick={handleSave} disabled={saving}>Save Behaviors</Button>
                </ActionFooter>
              </Card>

              {formData.is_reservation && item && (
                <div className="space-y-4">
                  {(formData.is_recurring || (formData.kind === 'digital_asset' && formData.digital_subtype === 'pass')) && (
                    <div className="p-4 bg-muted/30 rounded-xl border text-sm text-muted-foreground flex gap-3">
                      <div className="mt-0.5">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                      </div>
                      <div>
                        <span className="font-medium text-foreground block mb-1">Plan as calendar</span>
                        This item will act as the master calendar. Members book against this schedule after purchase. You don't need a separate reservable service unless you want to share this capacity with drop-in sales.
                      </div>
                    </div>
                  )}
                  <ReservationScheduleCard catalogItemId={item.id} />
                </div>
              )}
            </div>
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
                title="Inventory Tracking (Coming Soon)"
                description="View stock levels and movement history across locations."
              />
            </div>
          </TabsContent>

          <TabsContent value="sales" className="m-0 border-0 p-4 md:p-6 w-full focus-visible:outline-none">
            <div className="mx-auto max-w-[800px]">
              <EmptyCard
                icon={<Activity className="h-12 w-12 text-muted-foreground/50" />}
                title="Sales History (Coming Soon)"
                description="Track revenue and units sold over time for this item."
              />
            </div>
          </TabsContent>
        </div>
      </Tabs>

      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive "{item?.name}"? This will hide it from the active catalog.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={archiving}
              className="!bg-destructive !text-destructive-foreground hover:!bg-destructive/90"
            >
              {archiving ? "Archiving..." : "Archive Product"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}