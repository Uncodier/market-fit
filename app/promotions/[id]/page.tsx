"use client"

import { useState, useEffect } from "react"
import { useSite } from "@/app/context/SiteContext"
import { useRouter } from "next/navigation"
import { getPromotion, upsertPromotion, listPromotionItems, setPromotionItems } from "../actions"
import { listCatalogItems } from "@/app/catalog/actions"
import { PromotionWithCampaign } from "../types"
import { CatalogItem } from "@/app/types"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card"
import { toast } from "sonner"
import { ChevronLeft, Save, Trash2 } from "@/app/components/ui/icons"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Checkbox } from "@/app/components/ui/checkbox"

export default function PromotionDetail({ params }: { params: { id: string } }) {
  const { currentSite } = useSite()
  const router = useRouter()
  
  const [promo, setPromo] = useState<PromotionWithCampaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([])
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([])

  useEffect(() => {
    async function load() {
      if (!currentSite) return
      const [{ data, error }, catalogRes, itemsRes] = await Promise.all([
        getPromotion(params.id),
        listCatalogItems({ siteId: currentSite.id, pageSize: 1000 }),
        listPromotionItems(params.id, currentSite.id)
      ])
      
      if (error) {
        toast.error("Failed to load promotion")
      } else if (data) {
        setPromo(data)
      }
      if (catalogRes.data) setCatalogItems(catalogRes.data)
      if (itemsRes.data) setSelectedItemIds(itemsRes.data.map((i: any) => i.catalog_item_id))
      setLoading(false)
    }
    load()
  }, [params.id, currentSite])

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
    
    // Save basic
    const { error: promoError } = await upsertPromotion(promo)
    if (promoError) toast.error(promoError)
    
    // Save items if applicable
    if (promo.applies_to === 'selected_items') {
      const { error: itemsError } = await setPromotionItems(promo.id, currentSite.id, selectedItemIds)
      if (itemsError) toast.error(itemsError)
    }
    
    if (!promoError) toast.success("Saved successfully")
    setSaving(false)
  }

  if (loading) return <div className="p-8 space-y-4"><Skeleton className="h-10 w-1/3"/><Skeleton className="h-64 w-full"/></div>
  if (!promo) return <div className="p-8">Promotion not found</div>

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-gray-50/30">
      <StickyHeader>
        <div className="w-full pt-0 flex justify-end">
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" /> {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </StickyHeader>

      <div className="flex-1 p-4 md:p-6 overflow-auto">
        <div className="mx-auto max-w-[800px] space-y-6">
          <Card>
            <CardHeader><CardTitle>Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={promo.name} onChange={e => setPromo({...promo, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Coupon Code (Optional)</Label>
                  <Input value={promo.code || ''} onChange={e => setPromo({...promo, code: e.target.value})} className="uppercase" />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={promo.status} onValueChange={(v: any) => setPromo({...promo, status: v})}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Discount Type</Label>
                  <Select value={promo.discount_type} onValueChange={(v: any) => setPromo({...promo, discount_type: v})}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Percentage (%)</SelectItem>
                      <SelectItem value="fixed">Fixed ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Value</Label>
                  <Input type="number" value={promo.discount_value} onChange={e => setPromo({...promo, discount_value: parseFloat(e.target.value) || 0})} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Rules</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Applies To</Label>
                <Select value={promo.applies_to} onValueChange={(v: any) => setPromo({...promo, applies_to: v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Entire Order</SelectItem>
                    <SelectItem value="selected_items">Specific Catalog Items</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {promo.applies_to === 'selected_items' && (
                <div className="border rounded-md p-4 max-h-[300px] overflow-y-auto space-y-2">
                  <Label>Select items</Label>
                  {catalogItems.map(item => (
                    <div key={item.id} className="flex items-center space-x-2 py-1">
                      <Checkbox 
                        id={`item-${item.id}`}
                        checked={selectedItemIds.includes(item.id)}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedItemIds([...selectedItemIds, item.id])
                          else setSelectedItemIds(selectedItemIds.filter(id => id !== item.id))
                        }}
                      />
                      <label htmlFor={`item-${item.id}`} className="text-sm cursor-pointer">{item.name}</label>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Minimum Order Amount (Subtotal)</Label>
                  <Input type="number" value={promo.min_order_amount || ''} onChange={e => setPromo({...promo, min_order_amount: e.target.value ? parseFloat(e.target.value) : undefined})} />
                </div>
                <div className="space-y-2">
                  <Label>Usage Limit (Max total uses)</Label>
                  <Input type="number" value={promo.usage_limit || ''} onChange={e => setPromo({...promo, usage_limit: e.target.value ? parseInt(e.target.value) : undefined})} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
