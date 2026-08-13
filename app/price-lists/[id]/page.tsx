"use client"

import React, { useState, useEffect } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSite } from "@/app/context/SiteContext"
import { useRouter } from "next/navigation"
import { getPriceList, listPriceListItems, setPriceListItem, removePriceListItem, upsertPriceList } from "../actions"
import { listCatalogItems } from "@/app/catalog/actions"
import { PriceList, CatalogItem } from "@/app/types"
import { PriceListItemWithCatalog } from "../types"
import { Button } from "@/app/components/ui/button"
import { SearchInput } from "@/app/components/ui/search-input"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Archive, DatabaseIcon } from "@/app/components/ui/icons"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { formatCurrency } from "@/app/lib/formatters"
import {
  DocumentListHead,
  DocumentListRow,
  EntityCell,
  MoneyCell,
  documentListShellClassName,
} from "@/app/components/documents/document-list"
import { toast } from "sonner"
import { ChevronLeft, Save, Trash2, Plus, Tag, Edit, MoreHorizontal } from "@/app/components/ui/icons"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { resolveRelationId } from "@/app/commerce/resolve-relation"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu"
import { PriceListDialog } from "../components/PriceListDialog"

export default function PriceListDetail(props: { params: Promise<{ id: string }> }) {
  const params = React.use(props.params)
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const router = useRouter()
  
  const [list, setList] = useState<PriceList | null>(null)
  const [items, setItems] = useState<PriceListItemWithCatalog[]>([])
  const [loading, setLoading] = useState(true)
  
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([])
  
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [catalogValue, setCatalogValue] = useState<RelationSelectValue>(null)
  const [newPrice, setNewPrice] = useState<string>('')
  const [adding, setAdding] = useState(false)
  const [kindFilter, setKindFilter] = useState<'all' | 'product' | 'service'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editItem, setEditItem] = useState<PriceListItemWithCatalog | null>(null)
  const [editPrice, setEditPrice] = useState<string>('')
  const [editing, setEditing] = useState(false)
  const [isListEditOpen, setIsListEditOpen] = useState(false)

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
    if (!currentSite || !catalogValue || !newPrice) return
    setAdding(true)
    
    try {
      const { id: resolvedCatalogId, error: catError } = await resolveRelationId(
        "catalog_item", 
        catalogValue, 
        currentSite.id, 
        { kind: "product" }
      )
      if (catError) throw new Error(`Catalog item error: ${catError}`)
      if (!resolvedCatalogId) throw new Error("Catalog item is required")

      const priceNum = parseFloat(newPrice)
      const { error } = await setPriceListItem(currentSite.id, params.id, resolvedCatalogId, priceNum)
      
      if (error) {
        toast.error(error)
      } else {
        toast.success("Price added")
        // Reload items
        const itemsRes = await listPriceListItems(params.id, currentSite.id)
        if (itemsRes.data) setItems(itemsRes.data)
        setIsAddOpen(false)
        setCatalogValue(null)
        setNewPrice('')
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to add price")
    } finally {
      setAdding(false)
    }
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

  const handleEditPrice = async () => {
    if (!currentSite || !editItem || !editPrice) return
    setEditing(true)
    
    try {
      const priceNum = parseFloat(editPrice)
      const { error } = await setPriceListItem(currentSite.id, params.id, editItem.catalog_item_id, priceNum)
      
      if (error) {
        toast.error(error)
      } else {
        toast.success("Price updated")
        // Reload items
        const itemsRes = await listPriceListItems(params.id, currentSite.id)
        if (itemsRes.data) setItems(itemsRes.data)
        setIsEditOpen(false)
        setEditItem(null)
        setEditPrice('')
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update price")
    } finally {
      setEditing(false)
    }
  }
  
  const handleToggleActive = async () => {
    if (!list || !currentSite) return
    const { data, error } = await upsertPriceList({ ...list, is_active: !list.is_active })
    if (data) setList(data)
    if (error) toast.error(error)
  }

  // Listen to topbar events
  useEffect(() => {
    const handleAddPrice = () => setIsAddOpen(true);
    const handleToggleActiveEvent = () => handleToggleActive();
    const handleEditList = () => setIsListEditOpen(true);

    window.addEventListener('price-list:add-price', handleAddPrice);
    window.addEventListener('price-list:toggle-active', handleToggleActiveEvent);
    window.addEventListener('price-list:edit', handleEditList);

    return () => {
      window.removeEventListener('price-list:add-price', handleAddPrice);
      window.removeEventListener('price-list:toggle-active', handleToggleActiveEvent);
      window.removeEventListener('price-list:edit', handleEditList);
    };
  }, [list, currentSite]);

  // Trigger breadcrumb update
  useEffect(() => {
    if (list) {
      const event = new CustomEvent('breadcrumb:update', {
        detail: {
          title: list.name,
          parent: {
            title: t('layout.sidebar.priceLists') || 'Price Lists',
            path: '/price-lists'
          },
          priceListData: {
            id: list.id,
            is_active: list.is_active
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

  const filteredItems = items.filter(item => {
    if (kindFilter !== 'all' && item.catalog_item?.kind !== kindFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!item.catalog_item?.name?.toLowerCase().includes(q) && !item.catalog_item?.sku?.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <StickyHeader>
        <div className="w-full pt-0">
          <div className="flex items-center justify-between w-full">
            <div className="flex flex-col md:flex-row md:items-center gap-2 w-full">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
                <Tabs 
                  value={kindFilter} 
                  onValueChange={(val) => setKindFilter(val as any)}
                  className="flex-shrink-0"
                >
                  <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full">
                    <TabsTrigger value="all" className="text-xs rounded-full">{t('catalog.kind.all') || 'All Items'}</TabsTrigger>
                    <TabsTrigger value="product" className="gap-2 text-xs rounded-full"><Archive className="h-4 w-4"/> {t('catalog.kind.product') || 'Products'}</TabsTrigger>
                    <TabsTrigger value="service" className="gap-2 text-xs rounded-full"><DatabaseIcon className="h-4 w-4"/> {t('catalog.kind.service') || 'Services'}</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="w-full md:w-auto">
                  <SearchInput 
                    placeholder={t('catalog.search') || "Search catalog..."} 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    alwaysExpanded={false}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </StickyHeader>

      <div className="flex-1 p-4 md:p-6 overflow-auto">
        {filteredItems.length === 0 ? (
          <EmptyCard
            icon={<Tag className="h-6 w-6" />}
            title={t("priceLists.items.empty.title") || "No prices configured"}
            description={t("priceLists.items.empty.description") || "Map a catalog item to a specific price for this list."}
            actionButton={
              <Button onClick={() => setIsAddOpen(true)} variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                {t("priceLists.items.add") || "Add Price"}
              </Button>
            }
          />
        ) : (
          <div className={documentListShellClassName()}>
            <Table className="min-w-[640px]">
              <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
                <TableRow className="hover:bg-transparent">
                  <DocumentListHead className="w-[40%]">{t("priceLists.items.item") || "Item"}</DocumentListHead>
                  <DocumentListHead className="w-[22%]">{t("priceLists.items.target") || "Target sale price"}</DocumentListHead>
                  <DocumentListHead className="w-[26%]" align="right">
                    {t("priceLists.items.listPrice") || "List price"}{list?.currency ? ` (${list.currency})` : ""}
                  </DocumentListHead>
                  <DocumentListHead className="w-[12%]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => {
                  const currency = list?.currency || "USD"
                  return (
                    <DocumentListRow key={item.id} accent="none">
                      <TableCell className="py-3.5">
                        <EntityCell
                          name={item.catalog_item?.name || (t("priceLists.items.untitled") || "Untitled item")}
                          secondary={item.catalog_item?.sku || null}
                        />
                      </TableCell>
                      <TableCell className="py-3.5 text-sm text-muted-foreground tabular-nums">
                        {item.catalog_item?.target_sale_price != null
                          ? formatCurrency(item.catalog_item.target_sale_price, currency)
                          : "—"}
                      </TableCell>
                      <TableCell className="py-3.5">
                        <MoneyCell amountLabel={formatCurrency(item.unit_price, currency)} />
                      </TableCell>
                      <TableCell className="py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 opacity-100 md:opacity-0 transition-opacity group-hover:opacity-100">
                              <span className="sr-only">{t("common.openMenu") || "Open menu"}</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                              setEditItem(item)
                              setEditPrice(item.unit_price.toString())
                              setIsEditOpen(true)
                            }}>
                              <Edit className="mr-2 h-4 w-4" />
                              <span>{t("priceLists.items.edit") || "Edit Price"}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600 focus:text-red-600 focus:bg-red-50" onClick={() => handleRemoveItem(item.id)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>{t("common.delete") || "Delete"}</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </DocumentListRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
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
              <RelationSelect 
                options={unmappedCatalogItems.map(ci => ({ 
                  id: ci.id, 
                  label: `${ci.name} ${ci.sku ? `(${ci.sku})` : ''} - Default: ${ci.target_sale_price || 0}`
                }))}
                value={catalogValue} 
                onValueChange={setCatalogValue}
                placeholder="Select item..."
                emptyMessage="All items mapped or no items found"
              />
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
            <Button onClick={handleAddPrice} disabled={!catalogValue || !newPrice || adding}>
              {adding ? "Saving..." : "Add Price"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Item Price</DialogTitle>
            <DialogDescription>Update the price for {editItem?.catalog_item?.name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>List Price</Label>
              <Input 
                type="number" 
                step="0.01" 
                min="0"
                value={editPrice} 
                onChange={e => setEditPrice(e.target.value)} 
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEditPrice} disabled={!editPrice || editing}>
              {editing ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isListEditOpen && list && (
        <PriceListDialog
          open={isListEditOpen}
          onOpenChange={setIsListEditOpen}
          list={list}
          onSuccess={() => {
            void getPriceList(params.id).then((res) => {
              if (res.data) setList(res.data)
            })
          }}
        />
      )}
    </div>
  )
}
