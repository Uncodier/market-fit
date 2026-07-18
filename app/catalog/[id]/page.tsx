"use client"

import { useState, useEffect } from "react"
import { useSite } from "@/app/context/SiteContext"
import { useRouter } from "next/navigation"
import { getCatalogItem, upsertCatalogItem, deleteCatalogItem } from "../actions"
import { CatalogItem } from "@/app/types"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Checkbox } from "@/app/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card"
import { toast } from "sonner"
import { ChevronLeft, Save, Trash2 } from "@/app/components/ui/icons"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Textarea } from "@/app/components/ui/textarea"

export default function CatalogItemDetail({ params }: { params: { id: string } }) {
  const { currentSite } = useSite()
  const router = useRouter()
  const [item, setItem] = useState<CatalogItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<Partial<CatalogItem>>({})

  useEffect(() => {
    async function load() {
      if (params.id === 'new') return
      const { data, error } = await getCatalogItem(params.id)
      if (error) {
        toast.error("Failed to load item")
      } else if (data) {
        setItem(data)
        setFormData(data)
      }
      setLoading(false)
    }
    load()
  }, [params.id])

  const handleSave = async () => {
    if (!currentSite) return
    setSaving(true)
    const { data, error } = await upsertCatalogItem({
      ...formData,
      site_id: currentSite.id,
      id: item?.id
    })
    
    if (error) {
      toast.error(error)
    } else {
      toast.success("Saved successfully")
      if (!item && data) {
        router.replace(`/catalog/${data.id}?artifact=true`)
      } else if (data) {
        setItem(data)
        setFormData(data)
      }
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!currentSite || !item) return
    if (!confirm("Are you sure you want to archive this item?")) return
    
    const { error } = await deleteCatalogItem(currentSite.id, item.id)
    if (error) {
      toast.error(error)
    } else {
      toast.success("Item archived")
      router.push("/catalog?artifact=true")
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
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-gray-50/30">
      <StickyHeader>
        <div className="w-full pt-0 flex justify-end">
          <div className="flex items-center gap-2">
            {item && (
              <Button variant="outline" className="text-red-600 hover:text-red-700" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-2" /> Archive
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </StickyHeader>

      <div className="flex-1 p-4 md:p-6 overflow-auto">
        <div className="mx-auto max-w-[800px] space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2 md:col-span-1">
                  <Label>Name</Label>
                  <Input 
                    value={formData.name || ''} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
