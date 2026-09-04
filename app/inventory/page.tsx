"use client"

import { useState, useEffect } from "react"
import useSWR from "swr"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { listLocations, getCommerceSettings, updateCommerceSettings } from "./actions"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { MobileFiltersDrawer } from "@/app/components/ui/mobile-filters-drawer"
import { Button } from "@/app/components/ui/button"
import { SearchInput } from "@/app/components/ui/search-input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Label } from "@/app/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card"
import { toast } from "sonner"
import { Save, MapPin, DatabaseIcon, Settings } from "@/app/components/ui/icons"
import { CreateInventoryStockDialog } from "./components/CreateInventoryStockDialog"
import { InventoryLevelsTab } from "./components/InventoryLevelsTab"
import { InventoryLocationsTable } from "./components/InventoryLocationsTable"
import { PrinterSyncBadge } from "@/app/components/printer/PrinterSyncBadge"

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
              <MobileFiltersDrawer triggerText={t('common.search') || "Search"}>
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-6 md:gap-4 w-full flex-1 min-w-0">
                  {activeTab === "levels" && (
                    <div className="md:hidden w-full">
                      <form onSubmit={handleSearch} className="w-full">
                        <SearchInput  placeholder="Search catalog..." value={q} onChange={(e) => setQ(e.target.value)} alwaysExpanded={true}    className="w-full h-10 md:h-9"  containerClassName="w-full" />
                      </form>
                    </div>
                  )}
                  <div className="flex flex-col gap-2 w-full md:w-auto">
                    <span className="text-xs font-semibold text-muted-foreground md:hidden mb-1 uppercase">{t('common.filters') || 'Filters'}</span>
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                      <TabsList className="h-auto md:h-8 p-0 md:p-0.5 bg-transparent md:bg-muted/30 rounded-lg md:rounded-full flex flex-col md:flex-row w-full md:max-w-full overflow-y-auto md:overflow-x-auto justify-start items-stretch md:items-center gap-1 md:gap-0">
                        <TabsTrigger value="levels" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent gap-2 whitespace-nowrap"><DatabaseIcon className="h-4 w-4"/> Stock Levels</TabsTrigger>
                        <TabsTrigger value="locations" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent gap-2 whitespace-nowrap"><MapPin className="h-4 w-4"/> Locations</TabsTrigger>
                        <TabsTrigger value="settings" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent gap-2 whitespace-nowrap"><Settings className="h-4 w-4"/> Commerce Settings</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                  {activeTab === "levels" && (
                    <div className="hidden md:block">
                      <form onSubmit={handleSearch} className="w-full md:w-64">
                        <SearchInput   
                          placeholder="Search catalog..." 
                          value={q}
                          onChange={(e) => setQ(e.target.value)}  className="w-full h-10 md:h-9"  containerClassName="w-full" />
                      </form>
                    </div>
                  )}
                </div>
              </MobileFiltersDrawer>
            </div>
            
            <div className="flex items-center gap-2">
              <PrinterSyncBadge module="inventory" />
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
                selectedLocation={selectedLocation} />
            </TabsContent>
            
            <TabsContent value="locations">
              <InventoryLocationsTable siteId={currentSite?.id} />
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
