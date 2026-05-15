"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from "../ui/dropdown-menu"
import { MenuAvatar, MenuAvatarFallback, MenuAvatarImage } from "../ui/menu-avatar"
import { cn } from "@/lib/utils"
import { Check, Users, PlusCircle } from "@/app/components/ui/icons"
import { useSite } from "@/app/context/SiteContext"
import { useAuth } from "@/app/hooks/use-auth"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Site } from "@/app/context/SiteContext"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Button } from "../ui/button"
import { useLocalization } from "@/app/context/LocalizationContext"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/app/components/ui/tooltip"

interface SiteSelectorProps {
  isCollapsed?: boolean
}

export function SiteSelector({ isCollapsed = false }: SiteSelectorProps) {
  const { sites, currentSite, setCurrentSite, isLoading, refreshSites } = useSite()
  const { user } = useAuth()
  const router = useRouter()
  const { t } = useLocalization()
  const [isMounted, setIsMounted] = useState(false)
  const [filter, setFilter] = useState<'all' | 'owned' | 'shared' | 'demo'>('all')
  
  // Get current user ID from auth session
  const currentUserId = user?.id
  
  // Separate sites into owned and shared using the current user ID from auth
  const ownedSites = sites.filter(site => site.user_id === currentUserId && !site.id.startsWith('demo-'))
  const sharedSites = sites.filter(site => site.user_id !== currentUserId && !site.id.startsWith('demo-'))
  const demoSites = sites.filter(site => site.id.startsWith('demo-'))
  
  const isDemoMode = currentSite?.id.startsWith('demo-') || false
  
  // Filtered sites based on selection
  const filteredSites = filter === 'all' 
    ? (isDemoMode ? sites : sites.filter(site => !site.id.startsWith('demo-'))) 
    : filter === 'owned' 
      ? ownedSites 
      : filter === 'shared'
        ? sharedSites
        : demoSites
  
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Separate useEffect for site selection logic with more careful conditions
  useEffect(() => {
    // Only auto-select if:
    // 1. Component is mounted
    // 2. Sites are available
    // 3. No current site is set
    // 4. Not currently loading
    // 5. No saved site ID in localStorage (to avoid overriding user selection)
    if (isMounted && sites.length > 0 && !currentSite && !isLoading) {
      const savedSiteId = typeof window !== 'undefined' ? localStorage.getItem('currentSiteId') : null
      
      if (!savedSiteId) {
        console.log("🔧 SiteSelector: No current site and no saved site ID. Auto-selecting first site:", sites[0].name)
        setCurrentSite(sites[0])
      } else {
        console.log("🔧 SiteSelector: Found saved site ID, letting SiteContext handle selection:", savedSiteId)
      }
    }
  }, [isMounted, sites, currentSite, setCurrentSite, isLoading])

  const getInitials = (name: string) => {
    if (!name) return "..."
    const words = name.split(" ")
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
    return (words[0][0] + words[1][0]).toUpperCase()
  }

  // Skeleton loader para el estado inicial
  const SkeletonContent = () => (
    <div className="flex items-center gap-3">
      <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full font-inter animate-pulse" />
      {!isCollapsed && (
        <div className="flex flex-col min-w-0 flex-1">
          <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
          <div className="h-3 w-16 bg-gray-100 rounded mt-1 animate-pulse" />
        </div>
      )}
    </div>
  )

  // Contenido principal cuando está montado
  const MainContent = () => {
    // Si no hay sitio actual o está en estado de carga, mostrar skeleton
    if (!currentSite || currentSite.id === "default" || isLoading) {
      return <SkeletonContent />
    }

    return (
      <div className={cn(
        "flex items-center gap-3",
        isCollapsed ? "justify-center" : "w-full"
      )}>
        <MenuAvatar className="h-8 w-8">
          {currentSite.logo_url ? (
            <MenuAvatarImage src={currentSite.logo_url} alt={currentSite.name} />
          ) : (
            <MenuAvatarFallback>
              {getInitials(currentSite.name)}
            </MenuAvatarFallback>
          )}
        </MenuAvatar>
        
        {!isCollapsed && (
          <div className="flex flex-col min-w-0 flex-1">
            <span className="font-medium truncate">{currentSite.name}</span>
            <span className="text-xs text-muted-foreground truncate">
              {currentSite.url || (t('layout.sidebar.noUrl') || "No URL")}
            </span>
          </div>
        )}
      </div>
    )
  }

  // Si no hay sitios disponibles, mostrar botón para crear uno nuevo
  if (isMounted && !isLoading && sites.length === 0) {
    return (
      <div className="flex justify-center w-full">
        <div 
          className={cn(
            "flex items-center gap-2 p-2 rounded-md border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 cursor-pointer transition-colors",
            isCollapsed ? "justify-center" : "px-3 py-2 w-[232px]"
          )}
          onClick={() => router.push("/create-site")}
        >
          <div className="h-6 w-6 flex items-center justify-center rounded-full font-inter font-bold bg-blue-100 text-blue-600 flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </div>
          {!isCollapsed && (
            <span className="text-sm font-medium flex-1">{t('layout.sidebar.createFirstProject') || 'Create your first project'}</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      "relative flex justify-center",
      !isCollapsed && "w-full"
    )}>
      <div className={cn(
        "relative",
        !isCollapsed && "w-[232px]"
      )}>
        <DropdownMenu>
          {isCollapsed ? (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <div
                      className={cn(
                        "flex items-center rounded-md px-3 py-2 text-sm transition-colors relative group cursor-pointer",
                        "justify-center h-[45px]",
                        isLoading && "opacity-50 cursor-wait"
                      )}
                    >
                      {!isMounted ? <SkeletonContent /> : <MainContent />}
                    </div>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  align="start"
                  sideOffset={5}
                  className="z-[9999] max-w-[min(280px,calc(100vw-4rem))]"
                >
                  <p className="font-medium truncate">
                    {currentSite?.name ||
                      t("layout.category.project") ||
                      "Project"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("layout.sidebar.switchProject")}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <DropdownMenuTrigger asChild>
              <div
                className={cn(
                  "flex items-center rounded-md px-3 py-2 text-sm transition-colors relative group cursor-pointer",
                  "border dark:border-white/5 border-black/5 hover:dark:border-white/5 border-black/5/80 hover:bg-accent w-full",
                  isLoading && "opacity-50 cursor-wait"
                )}
              >
                {!isMounted ? <SkeletonContent /> : <MainContent />}
              </div>
            </DropdownMenuTrigger>
          )}
          {isMounted && !isLoading && sites.length > 0 && (
            <DropdownMenuContent 
              align={isCollapsed ? "start" : "center"}
              sideOffset={5}
              className="p-1 w-[280px]"
            >
              {/* Project filters */}
              <div className="px-2 py-1.5 mb-1">
                <Tabs 
                  defaultValue="all" 
                  value={filter}
                  onValueChange={(value) => setFilter(value as 'all' | 'owned' | 'shared' | 'demo')}
                >
                  <TabsList className="w-full flex">
                    <TabsTrigger value="all" className="flex-1 text-xs px-1 min-w-0">
                      <span className="truncate w-full text-center">{t('layout.sidebar.all') || 'All'}</span>
                    </TabsTrigger>
                    <TabsTrigger value="owned" className="flex-1 text-xs px-1 min-w-0">
                      <span className="truncate w-full text-center">{t('layout.sidebar.myProjects') || 'My'}</span>
                    </TabsTrigger>
                    <TabsTrigger value="shared" className="flex-1 text-xs px-1 min-w-0">
                      <span className="truncate w-full text-center">{t('layout.sidebar.shared') || 'Shared'}</span>
                    </TabsTrigger>
                    {isDemoMode && (
                      <TabsTrigger value="demo" className="flex-1 text-xs px-1 min-w-0">
                        <span className="truncate w-full text-center">Demo</span>
                      </TabsTrigger>
                    )}
                  </TabsList>
                </Tabs>
              </div>
              
              <DropdownMenuSeparator />
              
              {filteredSites.length === 0 ? (
                <div className="px-2 py-3 text-center text-sm text-muted-foreground">
                  {filter === 'shared' ? (
                    <div className="flex flex-col items-center gap-2">
                      <Users className="h-5 w-5 text-muted-foreground/70" />
                      <p>{t('layout.sidebar.noSharedProjects') || 'No shared projects'}</p>
                    </div>
                  ) : (
                    <p>{t('layout.sidebar.noProjectsFound') || 'No projects found'}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredSites.map((site) => {
                    const isSelected = site.id === currentSite?.id
                    const isShared = site.user_id !== currentUserId
                    
                    return (
                      <DropdownMenuItem
                        key={site.id}
                        className={cn(
                          "flex items-center gap-2 p-2 w-full relative rounded-sm",
                          isSelected && "bg-primary text-primary-foreground focus:bg-primary focus:text-primary-foreground"
                        )}
                        onClick={() => {
                          if (site.id.startsWith('demo-')) {
                            // Set cookie that lasts for 24 hours
                            document.cookie = `market_fit_demo_site_id=${site.id}; path=/; max-age=86400`;
                            localStorage.setItem('currentSiteId', site.id);
                            localStorage.setItem('market_fit_manual_demo', 'true');
                            sessionStorage.setItem('preventAutoRefresh', 'true');
                            // Force reload to apply changes everywhere (Supabase client will re-initialize)
                            window.location.href = "/robots";
                          } else {
                            // Remove demo cookie if switching to a real project
                            document.cookie = `market_fit_demo_site_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
                            localStorage.removeItem('market_fit_manual_demo');
                            
                            if (currentSite?.id.startsWith('demo-')) {
                              // We must reload the page if we are leaving demo mode, to re-initialize the real Supabase client
                              localStorage.setItem('currentSiteId', site.id);
                              window.location.href = "/robots";
                            } else {
                              setCurrentSite(site)
                              router.push("/robots")
                            }
                          }
                        }}
                      >
                        <MenuAvatar className="h-6 w-6 flex-shrink-0">
                          {site.logo_url ? (
                            <MenuAvatarImage src={site.logo_url} alt={site.name} />
                          ) : (
                            <MenuAvatarFallback className="text-xs">
                              {getInitials(site.name)}
                            </MenuAvatarFallback>
                          )}
                        </MenuAvatar>
                        <div className="flex flex-col flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-medium truncate">{site.name}</span>
                            {isShared && (
                              <span className={cn(
                                "px-1.5 py-0.5 text-xs rounded-md flex-shrink-0",
                                isSelected 
                                  ? "bg-primary-foreground/20 text-primary-foreground" 
                                  : "bg-blue-100 text-blue-700"
                              )}>
                                {t('layout.sidebar.shared') || 'Shared'}
                              </span>
                            )}
                          </div>
                          <span className={cn(
                            "text-xs truncate",
                            isSelected ? "text-primary-foreground/70" : "text-muted-foreground"
                          )}>
                            {site.url || (t('layout.sidebar.noUrl') || "No URL")}
                          </span>
                        </div>
                        {isSelected && (
                          <Check className="h-4 w-4 text-primary-foreground flex-shrink-0" />
                        )}
                      </DropdownMenuItem>
                    )
                  })}
                </div>
              )}
              
              <div className="h-px bg-border my-1" />
              
              <div className="p-2 flex flex-col gap-2">
                {!isDemoMode ? (
                  <Button
                    variant="outline"
                    size="default"
                    className="w-full text-xs"
                    onClick={() => router.push("/demo")}
                  >
                    View Demo Accounts
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="default"
                    className="w-full text-xs text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                    onClick={() => {
                      document.cookie = `market_fit_demo_site_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
                      localStorage.removeItem('currentSiteId');
                      localStorage.removeItem('market_fit_manual_demo');
                      window.location.href = "/projects";
                    }}
                  >
                    Exit Demo Mode
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="default"
                  className="w-full"
                  onClick={() => router.push("/create-site")}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  {t('layout.sidebar.addNewProject') || 'Add New Project'}
                </Button>
              </div>
            </DropdownMenuContent>
          )}
        </DropdownMenu>
      </div>
    </div>
  )
} 