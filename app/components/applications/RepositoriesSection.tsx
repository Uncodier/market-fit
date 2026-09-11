"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { useSite } from "@/app/context/SiteContext"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { Github, Folder, ExternalLink, Copy, Database, Bot, FileText } from "@/app/components/ui/icons"
import { format } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card"
import { ViewType } from "@/app/components/view-selector"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { useLocalization } from "@/app/context/LocalizationContext"
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

interface RequirementStatusRepo {
  id: string
  stage: string
  repo_url: string
  source_code: string | null
  preview_url: string | null
  created_at: string
  requirements: {
    id: string
    title: string
  } | null
  instance_id?: string | null
  tenant_id?: string | null
  schema?: string | null
}

export function RepositoriesSection({ searchQuery = "", viewMode = "table" }: { searchQuery?: string, viewMode?: ViewType }) {
  const { t } = useLocalization()
  const { currentSite } = useSite()
  const router = useRouter()
  const supabase = createClient()
  
  const [repos, setRepos] = useState<RequirementStatusRepo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchRepos() {
      if (!currentSite?.id) return
      
      setLoading(true)
      const { data, error } = await supabase
        .from("requirement_status")
        .select(`
          id, stage, repo_url, source_code, preview_url, created_at,
          requirements:requirements!requirement_id ( id, title )
        `)
        .eq("site_id", currentSite.id)
        .not("repo_url", "is", null)
        .order("created_at", { ascending: false })
        
      if (error) {
        const err = error as { message?: string; code?: string; details?: string; hint?: string }
        console.error("Error fetching repositories:", {
          message: err.message,
          code: err.code,
          details: err.details,
          hint: err.hint,
        })
        if (!cancelled) setLoading(false)
        return
      } 
      
      if (data && !cancelled) {
        let enhancedRepos = data as any[]
        
        // Fetch tenants
        try {
          const tenantsRes = await fetch(`/api/applications/tenants?siteId=${currentSite.id}`)
          if (tenantsRes.ok) {
            const tenantsData = await tenantsRes.json()
            const reqToTenant = new Map<string, { tenant_id: string, schema: string }>()
            for (const tenantReq of (tenantsData.tenants || [])) {
              if (tenantReq.apps_tenants && tenantReq.apps_tenants.length > 0) {
                reqToTenant.set(tenantReq.id, {
                  tenant_id: tenantReq.apps_tenants[0].tenant_id,
                  schema: tenantReq.apps_tenants[0].schema
                })
              }
            }
            
            enhancedRepos = enhancedRepos.map(repo => {
              const reqId = repo.requirements?.id
              const tenantInfo = reqId ? reqToTenant.get(reqId) : undefined
              return {
                ...repo,
                tenant_id: tenantInfo?.tenant_id,
                schema: tenantInfo?.schema
              }
            })
          }
        } catch (e) {
          console.error("Failed to fetch tenants:", e)
        }

        // Fetch requirements details (instance_id)
        try {
          const reqIds = enhancedRepos.map(r => r.requirements?.id).filter(Boolean)
          if (reqIds.length > 0) {
            const detailsRes = await fetch('/api/applications/requirements-details', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ requirementIds: reqIds })
            })
            if (detailsRes.ok) {
              const detailsData = await detailsRes.json()
              enhancedRepos = enhancedRepos.map(repo => {
                const reqId = repo.requirements?.id
                const reqDetails = reqId && detailsData.details ? detailsData.details[reqId] : null
                return {
                  ...repo,
                  instance_id: reqDetails?.instance_id || repo.instance_id || null,
                  source_code: reqDetails?.source_code || repo.source_code || null,
                  repo_url: reqDetails?.repo_url || repo.repo_url || null,
                  preview_url: reqDetails?.preview_url || repo.preview_url || null
                }
              })
            }
          }
        } catch (e) {
          console.error("Failed to fetch requirement details:", e)
        }

        if (!cancelled) {
          setRepos(enhancedRepos)
        }
      }
      
      if (!cancelled) setLoading(false)
    }

    fetchRepos()
    
    return () => {
      cancelled = true
    }
  }, [currentSite?.id, supabase])

  const filteredRepos = repos.filter(r => 
    r.requirements?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.repo_url.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const latestRepos = useMemo(() => {
    const map = new Map<string, RequirementStatusRepo>()
    for (const repo of filteredRepos) {
      const reqId = repo.requirements?.id || 'unknown'
      if (!map.has(reqId)) {
        map.set(reqId, repo)
      }
    }
    return Array.from(map.values())
  }, [filteredRepos])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  if (loading) {
    return (
      <div className={viewMode === "table" ? "space-y-4" : "grid gap-4 md:grid-cols-2"}>
        <Skeleton className="h-[120px] w-full rounded-lg" />
        <Skeleton className="h-[120px] w-full rounded-lg" />
        <Skeleton className="h-[120px] w-full rounded-lg" />
      </div>
    )
  }

  if (latestRepos.length === 0) {
    return (
      <EmptyCard 
        variant="fancy" 
        icon={<Github className="h-16 w-16 text-muted-foreground" />}
        title={t("applications.noRepositoriesFound") || "No repositories found"}
        description={t("applications.noRepositoriesMatch") || "We couldn't find any repositories matching your search criteria."}
      />
    )
  }

  return (
    <div className={documentListShellClassName()}>
      <Table className="min-w-[760px]">
        <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <TableRow className="hover:bg-transparent">
            <DocumentListHead className="w-[30%]">{t("applications.table.repository") || "Repository"}</DocumentListHead>
            <DocumentListHead className="w-[15%]">{t("applications.table.stage") || "Stage"}</DocumentListHead>
            <DocumentListHead className="w-[15%]">{t("applications.table.lastUpdate") || "Last Update"}</DocumentListHead>
            <DocumentListHead className="w-[40%]" align="right">{t("applications.table.actions") || "Actions"}</DocumentListHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {latestRepos.map((repo) => (
            <RepositoryItem 
              key={repo.id} 
              repo={repo} 
              copyToClipboard={copyToClipboard} 
            />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function RepositoryItem({ 
  repo, 
  copyToClipboard,
}: { 
  repo: RequirementStatusRepo,
  copyToClipboard: (text: string) => void,
}) {
  const router = useRouter()
  const title = repo.requirements?.title || 'Unknown Requirement'
  const reqId = repo.requirements?.id || 'unknown'
  const repoName = repo.repo_url.split('/').pop() || repo.repo_url

  return (
    <DocumentListRow 
      onClick={() => {
        // According to user requirements: Code should be an independent app,
        // so we route directly to the standalone code viewer page.
        router.push(`/applications/repositories/${reqId}?name=${encodeURIComponent(title)}`)
      }}
      accent="none"
    >
      <TableCell className="py-3.5">
        <EntityCell 
          name={title} 
          secondary={repoName} 
          meta={`Req ID: ${reqId.slice(0, 8)}`} 
          secondaryMono 
        />
      </TableCell>
      <TableCell className="py-3.5">
        <StatusDot status={repo.stage} label={repo.stage} />
      </TableCell>
      <TableCell className="py-3.5 text-sm text-muted-foreground whitespace-nowrap">
        {format(new Date(repo.created_at), 'MMM d, yyyy HH:mm')}
      </TableCell>
      <TableCell className="py-3.5 text-right">
        <div className="flex items-center justify-end gap-2 flex-wrap">
          {repo.instance_id && (
            <Button 
              variant="secondary" 
              size="sm" 
              className="h-8 text-xs transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                router.push(robotsInstanceHref(repo.instance_id!))
              }}
            >
              <Bot className="h-3 w-3 mr-1.5 opacity-70" />
              Instance
            </Button>
          )}

          {repo.tenant_id && repo.schema && (
            <Button 
              variant="secondary" 
              size="sm" 
              className="h-8 text-xs transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                router.push(`/applications/database/${repo.tenant_id}?schema=${repo.schema}`)
              }}
            >
              <Database className="h-3 w-3 mr-1.5 opacity-70" />
              DB
            </Button>
          )}

          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation()
              window.open(repo.repo_url, '_blank')
            }}
            title="Repository"
          >
            <Github className="h-4 w-4" />
          </Button>

          {repo.source_code && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation()
                window.open(repo.source_code!, '_blank')
              }}
              title="Source Code"
            >
              <Folder className="h-4 w-4" />
            </Button>
          )}

          {repo.preview_url && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation()
                window.open(repo.preview_url!, '_blank')
              }}
              title="Preview URL"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </DocumentListRow>
  )
}

