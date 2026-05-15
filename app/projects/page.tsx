"use client"

import { useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useSite } from "../context/SiteContext"
import { Card, CardContent } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Skeleton } from "../components/ui/skeleton"
import { Badge } from "../components/ui/badge"
import Image from "next/image"

export default function ProjectsPage() {
  const { sites, currentSite, isLoading, setCurrentSite } = useSite()
  const router = useRouter()

  const hasSites = (sites?.length || 0) > 0

  // If a current site is selected, go to AI Agents (robots)
  useEffect(() => {
    if (!isLoading && currentSite?.id) {
      router.push("/robots")
    }
  }, [isLoading, currentSite?.id, router])

  const handleSelectSite = async (siteId: string) => {
    const site = sites.find(s => s.id === siteId)
    if (!site) return
    await setCurrentSite(site)
    router.push("/robots")
  }

  const Content = useMemo(() => {
    if (isLoading) {
      return (
        <div className="w-full max-w-2xl mx-auto space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Card key={idx} className="border border-border overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                  <Skeleton className="h-9 w-24 rounded-md" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )
    }

    if (!hasSites) {
      return (
        <div className="w-full max-w-2xl mx-auto space-y-3">
          <Card className="border border-border hover:border-foreground/20 transition-colors cursor-pointer" onClick={() => router.push("/create-site") }>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                  <span className="text-lg">+</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">Create new project</h3>
                  <p className="text-sm text-muted-foreground truncate">Set up a new project and start working</p>
                </div>
                <Button variant="secondary" onClick={(e) => { e.stopPropagation(); router.push("/create-site") }}>Create</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    const isDemoMode = currentSite?.id.startsWith('demo-') || false;
    const filteredSites = isDemoMode ? sites : sites.filter(site => !site.id.startsWith('demo-'));

    return (
      <div className="w-full max-w-2xl mx-auto space-y-3">
        {filteredSites.map(site => (
          <Card key={site.id} className="border border-border hover:border-foreground/20 transition-colors cursor-pointer" onClick={() => handleSelectSite(site.id)}>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-md bg-muted overflow-hidden flex items-center justify-center">
                  {site.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={site.logo_url} alt={site.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-sm font-medium">{site.name?.charAt(0)?.toUpperCase() || "P"}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{site.name}</h3>
                    {currentSite?.id === site.id && (
                      <Badge variant="secondary" className="h-5 px-2 text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-0">Current</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{site.description || site.url || "No description"}</p>
                </div>
                <Button variant="secondary" onClick={(e) => { e.stopPropagation(); handleSelectSite(site.id) }}>Select</Button>
              </div>
            </CardContent>
          </Card>
        ))}

        <Card className="border border-border hover:border-foreground/20 transition-colors cursor-pointer" onClick={() => router.push("/create-site") }>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                <span className="text-lg">+</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">Create new project</h3>
                <p className="text-sm text-muted-foreground truncate">Set up a new project and start working</p>
              </div>
              <Button variant="secondary" onClick={(e) => { e.stopPropagation(); router.push("/create-site") }}>Create</Button>
            </div>
          </CardContent>
        </Card>

        {isDemoMode && (
          <Card className="border border-amber-200 bg-amber-50 hover:border-amber-300 transition-colors cursor-pointer" onClick={() => {
            document.cookie = `market_fit_demo_site_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
            localStorage.removeItem('currentSiteId');
            localStorage.removeItem('market_fit_manual_demo');
            window.location.href = "/projects";
          }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-md bg-amber-100 flex items-center justify-center text-amber-700">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-amber-900 truncate">Exit Demo Mode</h3>
                  <p className="text-sm text-amber-700/80 truncate">Return to your real projects and data</p>
                </div>
                <Button variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100" onClick={(e) => { 
                  e.stopPropagation(); 
                  document.cookie = `market_fit_demo_site_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
                  localStorage.removeItem('currentSiteId');
                  localStorage.removeItem('market_fit_manual_demo');
                  window.location.href = "/projects";
                }}>Exit Demo</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!isDemoMode && (
          <Card className="border border-border hover:border-foreground/20 transition-colors cursor-pointer" onClick={() => router.push("/demo") }>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">View demo accounts</h3>
                  <p className="text-sm text-muted-foreground truncate">Explore platform features with sample data</p>
                </div>
                <Button variant="outline" onClick={(e) => { e.stopPropagation(); router.push("/demo") }}>View Demos</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }, [isLoading, hasSites, sites, currentSite?.id, router])

  return (
    <div className="min-h-[calc(100vh-64px)] w-full flex items-center justify-center p-6">
      <div className="w-full">
        <div className="flex items-center justify-center mb-8">
          <div className="p-3 rounded-full bg-primary/10">
            <Image 
              src="/images/logo.png"
              alt="Market Fit Logo"
              width={48}
              height={48}
              className="h-12 w-12 object-contain"
              priority
            />
          </div>
        </div>
        {Content}
      </div>
    </div>
  )
}


