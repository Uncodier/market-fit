"use client"

import { useState, useEffect } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSite } from "@/app/context/SiteContext"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter
} from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Label } from "@/app/components/ui/label"
import { Input } from "@/app/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { toast } from "sonner"
import { listLocations, setInventoryLevel } from "../actions"
import { listCatalogItems } from "@/app/catalog/actions"

import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { resolveRelationId } from "@/app/commerce/resolve-relation"

export function CreateInventoryStockDialog() {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [locations, setLocations] = useState<any[]>([])
  const [catalogItems, setCatalogItems] = useState<any[]>([])

  const [selectedLocation, setSelectedLocation] = useState("")
  const [itemValue, setItemValue] = useState<RelationSelectValue>(null)
  const [quantity, setQuantity] = useState("1")

  useEffect(() => {
    const handleOpen = () => setOpen(true)
    window.addEventListener('inventory:create-stock', handleOpen)
    return () => window.removeEventListener('inventory:create-stock', handleOpen)
  }, [])

  useEffect(() => {
    if (open && currentSite) {
      // Load locations and catalog items when dialog opens
      listLocations(currentSite.id).then(res => {
        if (res.data) setLocations(res.data)
      })
      listCatalogItems({ siteId: currentSite.id, pageSize: 1000 }).then(res => {
        if (res.data) setCatalogItems(res.data)
      })
    }
  }, [open, currentSite])

  const handleSave = async () => {
    if (!currentSite) return
    if (!selectedLocation) {
      toast.error(t("inventory.selectLocationError") || "Please select a location")
      return
    }
    if (!itemValue) {
      toast.error(t("inventory.selectItemError") || "Please select an item")
      return
    }
    
    const qtyNum = parseInt(quantity)
    if (isNaN(qtyNum)) {
      toast.error(t("inventory.invalidQuantity") || "Invalid quantity")
      return
    }

    setSaving(true)

    try {
      const { id: resolvedItemId, error: itemError } = await resolveRelationId(
        "catalog_item", 
        itemValue, 
        currentSite.id,
        { kind: "product", availability_mode: "inventory", track_inventory: true }
      )
      if (itemError) throw new Error(`Catalog error: ${itemError}`)
      if (!resolvedItemId) throw new Error("Catalog item is required")

      const res = await setInventoryLevel(currentSite.id, selectedLocation, resolvedItemId, qtyNum)

      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(t("inventory.stockAdded") || "Stock added successfully")
        setOpen(false)
        // Reset form
        setSelectedLocation("")
        setItemValue(null)
        setQuantity("1")
        // Dispatch event to reload inventory table
        const event = new Event('inventory:reload')
        window.dispatchEvent(event)
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to add stock")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("inventory.addStock") || "Add Inventory Stock"}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t("inventory.item") || "Catalog Item"}</Label>
            <RelationSelect 
              options={catalogItems.map(item => ({ 
                id: item.id, 
                label: `${item.name} ${item.sku ? `(${item.sku})` : ''}` 
              }))}
              value={itemValue} 
              onValueChange={setItemValue}
              placeholder={t("inventory.selectItem") || "Select an item"}
              emptyMessage="No items found"
            />
          </div>

          <div className="space-y-2">
            <Label>{t("inventory.location") || "Location"}</Label>
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger>
                <SelectValue placeholder={t("inventory.selectLocation") || "Select a location"} />
              </SelectTrigger>
              <SelectContent>
                {locations.map(loc => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
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
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            {t("common.cancel") || "Cancel"}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (t("common.saving") || "Saving...") : (t("common.save") || "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
