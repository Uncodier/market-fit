"use client"

import React, { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Database, ExternalLink, ArrowRight, Bot, FileText, Database as DatabaseIcon } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"

import { ViewType } from "@/app/components/view-selector"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { formatDistanceToNow } from "date-fns"
import { robotsInstanceHref } from "@/lib/navigation/robots-instance"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { 
  DocumentListHead, 
  DocumentListRow, 
  EntityCell, 
  StatusDot, 
  documentListShellClassName,
  documentRowAccent
} from "@/app/components/documents/document-list"

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
  robotInstanceId?: string
  sortBy?: string
}

export function AppsListSection({ searchQuery = "", viewMode = "kanban", robotInstanceId, sortBy = "newest" }: AppsListSectionProps) {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const router = useRouter()
  const searchParams = useSearchParams()
  const paramSiteId = searchParams?.get('siteId')
  const effectiveSiteId = currentSite?.id || paramSiteId
  const isArtifact = searchParams.get("artifact") === "true"
  
  const handleTenantClick = (tenantId: string, schema: string) => {
    let url = `/applications/database/${tenantId}?schema=${schema}`
    if (isArtifact) {
      url += "&artifact=true"
      if (robotInstanceId) {
        url += `&robotInstanceId=${robotInstanceId}`
      }
    }
    router.push(url)
  }
  
  const [apps, setApps] = useState<TenantApp[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchTenants() {
      if (!effectiveSiteId) return

      setLoading(true)

      try {
        let url = `/api/applications/tenants?siteId=${effectiveSiteId}&sort=${sortBy}`
        if (robotInstanceId) {
          url += `&robotInstanceId=${robotInstanceId}`
        }
        const response = await fetch(url)
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
  }, [effectiveSiteId])

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
        icon={<Database className="h-16 w-16 text-muted-foreground" />}
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
    <div className={documentListShellClassName()}>
      <Table className="min-w-[760px]">
        <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <TableRow className="hover:bg-transparent">
            <DocumentListHead className="w-[30%]">{t("applications.table.project") || "Project"}</DocumentListHead>
            <DocumentListHead className="w-[15%]">{t("applications.table.status") || "Status"}</DocumentListHead>
            <DocumentListHead className="w-[35%]">{t("applications.table.logs") || "Logs / Preview"}</DocumentListHead>
            <DocumentListHead className="w-[20%]" align="right">{t("applications.table.actions") || "Actions"}</DocumentListHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredApps.map((app) => {
            const tenant = app.apps_tenants[0]

            return (
              <DocumentListRow 
                key={app.id}
                onClick={() => handleTenantClick(tenant.tenant_id, tenant.schema)}
                accent="none"
              >
                <TableCell className="py-3.5">
                  <EntityCell 
                    name={app.title} 
                    secondary={`Req ID: ${app.id.slice(0, 8)}`} 
                    secondaryMono 
                  />
                </TableCell>
                <TableCell className="py-3.5">
                  <StatusDot status={app.status === 'completed' ? 'active' : app.status} label={app.status} />
                </TableCell>
                <TableCell className="py-3.5 max-w-[300px]">
                  {app.detailsLoading ? (
                    <div className="space-y-2 w-full">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {app.preview_url ? (
                        <a 
                          href={app.preview_url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="flex items-center gap-1 text-sm font-medium text-primary hover:underline truncate"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {app.preview_url.replace(/^https?:\/\//, '')}
                          <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
                        </a>
                      ) : (
                        <div className="text-sm text-muted-foreground italic">No preview URL</div>
                      )}
                      
                      {app.last_instance_log ? (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium">
                            {formatDistanceToNow(new Date(app.last_instance_log.created_at), { addSuffix: true })}:
                          </span>{" "}
                          <span className="line-clamp-1 opacity-80" title={app.last_instance_log.message}>
                            {app.last_instance_log.message}
                          </span>
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground italic">No logs available</div>
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell className="py-3.5 text-right">
                  <div className="flex items-center justify-end gap-2 flex-wrap">
                    {app.instance_id && (
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="h-8 text-xs transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(robotsInstanceHref(app.instance_id!))
                        }}
                      >
                        <Bot className="h-3 w-3 mr-1.5 opacity-70" />
                        Instance
                      </Button>
                    )}
                    
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="h-8 text-xs transition-colors"
                      onClick={(e) => {
                        e.stopPropagation()
                        router.push(`/applications/database/${tenant.tenant_id}?schema=${tenant.schema}`)
                      }}
                    >
                      <DatabaseIcon className="h-3 w-3 mr-1.5 opacity-70" />
                      Database
                    </Button>

                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="h-8 text-xs transition-colors"
                      onClick={(e) => {
                        e.stopPropagation()
                        router.push(`/requirements/${app.id}`)
                      }}
                    >
                      <FileText className="h-3 w-3 mr-1.5 opacity-70" />
                      Req
                    </Button>
                  </div>
                </TableCell>
              </DocumentListRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}