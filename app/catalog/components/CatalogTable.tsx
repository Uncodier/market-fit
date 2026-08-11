"use client"

import React, { useMemo, useState } from "react"
import { CatalogItem, CatalogRelatedItem, CatalogCategory } from "@/app/types"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Badge } from "@/app/components/ui/badge"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSite } from "@/app/context/SiteContext"
import { updateCatalogAvailability } from "../actions"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Archive, Edit, GripHorizontal, Settings } from "@/app/components/ui/icons"
import { resolveItemImage } from "@/app/lib/image-utils"
import { NavigationLink } from "@/app/components/navigation/NavigationLink"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import { Accordion, AccordionItem, AccordionHeader, AccordionTrigger, AccordionContent } from "@/app/components/ui/accordion"

import { EmptyCard } from "@/app/components/ui/empty-card"
import { Button } from "@/app/components/ui/button"
import { cn } from "@/lib/utils"
import { EditCatalogCategoryDialog } from "./EditCatalogCategoryDialog"

interface CatalogTableProps {
  items: CatalogItem[]
  categories: CatalogCategory[]
  onUpdate: () => void
  searchQuery?: string
  onCreateOpen?: () => void
  onDragEnd?: (result: any) => void
  isDragEnabled?: boolean
}

function itemTypeLabel(item: CatalogItem, t: (key: string) => string): string | null {
  if (item.is_recurring) return t('catalog.type.plan') || 'Plan'
  if (item.digital_subtype === 'pass') return t('catalog.type.pass') || 'Pass'
  if (item.digital_subtype === 'ticket') return t('catalog.type.ticket') || 'Ticket'
  if (item.digital_subtype === 'course') return t('catalog.type.course') || 'Course'
  if (item.digital_subtype === 'file') return t('catalog.type.file') || 'File'
  if (item.digital_subtype === 'license') return t('catalog.type.license') || 'License'
  if (item.is_reservation) return t('catalog.type.reservable') || 'Reservable'
  if (item.kind === 'service') return t('catalog.kind.service') || 'Service'
  if (item.kind === 'product') return t('catalog.kind.product') || 'Product'
  if (item.kind === 'digital_asset') return t('catalog.kind.digitalAsset') || 'Digital'
  return null
}

function RelatedChips({
  label,
  items,
}: {
  label: string
  items: CatalogRelatedItem[]
}) {
  if (items.length === 0) return null
  const visible = items.slice(0, 3)
  const remaining = items.length - visible.length

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1 max-w-[280px]">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground mr-0.5">
        {label}
      </span>
      {visible.map((related) => (
        <NavigationLink key={related.id} href={`/catalog/${related.id}`}>
          <Badge
            variant="outline"
            className="text-[10px] font-normal px-1.5 py-0 h-5 hover:bg-muted/80 cursor-pointer"
          >
            {related.name}
          </Badge>
        </NavigationLink>
      ))}
      {remaining > 0 && (
        <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0 h-5">
          +{remaining}
        </Badge>
      )}
    </div>
  )
}

export function CatalogTable({ 
  items, 
  categories, 
  onUpdate, 
  searchQuery, 
  onCreateOpen, 
  onDragEnd,
  isDragEnabled = false
}: CatalogTableProps) {
  const { t } = useLocalization()
  const { currentSite } = useSite()
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({})
  const [editingCategory, setEditingCategory] = useState<CatalogCategory | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  const getVisibleCount = (id: string) => visibleCounts[id] || 10
  const loadMore = (id: string) => setVisibleCounts(prev => ({ ...prev, [id]: getVisibleCount(id) + 10 }))

  const handleAvailabilityChange = async (item: CatalogItem, newStatus: string) => {
    if (!currentSite) return
    const promise = updateCatalogAvailability(currentSite.id, item.id, { 
      availability_status: newStatus as any 
    })
    
    toast.promise(promise, {
      loading: 'Updating availability...',
      success: 'Availability updated',
      error: 'Failed to update availability'
    })

    await promise
    onUpdate()
  }

  // Group items
  const itemsByCategoryId = useMemo(() => {
    const grouped: Record<string, CatalogItem[]> = {}
    items.forEach(item => {
      const catId = item.category_id || "uncategorized"
      if (!grouped[catId]) grouped[catId] = []
      grouped[catId].push(item)
    })
    return grouped
  }, [items])

  const orderedCategorySections = useMemo(() => {
    const sections = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      items: itemsByCategoryId[cat.id] || []
    }))
    
    // Always append Uncategorized if it has items or if there's no search query
    const uncategorizedItems = itemsByCategoryId["uncategorized"] || []
    if (uncategorizedItems.length > 0 || sections.length === 0) {
      sections.push({
        id: "uncategorized",
        name: t('catalog.uncategorized') || "Uncategorized",
        items: uncategorizedItems
      })
    }
    
    return sections
  }, [categories, itemsByCategoryId, t])

  const defaultAccordionValue = orderedCategorySections.length > 10 
    ? [] 
    : orderedCategorySections.map(s => s.id)

  const handleDragEndInternal = (result: any) => {
    if (!onDragEnd) return
    onDragEnd(result)
  }

  if (items.length === 0 && !searchQuery) {
    return (
      <div className="p-8">
        <EmptyCard
          icon={<Archive className="h-6 w-6 text-muted-foreground" />}
          title={t('catalog.empty.title') || "No items found"}
          description={t('catalog.empty.description') || "Start by adding products or services to your catalog."}
          className="border-0 shadow-none bg-transparent"
          actionButton={
            onCreateOpen ? (
              <Button onClick={onCreateOpen} variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                {t('catalog.addItem') || 'Add Item'}
              </Button>
            ) : undefined
          }
        />
      </div>
    )
  }

  return (
    <>
    <DragDropContext onDragEnd={handleDragEndInternal}>
      <Droppable droppableId="categories-board" type="category" isDropDisabled={!isDragEnabled}>
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-4 pb-8">
            <Accordion type="multiple" defaultValue={defaultAccordionValue} className="w-full space-y-4">
              {orderedCategorySections.map((section, index) => {
                const isUncategorized = section.id === "uncategorized"
                const visibleItems = section.items.slice(0, getVisibleCount(section.id))

                return (
                  <Draggable 
                    key={section.id} 
                    draggableId={section.id} 
                    index={index} 
                    isDragDisabled={!isDragEnabled || isUncategorized}
                  >
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={cn(
                          "bg-background rounded-lg border",
                          snapshot.isDragging && "shadow-lg ring-1 ring-primary/20 z-50"
                        )}
                        style={provided.draggableProps.style}
                      >
                        <AccordionItem value={section.id} className="border-none">
                          <AccordionHeader className="flex items-center gap-1 rounded-t-lg hover:bg-muted/30 px-4">
                            {isDragEnabled && !isUncategorized && (
                              <div
                                {...provided.dragHandleProps}
                                className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-foreground p-1 -ml-1 rounded shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <GripHorizontal className="h-4 w-4" />
                              </div>
                            )}
                            <AccordionTrigger className="px-0 py-3 hover:no-underline flex-1 min-w-0">
                              <div className="flex items-center gap-3 text-sm flex-1 min-w-0 text-left">
                                <span className="font-semibold truncate">{section.name}</span>
                                <Badge variant="secondary" className="ml-2 font-normal text-xs shrink-0">{section.items.length}</Badge>
                              </div>
                            </AccordionTrigger>
                            {!isUncategorized && currentSite?.id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                                aria-label="Edit category"
                                onClick={() => {
                                  const cat = categories.find(c => c.id === section.id)
                                  if (cat) {
                                    setEditingCategory(cat)
                                    setIsEditDialogOpen(true)
                                  }
                                }}
                              >
                                <Settings className="h-3 w-3" />
                              </Button>
                            )}
                          </AccordionHeader>
                          <AccordionContent className="p-0">
                            <Droppable droppableId={section.id} type="item" isDropDisabled={!isDragEnabled}>
                              {(providedItem, snapshotItem) => (
                                <div
                                  ref={providedItem.innerRef}
                                  {...providedItem.droppableProps}
                                  className={cn(
                                    "min-h-[100px]",
                                    snapshotItem.isDraggingOver && "bg-muted/30"
                                  )}
                                >
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="hover:bg-transparent">
                                        {isDragEnabled && <TableHead className="w-8"></TableHead>}
                                        <TableHead className="w-10"></TableHead>
                                        <TableHead>{t('catalog.name') || 'Name & SKU'}</TableHead>
                                        <TableHead>{t('catalog.description') || 'Description'}</TableHead>
                                        <TableHead>{t('catalog.price') || 'Target Price'}</TableHead>
                                        <TableHead>{t('catalog.mode') || 'Availability Mode'}</TableHead>
                                        <TableHead>{t('catalog.status') || 'Sellable Status'}</TableHead>
                                        <TableHead className="w-16"></TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {visibleItems.length > 0 ? (
                                        visibleItems.map((item, itemIndex) => {
                                          const typeLabel = itemTypeLabel(item, t)
                                          const planIncludes = item.plan_includes || []
                                          const passRedeems = item.pass_redeems || []

                                          return (
                                            <Draggable 
                                              key={item.id} 
                                              draggableId={item.id} 
                                              index={itemIndex}
                                              isDragDisabled={!isDragEnabled}
                                            >
                                              {(providedRow, snapshotRow) => (
                                                <TableRow 
                                                  ref={providedRow.innerRef}
                                                  {...providedRow.draggableProps}
                                                  style={providedRow.draggableProps.style}
                                                  className={cn(
                                                    item.status === 'archived' && 'opacity-60',
                                                    snapshotRow.isDragging && "bg-background shadow-md ring-1 ring-primary/20 z-50 relative table-row"
                                                  )}
                                                >
                                                  {isDragEnabled && (
                                                    <TableCell className="w-8 px-2 py-3">
                                                      <div
                                                        {...providedRow.dragHandleProps}
                                                        className="cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-foreground"
                                                      >
                                                        <GripHorizontal className="h-4 w-4" />
                                                      </div>
                                                    </TableCell>
                                                  )}
                                                  <TableCell className="py-3">
                                                    <div className="h-8 w-8 rounded overflow-hidden flex-shrink-0 bg-muted">
                                                      <img src={resolveItemImage(item)} alt={item.name} className="w-full h-full object-cover" />
                                                    </div>
                                                  </TableCell>
                                                  <TableCell className="py-3">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                      <div className="font-medium text-foreground">{item.name}</div>
                                                      {typeLabel && (
                                                        <Badge variant="secondary" className="text-[10px] font-normal px-1.5 py-0 h-5 capitalize">
                                                          {typeLabel}
                                                        </Badge>
                                                      )}
                                                    </div>
                                                    {item.sku && <div className="text-xs text-muted-foreground font-mono mt-0.5">{item.sku}</div>}
                                                    {item.is_recurring && (
                                                      <RelatedChips
                                                        label={t('catalog.relations.includes') || 'Includes'}
                                                        items={planIncludes}
                                                      />
                                                    )}
                                                    {item.digital_subtype === 'pass' && (
                                                      <RelatedChips
                                                        label={t('catalog.relations.redeems') || 'Redeems'}
                                                        items={passRedeems}
                                                      />
                                                    )}
                                                  </TableCell>
                                                  <TableCell className="py-3">
                                                    <div className="text-sm text-muted-foreground line-clamp-2 max-w-[200px]" title={item.description || ''}>
                                                      {item.description || <span className="text-muted-foreground/50">-</span>}
                                                    </div>
                                                  </TableCell>
                                                  <TableCell className="py-3">
                                                    <div className="text-foreground">
                                                      {item.is_dynamic_price ? (
                                                        <span className="text-sm">
                                                          {item.lowest_sale_price != null || item.metadata?.dynamic_pricing?.min_price != null
                                                            ? `From ${new Intl.NumberFormat('en-US', { style: 'currency', currency: item.currency || 'USD' }).format(Number(item.metadata?.dynamic_pricing?.min_price ?? item.lowest_sale_price))}`
                                                            : (t('catalog.dynamicPricing.quote') || 'Quote')}
                                                        </span>
                                                      ) : item.target_sale_price != null 
                                                        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: item.currency || 'USD' }).format(item.target_sale_price)
                                                        : <span className="text-muted-foreground">-</span>
                                                      }
                                                    </div>
                                                  </TableCell>
                                                  <TableCell className="py-3">
                                                    <Badge variant="secondary" className="capitalize">
                                                      {item.availability_mode}
                                                    </Badge>
                                                    {item.track_inventory && (
                                                      <Badge variant="outline" className="ml-2 text-xs">
                                                        Tracks Stock
                                                      </Badge>
                                                    )}
                                                  </TableCell>
                                                  <TableCell className="py-3">
                                                    {item.availability_mode === 'manual' ? (
                                                      <Select 
                                                        value={item.availability_status} 
                                                        onValueChange={(val) => handleAvailabilityChange(item, val)}
                                                        disabled={item.status === 'archived'}
                                                      >
                                                        <SelectTrigger className="h-8 w-[130px] text-xs">
                                                          <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                          <SelectItem value="available">
                                                            <div className="flex items-center gap-2">
                                                              <div className="h-2 w-2 rounded-full bg-green-500"></div>
                                                              <span>{t('catalog.status.available') || 'Available'}</span>
                                                            </div>
                                                          </SelectItem>
                                                          <SelectItem value="sold_out">
                                                            <div className="flex items-center gap-2">
                                                              <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
                                                              <span>{t('catalog.status.soldOut') || 'Sold Out'}</span>
                                                            </div>
                                                          </SelectItem>
                                                          <SelectItem value="unavailable">
                                                            <div className="flex items-center gap-2">
                                                              <div className="h-2 w-2 rounded-full bg-red-500"></div>
                                                              <span>{t('catalog.status.unavailable') || 'Unavailable'}</span>
                                                            </div>
                                                          </SelectItem>
                                                        </SelectContent>
                                                      </Select>
                                                    ) : item.availability_mode === 'always' ? (
                                                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">
                                                        Always Sellable
                                                      </Badge>
                                                    ) : (
                                                      <Badge variant="outline">
                                                        Auto (Inventory)
                                                      </Badge>
                                                    )}
                                                  </TableCell>
                                                  <TableCell className="py-3">
                                                    <NavigationLink 
                                                      href={`/catalog/${item.id}`} 
                                                      className="inline-flex items-center justify-center rounded-md h-8 w-8 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                                    >
                                                      <Edit className="h-4 w-4" />
                                                    </NavigationLink>
                                                  </TableCell>
                                                </TableRow>
                                              )}
                                            </Draggable>
                                          )
                                        })
                                      ) : (
                                        <TableRow>
                                          <TableCell colSpan={isDragEnabled ? 8 : 7} className="h-24 text-center">
                                            <span className="text-muted-foreground/50 text-sm">
                                              {t('catalog.emptyCategory') || "No items in this category."}
                                            </span>
                                          </TableCell>
                                        </TableRow>
                                      )}
                                      {providedItem.placeholder}
                                    </TableBody>
                                  </Table>
                                  {section.items.length > visibleItems.length && (
                                    <div className="flex justify-center p-2 py-3 border-t bg-muted/10">
                                      <Button variant="ghost" size="sm" onClick={() => loadMore(section.id)}>
                                        {t('common.loadMore') || 'Cargar 10 más'}
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </Droppable>
                          </AccordionContent>
                        </AccordionItem>
                      </div>
                    )}
                  </Draggable>
                )
              })}
              {provided.placeholder}
            </Accordion>
          </div>
        )}
      </Droppable>
    </DragDropContext>

    {currentSite?.id && (
      <EditCatalogCategoryDialog
        siteId={currentSite.id}
        category={editingCategory}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={onUpdate}
      />
    )}
    </>
  )
}
