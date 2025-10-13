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

interface SiteSelectorProps {
  isCollapsed?: boolean
}

export function SiteSelector({ isCollapsed = false }: SiteSelectorProps) {
  const { sites, currentSite, setCurrentSite, isLoading, refreshSites } = useSite()
  const { user } = useAuth()
  const router = useRouter()
  const [isMounted, setIsMounted] = useState(false)
  const [filter, setFilter] = useState<'all' | 'owned' | 'shared'>('all')
  
  // Get current user ID from auth session
  const currentUserId = user?.id
  
  // Separate sites into owned and shared using the current user ID from auth
  const ownedSites = sites.filter(site => site.user_id === currentUserId)
  const sharedSites = sites.filter(site => site.user_id !== currentUserId)
  
  // Filtered sites based on selection
  const filteredSites = filter === 'all' 
    ? sites 
    : filter === 'owned' 
      ? ownedSites 
      : sharedSites
  
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
      <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full animate-pulse" />
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
              {currentSite.url || "Sin URL"}
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
          <div className="h-6 w-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </div>
          {!isCollapsed && (
            <span className="text-sm font-medium flex-1">Create your first project</span>
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
          <DropdownMenuTrigger asChild>
            <div className={cn(
              "flex items-center rounded-md px-3 py-2 text-sm transition-colors relative group cursor-pointer",
              !isCollapsed && "border border-border hover:border-border/80 hover:bg-accent w-full",
              isCollapsed && "justify-center h-[45px]",
              isLoading && "opacity-50 cursor-wait"
            )}>
              {!isMounted ? <SkeletonContent /> : <MainContent />}
            </div>
          </DropdownMenuTrigger>
          {isMounted && !isLoading && sites.length > 0 && (
            <DropdownMenuContent 
              align={isCollapsed ? "start" : "center"}
              sideOffset={5}
              className={cn(
                "p-1 min-w-[240px]",
                isCollapsed ? "w-[240px]" : "w-[232px]"
              )}
            >
              {/* Project filters */}
              <div className="px-2 py-1.5 mb-1">
                <Tabs 
                  defaultValue="all" 
                  value={filter}
                  onValueChange={(value) => setFilter(value as 'all' | 'owned' | 'shared')}
                >
                  <TabsList className="w-full">
                    <TabsTrigger value="all" className="flex-1 text-xs">
                      All
                    </TabsTrigger>
                    <TabsTrigger value="owned" className="flex-1 text-xs">
                      My Projects
                    </TabsTrigger>
                    <TabsTrigger value="shared" className="flex-1 text-xs">
                      Shared
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              
              <DropdownMenuSeparator />
              
              {filteredSites.length === 0 ? (
                <div className="px-2 py-3 text-center text-sm text-muted-foreground">
                  {filter === 'shared' ? (
                    <div className="flex flex-col items-center gap-2">
                      <Users className="h-5 w-5 text-muted-foreground/70" />
                      <p>No shared projects</p>
                    </div>
                  ) : (
                    <p>No projects found</p>
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
                          isSelected && "bg-gradient-primary text-white"
                        )}
                        onClick={() => {
                          setCurrentSite(site)
                          router.push("/dashboard")
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
                                  ? "bg-white/20 text-gray-900" 
                                  : "bg-blue-100 text-blue-700"
                              )}>
                                Shared
                              </span>
                            )}
                          </div>
                          <span className={cn(
                            "text-xs truncate",
                            isSelected ? "text-white/70" : "text-muted-foreground"
                          )}>
                            {site.url || "No URL"}
                          </span>
                        </div>
                        {isSelected && (
                          <Check className="h-4 w-4 text-white flex-shrink-0" />
                        )}
                      </DropdownMenuItem>
                    )
                  })}
                </div>
              )}
              
              <div className="h-px bg-border my-1" />
              
              <div className="p-2 flex justify-center">
                <Button
                  variant="secondary"
                  size="default"
                  className="w-full"
                  onClick={() => router.push("/create-site")}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add New Project
                </Button>
              </div>
            </DropdownMenuContent>
          )}
        </DropdownMenu>
      </div>
    </div>
  )
} 