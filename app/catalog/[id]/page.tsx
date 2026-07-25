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
import { Checkbox } from "@/app/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { toast } from "sonner"
import { ChevronLeft, Save, Trash2, Activity } from "@/app/components/ui/icons"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Textarea } from "@/app/components/ui/textarea"
import { ImageUpload } from "@/app/components/ui/image-upload"
import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { resolveRelationId } from "@/app/commerce/resolve-relation"
import { PlanItemsTab } from "../components/PlanItemsTab"
import { ProductTaxesCard } from "../components/ProductTaxesCard"

export default function CatalogItemDetail(props: { params: Promise<{ id: string }> }) {
  const params = React.use(props.params)
  const { t } = useLocalization()
  const { currentSite } = useSite()
  const router = useRouter()
  const [item, setItem] = useState<CatalogItem | null>(null)
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
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
    if (!confirm("Are you sure you want to archive this item?")) return
    
    const { error } = await deleteCatalogItem(currentSite.id, item.id)
    if (error) {
      toast.error(error)
    } else {
      toast.success("Item archived")
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
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="inventory">Inventory Movements</TabsTrigger>
              <TabsTrigger value="sales">Sales</TabsTrigger>
              {formData.is_recurring && (
                <TabsTrigger value="plan_items">Plan Items</TabsTrigger>
              )}
            </TabsList>
          </div>
        </StickyHeader>

        <div className="flex-1 p-4 md:p-6 overflow-auto">
          <TabsContent value="details" className="m-0 border-0 p-0">
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
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="product">Product</SelectItem>
                      <SelectItem value="service">Service</SelectItem>
                      <SelectItem value="digital_asset">Digital Asset</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.kind === 'digital_asset' && (
                  <div className="space-y-2 col-span-2 md:col-span-1">
                    <Label>Subtype</Label>
                    <Select 
                      value={formData.digital_subtype || 'none'} 
                      onValueChange={(val: any) => setFormData({...formData, digital_subtype: val === 'none' ? null : val})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select subtype" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="ticket">Ticket</SelectItem>
                        <SelectItem value="course">Course</SelectItem>
                        <SelectItem value="file">File</SelectItem>
                        <SelectItem value="pass">Pass</SelectItem>
                        <SelectItem value="license">License</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2 col-span-2 md:col-span-1">
                  <Label>Category</Label>
                  <RelationSelect 
                    options={categories.map(cat => ({ id: cat.id, label: cat.name }))}
                    value={categoryValue} 
                    onValueChange={(val) => setCategoryValue(val)}
                    placeholder="Select category..."
                    emptyMessage="No categories found"
                  />
                </div>
                <div className="space-y-2 col-span-2 md:col-span-1">
                  <Label>SKU / Code</Label>
                  <Input 
                    value={formData.sku || ''} 
                    onChange={e => setFormData({...formData, sku: e.target.value})} 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea 
                  value={formData.description || ''} 
                  onChange={e => setFormData({...formData, description: e.target.value})} 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Target Sale Price</Label>
                  <Input 
                    type="number"
                    value={formData.target_sale_price || ''} 
                    onChange={e => setFormData({...formData, target_sale_price: parseFloat(e.target.value) || 0})} 
                  />
              <p className="text-xs text-muted-foreground mt-1">
                {t("catalog.item.priceHint")}
              </p>
                </div>
                <div className="space-y-2">
                  <Label>Unit Cost</Label>
                  <Input 
                    type="number"
                    value={formData.cost || ''} 
                    onChange={e => setFormData({...formData, cost: parseFloat(e.target.value) || 0})} 
                  />
                </div>
              </div>
            </CardContent>
            <ActionFooter>
              <Button type="button" variant="outline" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </ActionFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Availability & Rules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Availability Mode</Label>
                  <Select 
                    value={formData.availability_mode || 'manual'} 
                    onValueChange={(val: any) => setFormData({...formData, availability_mode: val})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual (Toggle)</SelectItem>
                      <SelectItem value="inventory">Inventory (Stock based)</SelectItem>
                      <SelectItem value="always">Always Sellable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {formData.availability_mode === 'manual' && (
                  <div className="space-y-2">
                    <Label>Current Status</Label>
                    <Select 
                      value={formData.availability_status || 'available'} 
                      onValueChange={(val: any) => setFormData({...formData, availability_status: val})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="sold_out">Sold Out</SelectItem>
                        <SelectItem value="unavailable">Unavailable</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-3">
                <Checkbox 
                  id="track"
                  checked={formData.track_inventory || false}
                  onCheckedChange={(checked) => setFormData({...formData, track_inventory: checked as boolean})}
                />
                <Label htmlFor="track">Track Inventory Levels</Label>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <h4 className="text-sm font-medium">Features</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="flex items-center space-x-2 border p-3 rounded-md">
                    <Checkbox 
                      id="is_pos_available" 
                      checked={formData.is_pos_available ?? true}
                      onCheckedChange={(checked) => setFormData({...formData, is_pos_available: checked as boolean})}
                    />
                    <Label htmlFor="is_pos_available" className="cursor-pointer text-xs">Available in POS</Label>
                  </div>
                  <div className="flex items-center space-x-2 border p-3 rounded-md">
                    <Checkbox 
                      id="is_recurring" 
                      checked={formData.is_recurring ?? false}
                      onCheckedChange={(checked) => setFormData({...formData, is_recurring: checked as boolean})}
                    />
                    <Label htmlFor="is_recurring" className="cursor-pointer text-xs">Recurring</Label>
                  </div>
                  <div className="flex items-center space-x-2 border p-3 rounded-md">
                    <Checkbox 
                      id="is_reservation" 
                      checked={formData.is_reservation ?? false}
                      onCheckedChange={(checked) => setFormData({...formData, is_reservation: checked as boolean})}
                    />
                    <Label htmlFor="is_reservation" className="cursor-pointer text-xs">Reservable</Label>
                  </div>
                  <div className="flex items-center space-x-2 border p-3 rounded-md">
                    <Checkbox 
                      id="is_marketplace_listed" 
                      checked={formData.is_marketplace_listed ?? false}
                      onCheckedChange={(checked) => setFormData({...formData, is_marketplace_listed: checked as boolean})}
                    />
                    <Label htmlFor="is_marketplace_listed" className="cursor-pointer text-xs">Marketplace</Label>
                  </div>
                </div>
              </div>
            </CardContent>
            <ActionFooter>
              <Button type="button" variant="outline" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </ActionFooter>
          </Card>

          {item && <ProductTaxesCard catalogItemId={item.id} />}

          {item && (
            <div className="rounded-lg border-destructive/50 border bg-destructive/5 p-6">
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-destructive mb-1">Danger Zone</h2>
                  <p className="text-sm text-muted-foreground">
                    Actions in this section cannot be undone
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium mb-1">Archive Item</h3>
                    <p className="text-sm text-muted-foreground">
                      Remove this catalog item from active lists
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    type="button"
                    onClick={handleDelete}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Archive Item
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
        </TabsContent>

        <TabsContent value="inventory" className="m-0 border-0 p-0 h-full flex flex-col">
          <div className="flex-1 flex items-center justify-center p-6">
            <EmptyCard 
              icon={<Activity className="h-10 w-10" />}
              title="Inventory Movements"
              description="Inventory history and movements for this catalog item will appear here."
              variant="fancy"
            />
          </div>
        </TabsContent>

        <TabsContent value="sales" className="m-0 border-0 p-0 h-full flex flex-col">
          <div className="flex-1 flex items-center justify-center p-6">
            <EmptyCard 
              icon={<Activity className="h-10 w-10" />}
              title="Sales History"
              description="Sales history for this catalog item will appear here."
              variant="fancy"
            />
          </div>
        </TabsContent>

        {formData.is_recurring && item && (
          <TabsContent value="plan_items" className="m-0 border-0 p-0 h-full flex flex-col">
            <PlanItemsTab planItemId={item.id} />
          </TabsContent>
        )}
      </div>
      </Tabs>
    </div>
  )
}
