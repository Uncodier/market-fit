"use client"

import { useState, useEffect } from "react"
import useSWR from "swr"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { listInventoryLevels, listLocations, setInventoryLevel, upsertLocation, getCommerceSettings, updateCommerceSettings } from "./actions"
import { listCatalogItems } from "@/app/catalog/actions"
import { InventoryParams, InventoryLevelWithCatalog } from "./types"
import { Location, CatalogItem } from "@/app/types"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Button } from "@/app/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Badge } from "@/app/components/ui/badge"
import { SearchInput } from "@/app/components/ui/search-input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { Pagination } from "@/app/components/ui/pagination"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/app/components/ui/dialog"
import { Save, MapPin, DatabaseIcon, Settings, Edit, Plus, PlusCircle } from "@/app/components/ui/icons"

import { CreateInventoryStockDialog } from "./components/CreateInventoryStockDialog"

export default function InventoryPage() {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  
  const [activeTab, setActiveTab] = useState("levels")
  const [page, setPage] = useState(1)
  const pageSize = 50
  const [q, setQ] = useState("")
  const [selectedLocation, setSelectedLocation] = useState<string>('all')

  const { data: locationsData } = useSWR(currentSite?.id ? ['locations', currentSite.id] : null, () => listLocations(currentSite!.id))
  const locations = locationsData?.data || []

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    // Se fuerza a recargar el componente hijo (InventoryLevelsTab) si es necesario, 
    // pero ya está leyendo los props q y page que pasaremos.
  }

  useEffect(() => {
    // Si queremos un titulo especial
    const event = new CustomEvent('breadcrumb:update', {
      detail: {
        title: t('layout.sidebar.inventory') || 'Inventory'
      }
    });
    window.dispatchEvent(event);
  }, [t]);

  useEffect(() => {
    const handleReload = () => {
      // Forzar recarga del componente hijo modificando el estado "q" brevemente o disparando una revalidación,
      // Aunque en este caso mutar el SWR global es mejor si se expone, pero podemos hacerlo 
      // cambiando y restaurando la página.
      setPage(1)
    }
    window.addEventListener('inventory:reload', handleReload)
    return () => window.removeEventListener('inventory:reload', handleReload)
  }, []);

  useEffect(() => {
    const handleOpenLocation = () => {
      setActiveTab("locations")
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('inventory:open-location-dialog-internal'))
      }, 50)
    }
    const handleOpenStock = () => {
      setActiveTab("levels")
    }
    window.addEventListener('inventory:open-location-dialog', handleOpenLocation)
    window.addEventListener('inventory:create-stock', handleOpenStock)
    return () => {
      window.removeEventListener('inventory:open-location-dialog', handleOpenLocation)
      window.removeEventListener('inventory:create-stock', handleOpenStock)
    }
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <StickyHeader>
        <div className="w-full pt-0">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full hidden md:flex">
                  <TabsTrigger value="levels" className="gap-2 text-xs rounded-full"><DatabaseIcon className="h-4 w-4"/> Stock Levels</TabsTrigger>
                  <TabsTrigger value="locations" className="gap-2 text-xs rounded-full"><MapPin className="h-4 w-4"/> Locations</TabsTrigger>
                  <TabsTrigger value="settings" className="gap-2 text-xs rounded-full"><Settings className="h-4 w-4"/> Commerce Settings</TabsTrigger>
                </TabsList>
              </Tabs>
              {activeTab === "levels" && (
                <form onSubmit={handleSearch} className="w-full md:w-64">
                  <SearchInput 
                    placeholder="Search catalog..." 
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    alwaysExpanded={false}
                  />
                </form>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {activeTab === "levels" && (
                <Select value={selectedLocation} onValueChange={(v) => { setSelectedLocation(v); setPage(1); }}>
                  <SelectTrigger className="w-[160px] h-8 text-xs bg-muted/30 border-0 rounded-full">
                    <SelectValue placeholder="All Locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {locations.map((loc: any) => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </div>
      </StickyHeader>

      <div className="flex-1 p-4 md:p-6 overflow-auto">
        <div>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsContent value="levels">
              <InventoryLevelsTab 
                siteId={currentSite?.id} 
                locations={locations}
                page={page}
                setPage={setPage}
                pageSize={pageSize}
                q={q}
                selectedLocation={selectedLocation}
              />
            </TabsContent>
            
            <TabsContent value="locations">
              <LocationsTab siteId={currentSite?.id} />
            </TabsContent>

            <TabsContent value="settings">
              <CommerceSettingsTab siteId={currentSite?.id} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <CreateInventoryStockDialog />
    </div>
  )
}

function InventoryLevelsTab({ 
  siteId, 
  locations,
  page, 
  setPage, 
  pageSize, 
  q, 
  selectedLocation 
}: { 
  siteId?: string;
  locations: Location[];
  page: number;
  setPage: (p: number) => void;
  pageSize: number;
  q: string;
  selectedLocation: string;
}) {

  const fetcher = async () => {
    const res = await listInventoryLevels({ 
      siteId: siteId!, 
      page, 
      pageSize, 
      q,
      locationId: selectedLocation === 'all' ? undefined : selectedLocation
    })
    return res
  }

  const { data, error, isLoading, mutate } = useSWR(
    siteId ? ['inventory_levels', siteId, page, q, selectedLocation] : null,
    fetcher
  )

  const handleUpdateQuantity = async (level: InventoryLevelWithCatalog, newQtyStr: string) => {
    if (!siteId) return
    const qty = parseInt(newQtyStr)
    if (isNaN(qty)) return
    
    const promise = setInventoryLevel(siteId, level.location_id, level.catalog_item_id, qty)
    toast.promise(promise, {
      loading: 'Updating stock...',
      success: 'Stock updated',
      error: 'Failed to update stock'
    })
    await promise
    mutate()
  }

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-500">Error loading inventory</div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Quantity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-48 p-0">
                      <EmptyCard
                        icon={<DatabaseIcon className="h-6 w-6" />}
                        title="No stock levels found"
                        description="Stock is created when items are added to catalog with inventory tracking enabled."
                        showShadow={false}
                        actionButton={
                          <Button onClick={() => window.dispatchEvent(new CustomEvent('inventory:create-stock'))} variant="outline">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add Stock
                          </Button>
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.data.map((level) => {
                    const loc = locations.find(l => l.id === level.location_id)
                    return (
                      <TableRow key={level.id}>
                        <TableCell>
                          <div className="font-medium text-foreground">{level.catalog_item?.name}</div>
                          {level.catalog_item?.sku && <div className="text-xs text-muted-foreground font-mono">{level.catalog_item.sku}</div>}
                        </TableCell>
                        <TableCell>
                          {loc?.name || 'Unknown'} {loc?.is_default && <Badge className="ml-2 text-[10px]">Default</Badge>}
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="number" 
                            defaultValue={level.quantity}
                            onBlur={(e) => {
                              if (e.target.value !== String(level.quantity)) {
                                handleUpdateQuantity(level, e.target.value)
                              }
                            }}
                            className="w-24 h-8"
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
            
            {data && data.count > pageSize && (
              <div className="p-4 border-t flex justify-center">
                <Pagination 
                  currentPage={page}
                  totalPages={Math.ceil(data.count / pageSize)}
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function LocationsTab({ siteId }: { siteId?: string }) {
  const { data, isLoading, mutate } = useSWR(siteId ? ['locations', siteId] : null, () => listLocations(siteId!))
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newLocName, setNewLocName] = useState("")

  useEffect(() => {
    const handleOpen = () => setIsDialogOpen(true)
    window.addEventListener('inventory:open-location-dialog-internal', handleOpen)
    window.addEventListener('inventory:open-location-dialog', handleOpen)
    return () => {
      window.removeEventListener('inventory:open-location-dialog-internal', handleOpen)
      window.removeEventListener('inventory:open-location-dialog', handleOpen)
    }
  }, [])

  const handleCreate = async () => {
    if (!newLocName.trim() || !siteId) return
    setSaving(true)
    const res = await upsertLocation({ site_id: siteId, name: newLocName.trim(), is_active: true, is_default: false })
    setSaving(false)
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success("Location created")
      setIsDialogOpen(false)
      setNewLocName("")
      mutate()
    }
  }
  
  if (isLoading) return <Skeleton className="h-32 w-full" />

  return (
      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center bg-muted/30">
          <div>
            <h3 className="font-semibold text-lg">Physical Locations</h3>
            <p className="text-sm text-muted-foreground">Manage store fronts, warehouses, and fulfillment centers.</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-2" /> Add Location</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Location</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Location Name</Label>
                  <Input value={newLocName} onChange={e => setNewLocName(e.target.value)} placeholder="e.g. Downtown Store" />
                </div>
                <Button onClick={handleCreate} disabled={saving} className="w-full">
                  {saving ? "Saving..." : "Create Location"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Location Name</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-16"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.data?.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="h-48 p-0">
                <EmptyCard
                  icon={<MapPin className="h-6 w-6" />}
                  title="No locations found"
                  description="Add a physical location to manage stock per store or warehouse."
                  actionButton={
                    <Button onClick={() => setIsDialogOpen(true)} variant="outline">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Location
                    </Button>
                  }
                  showShadow={false}
                />
              </TableCell>
            </TableRow>
          ) : (
            data?.data.map((loc: any) => (
              <TableRow key={loc.id}>
                <TableCell>
                  <span className="font-medium">{loc.name}</span>
                  {loc.is_default && <Badge className="ml-2 bg-blue-100 text-blue-700 border-none text-[10px]">Default</Badge>}
                </TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground">{loc.code || '-'}</TableCell>
                <TableCell>
                  {loc.is_active ? <Badge variant="outline" className="text-green-700 bg-green-50 border-green-200">Active</Badge> : <Badge variant="outline">Inactive</Badge>}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" disabled><Edit className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function CommerceSettingsTab({ siteId }: { siteId?: string }) {
  const { data, isLoading, mutate } = useSWR(siteId ? ['commerce_settings', siteId] : null, () => getCommerceSettings(siteId!))
  const [settings, setSettings] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (data?.data) {
      setSettings(data.data)
    }
  }, [data])

  if (isLoading || !settings) return <Skeleton className="h-64 w-full" />

  const handleSave = async () => {
    if (!siteId) return
    setSaving(true)
    const res = await updateCommerceSettings(siteId, settings)
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success("Settings saved")
      mutate()
    }
    setSaving(false)
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Commerce Policies</CardTitle>
        <CardDescription>Configure how the system handles stock and sales.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Stock Shortage Policy</Label>
          <Select 
            value={settings.stock_shortage_policy || 'allow'} 
            onValueChange={v => setSettings({...settings, stock_shortage_policy: v})}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="allow">Allow (Sell even if qty insufficient)</SelectItem>
              <SelectItem value="warn">Warn (Allow sale, surface warning in UI)</SelectItem>
              <SelectItem value="block">Block (Reject sale when qty insufficient)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">Only applies to items where Availability Mode is "Inventory".</p>
        </div>

        <div className="space-y-2">
          <Label>Default Availability Mode for New Items</Label>
          <Select 
            value={settings.default_availability_mode || 'manual'} 
            onValueChange={v => setSettings({...settings, default_availability_mode: v})}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual (Toggle Available/Sold Out)</SelectItem>
              <SelectItem value="inventory">Inventory (Based on stock levels)</SelectItem>
              <SelectItem value="always">Always Sellable</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Decrement Stock On</Label>
          <Select value={settings.decrement_stock_on || 'ship'} onValueChange={v => setSettings({...settings, decrement_stock_on: v})}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ship">When Shipped (Standard)</SelectItem>
              <SelectItem value="order_complete">When Order Completed / Delivered</SelectItem>
              <SelectItem value="never">Never (Do not auto-decrement)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">Determines when inventory is subtracted during the fulfillment lifecycle. Walk-in and pickup sales decrement immediately unless set to "Never".</p>
        </div>

        <div className="pt-4 border-t">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
