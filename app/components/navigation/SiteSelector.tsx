"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu"
import { MenuAvatar, MenuAvatarFallback, MenuAvatarImage } from "../ui/menu-avatar"
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog"
import { cn } from "@/lib/utils"
import { Check, ChevronDown, Users, PlusCircle } from "@/app/components/ui/icons"
import { useSite } from "@/app/context/SiteContext"
import { useAuthContext } from "@/app/components/auth/auth-context"
import { useRouter } from "next/navigation"
import { assignLocation, navigateOrAssign } from "@/lib/navigation/stale-router"
import { useState } from "react"
import { SiteSelectorPlaceholder } from "./SiteSelectorPlaceholder"
import { useSiteListRecovery } from "./use-site-list-recovery"
import { useProjectListLogos } from "@/app/context/use-project-list-logos"
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
  isMobile?: boolean
}

function getInitials(name: string) {
  if (!name) return "…"
  const [first, second] = name.trim().split(/\s+/)
  return (second ? first.charAt(0) + second.charAt(0) : first.slice(0, 2)).toUpperCase()
}

export function SiteSelector({ isCollapsed = false, isMobile = false }: SiteSelectorProps) {
  const { sites, currentSite, setCurrentSite, requestScope, isLoading, refreshSites, error } = useSite()
  const { user, isLoading: authLoading } = useAuthContext()
  const authActorId = authLoading || user?.is_anonymous ? null : user?.id ?? null
  const router = useRouter()
  const { t } = useLocalization()
  const [filter, setFilter] = useState<'all' | 'owned' | 'shared' | 'demo'>('all')
  const [openScope, setOpenScope] = useState<string | null>(null)
  const isDemoMode = currentSite?.id.startsWith('demo-') === true
  // Either provider may observe an account change first. While they disagree,
  // display neither actor's label, actions, nor retry for the retiring load.
  const actorId = requestScope && requestScope.actorId !== authActorId ? null : authActorId
  const sameScope = !!actorId && !!currentSite && (isDemoMode || requestScope?.siteId === currentSite.id)
  const missingList = sameScope && sites.length === 0
  const recovery = useSiteListRecovery(
    missingList && !isLoading && actorId ? JSON.stringify([actorId, currentSite.id]) : null,
    () => refreshSites({ recoverMissingList: true }),
  )
  const menuScope = sameScope && !isLoading ? JSON.stringify([actorId, currentSite.id, isMobile]) : null
  if (openScope !== null && openScope !== menuScope) setOpenScope(null)
  const open = menuScope !== null && openScope === menuScope
  const handleOpenChange = (next: boolean) => {
    setOpenScope(next ? menuScope : null)
    if (next && missingList) recovery.retry()
  }
  const navigateFromSelector = (href: string) => {
    if (isMobile) handleOpenChange(false)
    navigateOrAssign(router, href)
  }
  const filteredSites = !open ? [] : sites.filter(site => {
    if (site.id.startsWith('demo-')) return isDemoMode && (filter === 'all' || filter === 'demo')
    return filter === 'all' || (filter === 'owned' && site.user_id === actorId) || (filter === 'shared' && site.user_id !== actorId)
  })
  const logos = useProjectListLogos(filteredSites, open && !isDemoMode ? actorId : null)

  // An optimistic or failed restore is not a selectable workspace. Keep this
  // branch separate from every menu action, including the collapsed tooltip.
  if (!sameScope || isLoading || !currentSite || currentSite.id === "default") {
    const expectedSiteId = currentSite?.id ?? requestScope?.siteId
    return (
      <SiteSelectorPlaceholder
        key={JSON.stringify([actorId, expectedSiteId])}
        actorId={actorId}
        currentSiteId={expectedSiteId}
        collapsed={isCollapsed}
        loading={authLoading || isLoading}
        failed={Boolean(error)}
        retry={() => refreshSites({ recoverMissingList: true })}
      />
    )
  }

  const triggerContent = (
    <div className={cn("flex items-center gap-3", isCollapsed ? "justify-center" : "w-full")}>
      <MenuAvatar className={isMobile ? "h-10 w-10" : "h-8 w-8"}>
        {currentSite.logo_url ? (
          <MenuAvatarImage src={currentSite.logo_url} alt={currentSite.name} />
        ) : (
          <MenuAvatarFallback>{getInitials(currentSite.name)}</MenuAvatarFallback>
        )}
      </MenuAvatar>
      {!isCollapsed && (
        <div className="flex flex-col min-w-0 flex-1 text-left">
          <span className="font-medium truncate">{currentSite.name}</span>
          <span className="text-xs text-muted-foreground truncate">
            {currentSite.url || (t('layout.sidebar.noUrl') || "No URL")}
          </span>
        </div>
      )}
      {isMobile && <ChevronDown size={18} className="text-muted-foreground" />}
    </div>
  )

  const desktopTrigger = isCollapsed ? (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={currentSite.name}
                      className={cn(
                        "flex items-center rounded-md px-3 py-2 text-sm transition-colors relative group cursor-pointer",
                        "justify-center h-[45px]"
                      )}
                    >
                      {triggerContent}
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  align="start"
                  sideOffset={5}
                  className="z-[9999] max-w-[min(280px,calc(100vw-4rem))]"
                >
                  <p className="font-medium truncate">
                    {currentSite.name ||
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
              <button
                type="button"
                aria-label={currentSite.name}
                className={cn(
                  "flex items-center rounded-md px-3 py-2 text-sm transition-colors relative group cursor-pointer",
                  "border dark:border-white/5 border-black/5 hover:dark:border-white/5 border-black/5/80 hover:bg-accent w-full"
                )}
              >
                {triggerContent}
              </button>
            </DropdownMenuTrigger>
  )

  const popup = (
    <>
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
              
              {isMobile ? <div className="my-2 border-t" /> : <DropdownMenuSeparator />}
              
              {missingList ? (
                <div className="space-y-2 px-2 py-3 text-sm">
                  <p role="status" className="text-muted-foreground">
                    {error ? "The project list could not be loaded. Your current project is still selected."
                      : "The project list is not available yet. Your current project is still selected."}
                  </p>
                  <Button variant="outline" size="sm" disabled={recovery.isRefreshing} onClick={recovery.retry}>
                    {recovery.isRefreshing ? "Loading projects…" : "Retry project list"}
                  </Button>
                   <Button variant="ghost" size="sm" onClick={() => navigateFromSelector("/projects")}>
                    Choose project
                  </Button>
                </div>
              ) : filteredSites.length === 0 ? (
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
                    const isShared = site.user_id !== actorId
                    const logo = site.logo_url === undefined ? logos?.[site.id] : site.logo_url
                     const Item = isMobile ? "button" : DropdownMenuItem
                    
                    return (
                       <Item
                        key={site.id}
                         type={isMobile ? "button" : undefined}
                         aria-current={isMobile && isSelected ? "true" : undefined}
                        className={cn(
                          "flex items-center gap-2 p-2 w-full relative rounded-sm",
                           isMobile && "min-h-14 gap-3 rounded-lg px-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
                           isMobile && !isSelected && "hover:bg-accent",
                          isSelected && "bg-primary text-primary-foreground focus:bg-primary focus:text-primary-foreground"
                        )}
                        onClick={() => {
                           if (isMobile) handleOpenChange(false)
                          if (site.id.startsWith('demo-')) {
                            // Set cookie that lasts for 24 hours
                            document.cookie = `market_fit_demo_site_id=${site.id}; path=/; max-age=86400`;
                            localStorage.setItem('currentSiteId', site.id);
                            localStorage.setItem('market_fit_manual_demo', 'true');
                            sessionStorage.setItem('preventAutoRefresh', 'true');
                            // Force reload to apply changes everywhere (Supabase client will re-initialize)
                            assignLocation("/robots");
                          } else {
                            // Remove demo cookie if switching to a real project
                            document.cookie = `market_fit_demo_site_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
                            localStorage.removeItem('market_fit_manual_demo');
                            
                            if (currentSite?.id.startsWith('demo-')) {
                              // We must reload the page if we are leaving demo mode, to re-initialize the real Supabase client
                              localStorage.setItem('currentSiteId', site.id);
                              assignLocation("/robots");
                            } else {
                              setCurrentSite(site)
                              navigateOrAssign(router, "/robots")
                            }
                          }
                        }}
                      >
                         <MenuAvatar className={cn("flex-shrink-0", isMobile ? "h-9 w-9" : "h-6 w-6")}>
                          {logo ? (
                            <MenuAvatarImage src={logo} alt={site.name} />
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
                       </Item>
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
                     onClick={() => navigateFromSelector("/demo")}
                  >
                    View Demo Accounts
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="default"
                    className="w-full text-xs text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                    onClick={() => {
                       if (isMobile) handleOpenChange(false)
                      document.cookie = `market_fit_demo_site_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
                      localStorage.removeItem('currentSiteId');
                      localStorage.removeItem('market_fit_manual_demo');
                      const baseUrl = window.location.hostname.startsWith('www.') ? window.location.origin.replace('www.', 'app.') : '';
                      assignLocation(`${baseUrl}/projects`);
                    }}
                  >
                    Exit Demo Mode
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="default"
                  className="w-full"
                  onClick={() => navigateFromSelector("/create-site")}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  {t('layout.sidebar.addNewProject') || 'Add New Project'}
                </Button>
              </div>
    </>
  )

  if (isMobile) return (
    <Dialog key={menuScope} open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button type="button" aria-label={currentSite.name}
          className="flex min-h-16 w-full min-w-0 items-center rounded-lg border px-3 py-2 text-left hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
          {triggerContent}
        </button>
      </DialogTrigger>
      <DialogContent size="md" data-site-selector-dialog aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t("layout.sidebar.switchProject")}</DialogTitle>
        </DialogHeader>
        <DialogBody className="px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {popup}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )

  return (
    <div className={cn("relative flex justify-center", !isCollapsed && "w-full")}>
      <div className={cn("relative", !isCollapsed && "w-[232px]")}>
        <DropdownMenu key={menuScope} open={open} onOpenChange={handleOpenChange}>
          {desktopTrigger}
          <DropdownMenuContent align={isCollapsed ? "start" : "center"} sideOffset={5} className="p-1 w-[280px]">
            {popup}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
} 