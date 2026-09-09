"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSite } from "@/app/context/SiteContext"
import { isDemoSiteId } from "@/lib/demo-utils"
import { Card, CardContent } from "@/app/components/ui/card"
import { Button } from "@/app/components/ui/button"
import { Skeleton } from "@/app/components/ui/skeleton"
import Image from "next/image"
import { toast } from "sonner"
import { Loader } from "@/app/components/ui/icons"

function SelectSiteContent() {
  const { sites, isLoading, setCurrentSite, error } = useSite()
  const router = useRouter()
  const searchParams = useSearchParams()
  const licenseKey = searchParams?.get('license')
  
  const [isApplying, setIsApplying] = useState(false)

  // Redirect if no license key is present
  useEffect(() => {
    if (!licenseKey && !isLoading) {
      router.push("/projects")
    }
  }, [licenseKey, isLoading, router])

  const realSites = (sites || []).filter((site) => !isDemoSiteId(site.id))

  const handleApplyLicense = async (siteId: string) => {
    if (!licenseKey) return
    
    setIsApplying(true)
    
    try {
      const response = await fetch('/api/partner-license/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ license_key: licenseKey, site_id: siteId }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast.success(`Lifetime plan successfully applied to project!`)
        
        // Select the site and go to robots
        const site = sites.find(s => s.id === siteId)
        if (site) {
          await setCurrentSite(site)
          // Adding a small delay ensures cookies/state settle
          setTimeout(() => router.push("/robots"), 500)
        } else {
          router.push("/robots")
        }
      } else {
        toast.error(data.error || "Failed to apply license")
        setIsApplying(false)
      }
    } catch (err) {
      console.error(err)
      toast.error("An unexpected error occurred. Please try again.")
      setIsApplying(false)
    }
  }

  const handleCreateNew = () => {
    // Pass the license along so the create-site process knows to apply it later
    router.push(`/create-site?applyLicense=${licenseKey}`)
  }

  const Content = useMemo(() => {
    if (isLoading) {
      return (
        <div className="w-full max-w-2xl mx-auto space-y-3 mt-6">
          {Array.from({ length: 2 }).map((_, idx) => (
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

    if (error) {
      return (
        <Card className="border-destructive/40 bg-destructive/5 mt-6 max-w-2xl mx-auto">
          <CardContent className="p-4 text-sm text-destructive">
            Could not load projects: {error.message}
          </CardContent>
        </Card>
      )
    }

    return (
      <div className="w-full max-w-2xl mx-auto space-y-4 mt-8">
        
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold tracking-tight">Select a Project</h2>
          <p className="text-muted-foreground mt-2">
            Where do you want to apply your Lifetime License?
          </p>
        </div>

        {realSites.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Your Projects</h3>
            {realSites.map(site => (
              <Card key={site.id} className="border border-border hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer" onClick={() => !isApplying && handleApplyLicense(site.id)}>
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
                      <h3 className="font-semibold truncate">{site.name}</h3>
                      <p className="text-sm text-muted-foreground truncate">{site.description || site.url || "No description"}</p>
                    </div>
                    <Button disabled={isApplying} onClick={(e) => { e.stopPropagation(); handleApplyLicense(site.id) }}>
                      {isApplying ? <Loader className="h-4 w-4 animate-spin" /> : "Apply Here"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}

        <div className="pt-4">
          <Card className="border border-dashed border-border hover:border-foreground/30 transition-colors cursor-pointer bg-transparent" onClick={handleCreateNew}>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                  <span className="text-lg">+</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">Create new project</h3>
                  <p className="text-sm text-muted-foreground truncate">Set up a new project to apply the license</p>
                </div>
                <Button variant="secondary" disabled={isApplying} onClick={(e) => { e.stopPropagation(); handleCreateNew() }}>
                  Create
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }, [isLoading, realSites, error, isApplying, handleApplyLicense])

  if (!licenseKey && !isLoading) return null

  return (
    <div className="min-h-[calc(100vh-var(--topbar-height,64px))] w-full flex flex-col items-center justify-center p-6 bg-slate-50/50 dark:bg-transparent">
      <div className="w-full max-w-2xl mx-auto">
        <div className="flex items-center justify-center mb-6">
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
        
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 text-center">
          <h3 className="text-emerald-800 dark:text-emerald-400 font-medium">✨ License Verified Successfully</h3>
          <p className="text-sm text-emerald-600 dark:text-emerald-500 mt-1">Your AppSumo lifetime license is ready to be applied.</p>
        </div>

        {Content}
      </div>
    </div>
  )
}

export default function SelectSitePage() {
  return (
    <Suspense fallback={<div className="min-h-screen w-full flex items-center justify-center"><Loader className="h-8 w-8 animate-spin text-primary" /></div>}>
      <SelectSiteContent />
    </Suspense>
  )
}
