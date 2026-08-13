"use client"

import { Button } from "@/app/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Badge } from "@/app/components/ui/badge"
import { Filter, ChevronDown, Image, FileVideo, FileText, LayoutGrid, TableRows, ListOrdered, Check } from "@/app/components/ui/icons"
import { SearchInput } from "@/app/components/ui/search-input"
import React, { useState, Suspense } from "react"
import useSWR from "swr"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { getAssets, attachAssetToAgent, detachAssetFromAgent, getAgentAssets } from "@/app/assets/actions"
import { useSite } from "@/app/context/SiteContext"
import { toast } from "sonner"
import { useCommandK } from "@/app/hooks/use-command-k"
import { safeReload } from "@/app/utils/safe-reload"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSearchParams } from "next/navigation"
import { ToggleGroup, ToggleGroupItem } from "@/app/components/ui/toggle-group"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { AssetCardSkeleton } from "./components/AssetCardSkeleton"
import { AssetsTabBody } from "./components/AssetsTabBody"
import { isAssetCompatibleWithAgent, type AssetViewType } from "./components/asset-utils"

function AssetViewSelector({ currentView, onViewChange }: { currentView: AssetViewType, onViewChange: (view: AssetViewType) => void }) {
  return (
    <ToggleGroup type="single" value={currentView} onValueChange={(value: string) => value && onViewChange(value as AssetViewType)}>
      <ToggleGroupItem value="grid" aria-label="Toggle grid view" className="px-2">
        <LayoutGrid className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="list" aria-label="Toggle list view" className="px-2">
        <TableRows className="h-4 w-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

export default function AssetsPage() {
  return (
    <Suspense fallback={<AssetsLoadingPage />}>
      <AssetsContent />
    </Suspense>
  )
}

// Loading page component that doesn't use useSearchParams
function AssetsLoadingPage() {
  const { t } = useLocalization()
  return (
    <div className="flex-1 p-0">
      <Tabs defaultValue="all">
        <StickyHeader>
          <div className="w-full pt-0">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-8">
                  <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full">
                    <TabsTrigger value="all" className="text-xs rounded-full flex items-center justify-center gap-1.5" title={t('assets.tabs.all')}>
                      <LayoutGrid size={13} className="md:!hidden" />
                      <span className="tab-label">{t('assets.tabs.all')}</span>
                    </TabsTrigger>
                    <TabsTrigger value="images" className="text-xs rounded-full flex items-center justify-center gap-1.5" title={t('assets.tabs.images')}>
                      <Image size={13} className="md:!hidden" />
                      <span className="tab-label">{t('assets.tabs.images')}</span>
                    </TabsTrigger>
                    <TabsTrigger value="videos" className="text-xs rounded-full flex items-center justify-center gap-1.5" title={t('assets.tabs.videos')}>
                      <FileVideo size={13} className="md:!hidden" />
                      <span className="tab-label">{t('assets.tabs.videos')}</span>
                    </TabsTrigger>
                    <TabsTrigger value="documents" className="text-xs rounded-full flex items-center justify-center gap-1.5" title={t('assets.tabs.documents')}>
                      <FileText size={13} className="md:!hidden" />
                      <span className="tab-label">{t('assets.tabs.documents')}</span>
                    </TabsTrigger>
                  </TabsList>
                  <SearchInput 
                    placeholder={t('assets.searchPlaceholder')}
                    className="w-full"
                    disabled
                    alwaysExpanded={false}
                  />
              </div>
              <div className="ml-auto">
                {/* Any other buttons would go here */}
              </div>
            </div>
          </div>
        </StickyHeader>
        
        <div className="p-8 space-y-4 bg-muted/30 flex-1">
            <>
              <TabsContent value="all" className="mt-0 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <AssetCardSkeleton key={index} />
                  ))}
                </div>
              </TabsContent>
            </>
        </div>
      </Tabs>
    </div>
  )
}

// Content component that uses useSearchParams
function AssetsContent() {
  const { t } = useLocalization()
  const { currentSite, isLoading: isSiteLoading } = useSite()
  const [searchTerm, setSearchTerm] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [viewType, setViewType] = useState<AssetViewType>('grid')
  const [activeTab, setActiveTab] = useState<"all" | "images" | "videos" | "documents">("all")
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest")
  
  // Get agent ID from URL parameters
  const searchParams = useSearchParams()
  const agentId = searchParams.get('agent')
  const paramSiteId = searchParams.get('siteId')
  
  // Resolve effective site ID
  const effectiveSiteId = currentSite?.id || paramSiteId
  
  // Usar el hook de Command+K
  useCommandK()

  const { data: fetchedAssetsData, isLoading: isLoadingAssets, mutate: mutateAssets } = useSWR(
    effectiveSiteId && !isSiteLoading ? ['assets', effectiveSiteId] : null,
    async ([_, siteId]) => {
      const { assets: fetchedAssets, error } = await getAssets(siteId)
      if (error) throw new Error(error)
      
      return fetchedAssets?.map(asset => {
        const metadata = asset.metadata as { tags?: string[], thumbnail_url?: string, cover_url?: string } || {}
        return {
          ...asset,
          tags: metadata.tags || [],
          thumbnailUrl: metadata.thumbnail_url || metadata.cover_url,
          isAttachedToAgent: false
        }
      }) || []
    },
    {}
  )

  const { data: attachedAssetIdsData, mutate: mutateAttachedAssetIds } = useSWR(
    agentId ? ['agent-assets', agentId] : null,
    async ([_, aid]) => {
      const { assetIds, error } = await getAgentAssets(aid)
      if (error) throw new Error(error)
      return assetIds || []
    },
    {}
  )

  const attachedAssetIds = attachedAssetIdsData || []
  const isLoading = isLoadingAssets || isSiteLoading
  const error = !effectiveSiteId && !isSiteLoading ? "Por favor, selecciona un sitio primero" : null

  const assets = React.useMemo(() => {
    return (fetchedAssetsData || []).map(asset => ({
      ...asset,
      isAttachedToAgent: attachedAssetIds.includes(asset.id)
    }))
  }, [fetchedAssetsData, attachedAssetIds])

  const loadAssets = async () => {
    await mutateAssets()
    if (agentId) await mutateAttachedAssetIds()
  }

  // Handle attaching asset to agent
  const handleAttach = async (assetId: string) => {
    if (!agentId) return
    
    console.log("Attaching asset", assetId, "to agent", agentId)
    mutateAttachedAssetIds((current = []) => [...current, assetId], false)
    
    const { error } = await attachAssetToAgent(agentId, assetId)
    
    if (error) {
      console.error("Error attaching asset:", error)
      mutateAttachedAssetIds() // revert
      toast.error("Failed to attach asset to agent")
      return
    }
    
    toast.success("Asset attached to agent successfully")
  }
  
  // Handle detaching asset from agent
  const handleDetach = async (assetId: string) => {
    if (!agentId) return
    
    console.log("Detaching asset", assetId, "from agent", agentId)
    mutateAttachedAssetIds((current = []) => current.filter(id => id !== assetId), false)
    
    const { error } = await detachAssetFromAgent(agentId, assetId)
    
    if (error) {
      console.error("Error detaching asset:", error)
      mutateAttachedAssetIds() // revert
      toast.error("Failed to detach asset from agent")
      return
    }
    
    toast.success("Asset detached from agent successfully")
  }

  // Función para manejar la búsqueda
  const handleSearch = (term: string) => {
    setIsSearching(true)
    setSearchTerm(term)
    
    // Simulamos un pequeño retraso para mostrar el estado de búsqueda
    setTimeout(() => {
      setIsSearching(false)
    }, 300)
  }

  // Filter assets based on search term and agent compatibility
  let filteredAssets = assets.filter(asset => {
    // Search term filter
    const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    
    // If agentId is provided, only show compatible assets
    if (agentId) {
      return matchesSearch && isAssetCompatibleWithAgent(asset)
    }
    
    return matchesSearch
  })

  filteredAssets = filteredAssets.sort((a, b) => {
    const dateA = new Date(a.created_at || 0).getTime()
    const dateB = new Date(b.created_at || 0).getTime()
    return sortBy === "newest" ? dateB - dateA : dateA - dateB
  })

  const handleDeleteAsset = (assetId: string) => {
    mutateAssets(
      (current = []) => current.filter(a => a.id !== assetId),
      false
    )
  }

  // Si el sitio está cargando, mostramos el skeleton
  if (isSiteLoading || (isLoading && !error)) {
    return (
      <div className="flex-1 min-w-0 w-full p-0 min-h-[calc(100dvh-var(--topbar-height,64px))] flex flex-col">
        <Tabs defaultValue="all" className="flex-1 flex flex-col w-full h-full min-h-0">
          <StickyHeader>
            <div className="w-full pt-0">
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-8">
                  <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full">
                    <TabsTrigger value="all" className="text-xs rounded-full flex items-center justify-center gap-1.5" title={t('assets.tabs.all')}>
                      <LayoutGrid size={13} className="md:!hidden" />
                      <span className="tab-label">{t('assets.tabs.all')}</span>
                    </TabsTrigger>
                    <TabsTrigger value="images" className="text-xs rounded-full flex items-center justify-center gap-1.5" title={t('assets.tabs.images')}>
                      <Image size={13} className="md:!hidden" />
                      <span className="tab-label">{t('assets.tabs.images')}</span>
                    </TabsTrigger>
                    <TabsTrigger value="videos" className="text-xs rounded-full flex items-center justify-center gap-1.5" title={t('assets.tabs.videos')}>
                      <FileVideo size={13} className="md:!hidden" />
                      <span className="tab-label">{t('assets.tabs.videos')}</span>
                    </TabsTrigger>
                    <TabsTrigger value="documents" className="text-xs rounded-full flex items-center justify-center gap-1.5" title={t('assets.tabs.documents')}>
                      <FileText size={13} className="md:!hidden" />
                      <span className="tab-label">{t('assets.tabs.documents')}</span>
                    </TabsTrigger>
                  </TabsList>
                  <SearchInput 
                    data-command-k-input
                    placeholder={t('assets.searchPlaceholder')} 
                    className="w-full" 
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    alwaysExpanded={false}
                  />
                </div>
                <div className="ml-auto flex items-center gap-4">
                  {agentId && (
                    <div className="text-sm text-muted-foreground">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        Agent Mode: {agentId}
                      </Badge>
                    </div>
                  )}
                  <AssetViewSelector currentView={viewType} onViewChange={setViewType} />
                </div>
              </div>
            </div>
          </StickyHeader>
          
          <div className="p-8 space-y-4 bg-muted/30 flex-1">
              <>
                <TabsContent value="all" className="mt-0 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, index) => (
                      <AssetCardSkeleton key={index} />
                    ))}
                  </div>
                </TabsContent>
                <TabsContent value="images" className="mt-0 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <AssetCardSkeleton key={index} />
                    ))}
                  </div>
                </TabsContent>
                <TabsContent value="videos" className="mt-0 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <AssetCardSkeleton key={index} />
                    ))}
                  </div>
                </TabsContent>
                <TabsContent value="documents" className="mt-0 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <AssetCardSkeleton key={index} />
                    ))}
                  </div>
                </TabsContent>
              </>
          </div>
        </Tabs>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center space-y-4">
          <p className="text-red-500 mb-4">{error}</p>
          <Button 
            variant="outline" 
            onClick={() => safeReload(false, 'Assets page error retry')}
          >
            Intentar nuevamente
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 min-w-0 w-full p-0 min-h-[calc(100dvh-var(--topbar-height,64px))] flex flex-col">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "all" | "images" | "videos" | "documents")} className="flex-1 flex flex-col w-full h-full min-h-0">
        <StickyHeader>
          <div className="w-full pt-0">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-8">
                <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full">
                  <TabsTrigger value="all" className="text-xs rounded-full flex items-center justify-center gap-1.5" title={agentId ? (t('assets.tabs.compatible') || 'Compatible Assets') : t('assets.tabs.all')}>
                    <LayoutGrid size={13} className="md:!hidden" />
                    <span className="tab-label">{agentId ? (t('assets.tabs.compatible') || 'Compatible Assets') : t('assets.tabs.all')}</span>
                  </TabsTrigger>
                  <TabsTrigger value="images" className="text-xs rounded-full flex items-center justify-center gap-1.5" title={t('assets.tabs.images')}>
                    <Image size={13} className="md:!hidden" />
                    <span className="tab-label">{t('assets.tabs.images')}</span>
                  </TabsTrigger>
                  <TabsTrigger value="videos" className="text-xs rounded-full flex items-center justify-center gap-1.5" title={t('assets.tabs.videos')}>
                    <FileVideo size={13} className="md:!hidden" />
                    <span className="tab-label">{t('assets.tabs.videos')}</span>
                  </TabsTrigger>
                  <TabsTrigger value="documents" className="text-xs rounded-full flex items-center justify-center gap-1.5" title={t('assets.tabs.documents')}>
                    <FileText size={13} className="md:!hidden" />
                    <span className="tab-label">{t('assets.tabs.documents')}</span>
                  </TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-2">
                  <SearchInput 
                    data-command-k-input
                    placeholder={t('assets.searchPlaceholder')} 
                    className="w-full" 
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    alwaysExpanded={false}
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary" size="icon" className="h-9 w-9 rounded-full">
                        <Filter className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-44">
                      <DropdownMenuItem className="cursor-pointer" onClick={() => setActiveTab("all")}>
                        <Check className={cn("mr-2 h-4 w-4", activeTab === "all" ? "opacity-100" : "opacity-0")} />
                        {agentId ? (t('assets.tabs.compatible') || 'Compatible Assets') : t('assets.tabs.all')}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer" onClick={() => setActiveTab("images")}>
                        <Check className={cn("mr-2 h-4 w-4", activeTab === "images" ? "opacity-100" : "opacity-0")} />
                        {t('assets.tabs.images')}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer" onClick={() => setActiveTab("videos")}>
                        <Check className={cn("mr-2 h-4 w-4", activeTab === "videos" ? "opacity-100" : "opacity-0")} />
                        {t('assets.tabs.videos')}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer" onClick={() => setActiveTab("documents")}>
                        <Check className={cn("mr-2 h-4 w-4", activeTab === "documents" ? "opacity-100" : "opacity-0")} />
                        {t('assets.tabs.documents')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary" size="sm" className="h-9 gap-2 rounded-full px-4" title="Sort by">
                        <ListOrdered className="h-4 w-4" />
                        <span className="hidden sm:inline font-normal">
                          {sortBy === "newest" ? "Newest" : "Oldest"}
                        </span>
                        <ChevronDown className="h-3 w-3 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-40">
                      <DropdownMenuItem className="cursor-pointer" onClick={() => setSortBy("newest")}>
                        <Check className={cn("mr-2 h-4 w-4", sortBy === "newest" ? "opacity-100" : "opacity-0")} />
                        Newest
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer" onClick={() => setSortBy("oldest")}>
                        <Check className={cn("mr-2 h-4 w-4", sortBy === "oldest" ? "opacity-100" : "opacity-0")} />
                        Oldest
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <div className="ml-auto flex items-center gap-4">
                {agentId && (
                  <div className="text-sm text-muted-foreground">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      Agent Mode: {agentId}
                    </Badge>
                  </div>
                )}
                <AssetViewSelector currentView={viewType} onViewChange={setViewType} />
              </div>
            </div>
          </div>
        </StickyHeader>
        
        <div className="p-8 space-y-4 bg-muted/30 flex-1">
            {(["all", "images", "videos", "documents"] as const).map((tab) => (
              <AssetsTabBody
                key={tab}
                tab={tab}
                assets={filteredAssets}
                viewType={viewType}
                agentId={agentId || undefined}
                onDelete={handleDeleteAsset}
                onAttach={handleAttach}
                onDetach={handleDetach}
              />
            ))}
        </div>
      </Tabs>
    </div>
  )
}
