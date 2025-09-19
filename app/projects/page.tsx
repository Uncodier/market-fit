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

  // If a current site is selected, go to dashboard
  useEffect(() => {
    if (!isLoading && currentSite?.id) {
      router.push("/dashboard")
    }
  }, [isLoading, currentSite?.id, router])

  const handleSelectSite = async (siteId: string) => {
    const site = sites.find(s => s.id === siteId)
    if (!site) return
    await setCurrentSite(site)
    router.push("/dashboard")
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

    return (
      <div className="w-full max-w-2xl mx-auto space-y-3">
        {sites.map(site => (
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


