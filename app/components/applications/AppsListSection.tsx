"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Database, ExternalLink, ArrowRight } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"

import { ViewType } from "@/app/components/view-selector"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { formatDistanceToNow } from "date-fns"

interface TenantRecord {
  requirement_id: string
  tenant_id: string
  schema: string
  bucket: string | null
}

interface RequirementRecord {
  id: string
  title: string
  status: string
}

interface TenantApp extends RequirementRecord {
  apps_tenants: Omit<TenantRecord, "requirement_id">[]
  preview_url?: string | null
  instance_id?: string | null
  last_instance_log?: { message: string, created_at: string } | null
  detailsLoading?: boolean
}

interface AppsListSectionProps {
  searchQuery?: string
  viewMode?: ViewType
}

export function AppsListSection({ searchQuery = "", viewMode = "kanban" }: AppsListSectionProps) {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const router = useRouter()
  
  const [apps, setApps] = useState<TenantApp[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchTenants() {
      if (!currentSite?.id) return

      setLoading(true)

      try {
        const response = await fetch(`/api/applications/tenants?siteId=${currentSite.id}`)
        const data = await response.json()

        if (!response.ok) {
          console.error("Error fetching tenants:", data.error)
          if (!cancelled) {
            setApps([])
            setLoading(false)
          }
          return
        }

        if (!cancelled) {
          // Initialize apps with detailsLoading true
          const initialApps = (data.tenants || []).map((app: any) => ({
            ...app,
            detailsLoading: true,
            preview_url: null,
            instance_id: null,
            last_instance_log: null
          }))
          setApps(initialApps)
          setLoading(false)

          // Fetch extra details asynchronously
          if (initialApps.length > 0) {
            const reqIds = initialApps.map((a: any) => a.id)
            fetch('/api/applications/requirements-details', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ requirementIds: reqIds })
            })
            .then(res => res.json())
            .then(detailsData => {
              if (!cancelled && detailsData.details) {
                setApps(currentApps => currentApps.map(app => ({
                  ...app,
                  detailsLoading: false,
                  preview_url: detailsData.details[app.id]?.preview_url || null,
                  instance_id: detailsData.details[app.id]?.instance_id || null,
                  last_instance_log: detailsData.details[app.id]?.last_instance_log || null
                })))
              } else if (!cancelled) {
                setApps(currentApps => currentApps.map(app => ({ ...app, detailsLoading: false })))
              }
            })
            .catch(err => {
              console.error("Error fetching requirement details:", err)
              if (!cancelled) {
                setApps(currentApps => currentApps.map(app => ({ ...app, detailsLoading: false })))
              }
            })
          }
        }
      } catch (error) {
        console.error("Error fetching tenants:", error)
        if (!cancelled) {
          setApps([])
          setLoading(false)
        }
      }
    }

    fetchTenants()

    return () => {
      cancelled = true
    }
  }, [currentSite?.id])

  if (loading) {
    return (
      <div className={viewMode === "table" ? "space-y-4" : "grid gap-4 md:grid-cols-2"}>
        <Skeleton className="h-[120px] w-full rounded-lg" />
        <Skeleton className="h-[120px] w-full rounded-lg" />
      </div>
    )
  }

  const filteredApps = apps.filter(app => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      app.title.toLowerCase().includes(query) ||
      app.id.toLowerCase().includes(query) ||
      (app.preview_url && app.preview_url.toLowerCase().includes(query))
    )
  })

  if (filteredApps.length === 0) {
    return (
      <EmptyCard 
        variant="fancy" 
        icon={<Database />}
        title={apps.length === 0 
          ? (t("applications.noTenantsFound") || "No tenant databases found")
          : (t("applications.noSearchMatch") || "No matching databases found")}
        description={apps.length === 0 
          ? (t("applications.tenantsCreatedAuto") || "Tenants are created automatically when requirements are built.")
          : (t("applications.tryAdjustingSearch") || "Try adjusting your search terms.")}
      />
    )
  }

  return (
    <div className={viewMode === "table" ? "space-y-2" : "grid gap-4 md:grid-cols-2"}>
      {filteredApps.map((app) => {
        const tenant = app.apps_tenants[0]
        
        if (viewMode === "table") {
          return (
            <Card 
              key={app.id} 
              className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all duration-200 overflow-hidden"
              onClick={() => router.push(`/applications/database/${tenant.tenant_id}?schema=${tenant.schema}`)}
            >
              <div className="flex items-stretch hover:bg-muted/50 transition-colors w-full h-full">
                <CardContent className="flex-1 p-4 w-full overflow-x-auto h-full flex flex-col justify-center">
                  <div className="flex items-center gap-6 min-w-[800px] h-full">
                    <div className="w-[280px] min-w-[280px] flex-grow space-y-1.5 border-r pr-6 h-full flex flex-col justify-center">
                      <h3 className="font-semibold text-base leading-tight truncate">{app.title}</h3>
                      <p className="text-sm font-mono text-muted-foreground/80">Req: {app.id.slice(0, 8)}</p>
                    </div>
                    
                    <div className="w-[100px] min-w-[100px] flex-shrink-0 flex flex-col items-center gap-2 border-r pr-6 h-full justify-center">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Status</p>
                      <Badge variant={app.status === 'completed' ? 'default' : 'secondary'} className="capitalize">
                        {app.status}
                      </Badge>
                    </div>
                    
                    <div className="flex-1 min-w-[300px] h-full flex flex-col justify-center">
                      <div className="flex flex-col gap-3 h-full justify-center text-xs bg-muted/40 p-3 rounded-md">
                        {app.detailsLoading ? (
                          <div className="flex items-center gap-6">
                            <div className="flex-1 space-y-3">
                              <div className="space-y-1.5">
                                <span className="text-muted-foreground font-medium uppercase tracking-wider text-[10px]">Preview URL</span>
                                <Skeleton className="h-4 w-64" />
                              </div>
                              <div className="space-y-1.5">
                                <span className="text-muted-foreground font-medium uppercase tracking-wider text-[10px]">Last Update</span>
                                <div className="space-y-1.5 flex-1">
                                  <Skeleton className="h-4 w-full" />
                                  <Skeleton className="h-4 w-2/3" />
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col gap-2 min-w-[140px]">
                              <Skeleton className="h-8 w-full" />
                              <Skeleton className="h-8 w-full" />
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-6">
                            <div className="flex-1 space-y-4">
                              <div className="space-y-1">
                                <span className="text-muted-foreground font-medium uppercase tracking-wider text-[10px] block">Preview URL</span>
                                {app.preview_url ? (
                                  <div className="flex items-center gap-2">
                                    <a 
                                      href={app.preview_url} 
                                      target="_blank" 
                                      rel="noreferrer"
                                      className="font-medium text-primary hover:underline truncate"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {app.preview_url}
                                    </a>
                                    <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                                  </div>
                                ) : (
                                  <div className="text-muted-foreground italic">Not available</div>
                                )}
                              </div>

                              <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground font-medium uppercase tracking-wider text-[10px]">Last Update</span>
                                  {app.last_instance_log && (
                                    <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                      {formatDistanceToNow(new Date(app.last_instance_log.created_at), { addSuffix: true })}
                                    </span>
                                  )}
                                </div>
                                {app.last_instance_log ? (
                                  <div className="line-clamp-2 text-foreground/80 leading-relaxed" title={app.last_instance_log.message}>
                                    {app.last_instance_log.message}
                                  </div>
                                ) : (
                                  <div className="text-muted-foreground italic">No logs available</div>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex flex-col gap-2 min-w-[140px] shrink-0">
                              {app.instance_id && (
                                <Button 
                                  variant="secondary" 
                                  size="sm" 
                                  className="h-8 text-xs w-full transition-colors justify-between"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    router.push(`/robots?instanceId=${app.instance_id}`)
                                  }}
                                >
                                  Go to Instance
                                  <ArrowRight className="h-3 w-3 ml-2 opacity-50" />
                                </Button>
                              )}
                              <Button 
                                variant="secondary" 
                                size="sm" 
                                className="h-8 text-xs w-full transition-colors justify-between"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  router.push(`/requirements/${app.id}`)
                                }}
                              >
                                Go to Requirement
                                <ArrowRight className="h-3 w-3 ml-2 opacity-50" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </div>
            </Card>
          )
        }

        return (
            <Card 
              key={app.id} 
              className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all duration-200 overflow-hidden flex flex-col"
              onClick={() => router.push(`/applications/database/${tenant.tenant_id}?schema=${tenant.schema}`)}
            >
              <CardHeader className="pb-3 border-b bg-muted/20">
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-semibold leading-tight">{app.title}</CardTitle>
                    <CardDescription className="text-xs font-mono">
                      Req ID: {app.id.slice(0, 8)}
                    </CardDescription>
                  </div>
                  <Badge variant={app.status === 'completed' ? 'default' : 'secondary'} className="capitalize shrink-0">
                    {app.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 flex flex-col">
                <div className="p-4 flex-1 flex flex-col gap-4 text-xs">
                  {app.detailsLoading ? (
                    <>
                      <div className="space-y-1.5">
                        <span className="text-muted-foreground font-medium uppercase tracking-wider text-[10px]">Preview URL</span>
                        <Skeleton className="h-4 w-3/4" />
                      </div>
                      <div className="space-y-1.5 flex-1">
                        <span className="text-muted-foreground font-medium uppercase tracking-wider text-[10px]">Last Update</span>
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                      <div className="flex gap-2 pt-2 border-t mt-auto">
                        <Skeleton className="h-8 flex-1" />
                        <Skeleton className="h-8 flex-1" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <span className="text-muted-foreground font-medium uppercase tracking-wider text-[10px]">Preview URL</span>
                        {app.preview_url ? (
                          <div className="flex items-center gap-2">
                            <a 
                              href={app.preview_url} 
                              target="_blank" 
                              rel="noreferrer"
                              className="font-medium text-primary hover:underline truncate"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {app.preview_url}
                            </a>
                            <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                          </div>
                        ) : (
                          <div className="text-muted-foreground italic">Not available</div>
                        )}
                      </div>
                      
                      <div className="space-y-1.5 flex-1">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground font-medium uppercase tracking-wider text-[10px]">Last Update</span>
                          {app.last_instance_log && (
                            <span className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(new Date(app.last_instance_log.created_at), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                        {app.last_instance_log ? (
                          <div className="line-clamp-2 text-foreground/80 leading-relaxed" title={app.last_instance_log.message}>
                            {app.last_instance_log.message}
                          </div>
                        ) : (
                          <div className="text-muted-foreground italic">No logs available</div>
                        )}
                      </div>
                      
                      <div className="flex gap-2 pt-4 border-t mt-auto">
                        {app.instance_id && (
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            className="h-8 text-xs flex-1 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/robots?instanceId=${app.instance_id}`)
                            }}
                          >
                            Instance
                            <ArrowRight className="h-3 w-3 ml-1.5 opacity-50" />
                          </Button>
                        )}
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="h-8 text-xs flex-1 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/requirements/${app.id}`)
                          }}
                        >
                          Requirement
                          <ArrowRight className="h-3 w-3 ml-1.5 opacity-50" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
          </Card>
        )
      })}
    </div>
  )
}