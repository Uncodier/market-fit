"use client"

import { useState, useEffect } from "react"
import { useSite } from "@/app/context/SiteContext"
import { useRouter } from "next/navigation"
import { getPriceList, listPriceListItems, setPriceListItem, removePriceListItem, upsertPriceList } from "../actions"
import { listCatalogItems } from "@/app/catalog/actions"
import { PriceList, CatalogItem } from "@/app/types"
import { PriceListItemWithCatalog } from "../types"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Badge } from "@/app/components/ui/badge"
import { toast } from "sonner"
import { ChevronLeft, Save, Trash2, Plus, Tag } from "@/app/components/ui/icons"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"

export default function PriceListDetail({ params }: { params: { id: string } }) {
  const { currentSite } = useSite()
  const router = useRouter()
  
  const [list, setList] = useState<PriceList | null>(null)
  const [items, setItems] = useState<PriceListItemWithCatalog[]>([])
  const [loading, setLoading] = useState(true)
  
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([])
  
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>('')
  const [newPrice, setNewPrice] = useState<string>('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    async function load() {
      if (!currentSite) return
      
      const [listRes, itemsRes, catalogRes] = await Promise.all([
        getPriceList(params.id),
        listPriceListItems(params.id, currentSite.id),
        listCatalogItems({ siteId: currentSite.id, pageSize: 1000 })
      ])
      
      if (listRes.error) {
        toast.error("Failed to load price list")
      } else if (listRes.data) {
        setList(listRes.data)
      }
      
      if (itemsRes.data) {
        setItems(itemsRes.data)
      }
      
      if (catalogRes.data) {
        setCatalogItems(catalogRes.data)
      }
      
      setLoading(false)
    }
    load()
  }, [params.id, currentSite])

  const handleAddPrice = async () => {
    if (!currentSite || !selectedCatalogId || !newPrice) return
    setAdding(true)
    
    const priceNum = parseFloat(newPrice)
    const { error } = await setPriceListItem(currentSite.id, params.id, selectedCatalogId, priceNum)
    
    if (error) {
      toast.error(error)
    } else {
      toast.success("Price added")
      // Reload items
      const itemsRes = await listPriceListItems(params.id, currentSite.id)
      if (itemsRes.data) setItems(itemsRes.data)
      setIsAddOpen(false)
      setSelectedCatalogId('')
      setNewPrice('')
    }
    setAdding(false)
  }

  const handleRemoveItem = async (itemId: string) => {
    if (!confirm("Remove this price?")) return
    const { error } = await removePriceListItem(itemId)
    if (error) {
      toast.error(error)
    } else {
      setItems(items.filter(i => i.id !== itemId))
      toast.success("Price removed")
    }
  }
  
  const handleToggleActive = async () => {
    if (!list || !currentSite) return
    const { data, error } = await upsertPriceList({ ...list, is_active: !list.is_active })
    if (data) setList(data)
    if (error) toast.error(error)
  }

  // Trigger breadcrumb update
  useEffect(() => {
    if (list) {
      const event = new CustomEvent('breadcrumb:update', {
        detail: {
          title: list.name,
          parent: {
            title: t('layout.sidebar.priceLists') || 'Price Lists',
            path: '/price-lists'
          }
        }
      });
      window.dispatchEvent(event);
    }
  }, [list, t]);

  if (loading) {
    return <div className="p-8 space-y-4"><Skeleton className="h-10 w-1/3"/><Skeleton className="h-64 w-full"/></div>
  }

  // Filter catalog items to only show those not yet in the list
  const unmappedCatalogItems = catalogItems.filter(
    ci => !items.some(pli => pli.catalog_item_id === ci.id)
  )

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-gray-50/30">
      <StickyHeader>
        <div className="w-full pt-0 flex justify-end">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleToggleActive}>
              {list?.is_active ? 'Deactivate List' : 'Activate List'}
            </Button>
            <Button onClick={() => setIsAddOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Add Price
            </Button>
          </div>
        </div>
      </StickyHeader>

      <div className="flex-1 p-4 md:p-6 overflow-auto">
        <div className="mx-auto max-w-[1000px]">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Target Sale Price</TableHead>
                  <TableHead>List Price ({list?.currency})</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-48 p-0">
                      <EmptyCard
                        icon={<Tag className="h-6 w-6" />}
                        title="No prices configured"
                        description="Map a catalog item to a specific price for this list."
                        actionButton={
                          <Button onClick={() => setIsAddOpen(true)} variant="outline">
                            <Plus className="mr-2 h-4 w-4" />
                            Add Price
                          </Button>
                        }
                        showShadow={false}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map(item => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-medium text-gray-900">{item.catalog_item?.name}</div>
                        {item.catalog_item?.sku && <div className="text-xs text-gray-500 font-mono">{item.catalog_item.sku}</div>}
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {item.catalog_item?.target_sale_price != null 
                          ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.catalog_item.target_sale_price) 
                          : '-'}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.unit_price)}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
      
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Item Price</DialogTitle>
            <DialogDescription>Map a catalog item to a specific price for this list.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Catalog Item</Label>
              <Select value={selectedCatalogId} onValueChange={setSelectedCatalogId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select item..." />
                </SelectTrigger>
                <SelectContent>
                  {unmappedCatalogItems.length === 0 ? (
                    <SelectItem value="empty" disabled>All items mapped</SelectItem>
                  ) : (
                    unmappedCatalogItems.map(ci => (
                      <SelectItem key={ci.id} value={ci.id}>
                        {ci.name} {ci.sku ? `(${ci.sku})` : ''} - Default: {ci.target_sale_price || 0}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>List Price</Label>
              <Input 
                type="number" 
                step="0.01" 
                min="0"
                value={newPrice} 
                onChange={e => setNewPrice(e.target.value)} 
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddPrice} disabled={!selectedCatalogId || !newPrice || adding || selectedCatalogId === 'empty'}>
              {adding ? "Saving..." : "Add Price"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
