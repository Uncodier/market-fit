"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { useSite } from "@/app/context/SiteContext"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Button } from "@/app/components/ui/button"
import { Github, Folder, ExternalLink, Database, Bot } from "@/app/components/ui/icons"
import { format } from "date-fns"
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

type TenantRequirement = { id: string; apps_tenants?: { tenant_id: string; schema: string }[] }
type RepositoryLinks = Pick<RequirementStatusRepo, "instance_id" | "source_code" | "repo_url" | "preview_url">

async function loadRepositoryLinks(siteId: string, requirementIds: string[], signal: AbortSignal) {
  // The tenant directory and the RLS status projection are separate authority
  // boundaries. Neither is input to the other, and neither needs instance logs.
  const [tenants, details] = await Promise.all([
    fetch(`/api/applications/tenants?siteId=${encodeURIComponent(siteId)}`, { signal })
      .then(async res => res.ok ? (await res.json()).tenants as TenantRequirement[] : []).catch(() => []),
    fetch('/api/applications/requirements-details', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
      body: JSON.stringify({ requirementIds, includeLatestLog: false }),
    }).then(async res => res.ok ? (await res.json()).details as Record<string, RepositoryLinks> : null).catch(() => null),
  ])
  return { byRequirement: new Map((tenants || []).map(row => [row.id, row.apps_tenants?.[0]])), details }
}

export function RepositoriesSection({ searchQuery = "", viewMode = "table" }: { searchQuery?: string, viewMode?: ViewType }) {
  const { currentSite, isLoading: isSiteLoading } = useSite()
  if (isSiteLoading) return <RepositoryListSkeleton viewMode={viewMode} />
  return <RepositoryList key={currentSite?.id} siteId={currentSite?.id} searchQuery={searchQuery} viewMode={viewMode} />
}

function RepositoryListSkeleton({ viewMode }: { viewMode: ViewType }) {
  return <div className={viewMode === "table" ? "space-y-4" : "grid gap-4 md:grid-cols-2"}>
    {[0, 1, 2].map(index => <Skeleton key={index} className="h-[120px] w-full rounded-lg" />)}
  </div>
}

function RepositoryList({ siteId, searchQuery, viewMode }: { siteId?: string; searchQuery: string; viewMode: ViewType }) {
  const { t } = useLocalization()
  
  const [repos, setRepos] = useState<RequirementStatusRepo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!siteId) return
    const controller = new AbortController()
    const { signal } = controller

    async function fetchRepos(siteId: string) {
      const { data, error } = await createClient()
        .from("requirement_status")
        .select(`
          id, stage, repo_url, source_code, preview_url, created_at,
          requirements:requirements!requirement_id ( id, title )
        `)
        .eq("site_id", siteId)
        .not("repo_url", "is", null)
        .order("created_at", { ascending: false })
        .abortSignal(signal)
      if (signal.aborted) return
        
      if (error) {
        const err = error as { message?: string; code?: string; details?: string; hint?: string }
        console.error("Error fetching repositories:", {
          message: err.message,
          code: err.code,
          details: err.details,
          hint: err.hint,
        })
        setLoading(false)
        return
      } 
      
      const rows = (data ?? []) as RequirementStatusRepo[]
      const reqIds = [...new Set(rows.flatMap(repo => repo.requirements ? [repo.requirements.id] : []))]
      if (reqIds.length) {
        const links = await loadRepositoryLinks(siteId, reqIds, signal)
        if (signal.aborted) return
        setRepos(rows.map(row => {
          const id = row.requirements?.id
          const details = id ? links.details?.[id] : null
          const tenant = id ? links.byRequirement.get(id) : null
          return { ...row, instance_id: details?.instance_id || null, source_code: details?.source_code || row.source_code,
            repo_url: details?.repo_url || row.repo_url, preview_url: details?.preview_url || row.preview_url,
            tenant_id: tenant?.tenant_id, schema: tenant?.schema }
        }))
      } else setRepos(rows)
      setLoading(false)
    }

    void fetchRepos(siteId).catch(() => { if (!signal.aborted) setLoading(false) })
    
    return () => controller.abort()
  }, [siteId])

  const filteredRepos = repos.filter(r => 
    r.requirements?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.repo_url.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const map = new Map<string, RequirementStatusRepo>()
  for (const repo of filteredRepos) {
    const reqId = repo.requirements?.id || 'unknown'
    if (!map.has(reqId)) map.set(reqId, repo)
  }
  const latestRepos = Array.from(map.values())

  if (siteId && loading) return <RepositoryListSkeleton viewMode={viewMode} />

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
            />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function RepositoryItem({ 
  repo, 
}: { 
  repo: RequirementStatusRepo,
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

