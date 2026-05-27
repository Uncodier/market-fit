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
                  instance_id: reqDetails?.instance_id || null
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
        icon={<Github />}
        title={t("applications.noRepositoriesFound") || "No repositories found"}
        description={t("applications.noRepositoriesMatch") || "We couldn't find any repositories matching your search criteria."}
      />
    )
  }

  return (
    <div className={viewMode === "table" ? "space-y-4" : "grid gap-4 md:grid-cols-2"}>
      {latestRepos.map((repo) => (
        <RepositoryItem 
          key={repo.id} 
          repo={repo} 
          copyToClipboard={copyToClipboard} 
          viewMode={viewMode}
        />
      ))}
    </div>
  )
}

function RepositoryItem({ 
  repo, 
  copyToClipboard,
  viewMode = "table"
}: { 
  repo: RequirementStatusRepo,
  copyToClipboard: (text: string) => void,
  viewMode?: ViewType
}) {
  const router = useRouter()
  const title = repo.requirements?.title || 'Unknown Requirement'
  const reqId = repo.requirements?.id || 'unknown'

  if (viewMode === "table") {
    return (
      <Card className="border border-border hover:border-foreground/20 transition-colors overflow-hidden cursor-pointer flex flex-col">
        <div 
          className="flex items-center hover:bg-muted/50 transition-colors w-full h-full"
          onClick={() => {
            if (repo.tenant_id && repo.schema) {
              router.push(`/applications/database/${repo.tenant_id}?schema=${repo.schema}`)
            } else {
              router.push(`/requirements/${reqId}`)
            }
          }}
        >
          <CardContent className="flex-1 p-4 w-full overflow-x-auto pb-4">
            <div className="flex items-start gap-4 min-w-[1000px]">
              <div className="w-[300px] min-w-[300px] pr-2 flex-grow">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-lg truncate" title={title}>{title}</h3>
                </div>
                <p className="text-sm text-muted-foreground/80 line-clamp-1">Req ID: {reqId.slice(0, 8)}</p>
              </div>
              
              <div className="w-[120px] min-w-[120px] flex-shrink-0">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 text-center">Stage</p>
                <div className="flex justify-center">
                  <Badge variant="outline" className="bg-background">
                    {repo.stage}
                  </Badge>
                </div>
              </div>

              <div className="w-[200px] min-w-[200px] flex-shrink-0">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 text-center">Repository</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="font-mono text-xs truncate max-w-[150px]" title={repo.repo_url}>
                    {repo.repo_url.split('/').pop() || repo.repo_url}
                  </span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 shrink-0" 
                    onClick={(e) => {
                      e.stopPropagation()
                      copyToClipboard(repo.repo_url)
                    }}
                    title="Copy URL"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="w-[150px] min-w-[150px] flex-shrink-0">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 text-center">Last Update</p>
                <div className="flex justify-center">
                  <span className="text-sm font-medium">
                    {format(new Date(repo.created_at), 'MMM d, yyyy HH:mm')}
                  </span>
                </div>
              </div>

            </div>
          </CardContent>
        </div>
        <div className="bg-muted/40 border-t border-border px-4 py-2 flex items-center justify-end gap-2 flex-wrap">
          {repo.instance_id && (
            <Button 
              variant="secondary" 
              size="sm" 
              className="h-8 text-xs transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                router.push(`/robots?instanceId=${repo.instance_id}`)
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
              Database
            </Button>
          )}

          <Button 
            variant="secondary" 
            size="sm" 
            className="h-8 text-xs transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              router.push(`/requirements/${reqId}`)
            }}
          >
            <FileText className="h-3 w-3 mr-1.5 opacity-70" />
            Requirement
          </Button>

          <Button 
            variant="secondary" 
            size="sm" 
            className="h-8 text-xs transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              window.open(repo.repo_url, '_blank')
            }}
          >
            <Github className="h-3 w-3 mr-1.5 opacity-70" />
            Repo
          </Button>
          
          {repo.source_code && (
            <Button 
              variant="secondary" 
              size="sm" 
              className="h-8 text-xs transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                window.open(repo.source_code!, '_blank')
              }}
            >
              <Folder className="h-3 w-3 mr-1.5 opacity-70" />
              Source
            </Button>
          )}
          
          {repo.preview_url && (
            <Button 
              variant="secondary" 
              size="sm" 
              className="h-8 text-xs transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                window.open(repo.preview_url!, '_blank')
              }}
            >
              <ExternalLink className="h-3 w-3 mr-1.5 opacity-70" />
              Preview
            </Button>
          )}
        </div>
      </Card>
    )
  }

  // Kanban View
  return (
    <Card className="hover:shadow-md hover:border-primary/30 transition-all duration-200 overflow-hidden flex flex-col cursor-pointer"
      onClick={() => {
        if (repo.tenant_id && repo.schema) {
          router.push(`/applications/database/${repo.tenant_id}?schema=${repo.schema}`)
        } else {
          router.push(`/requirements/${reqId}`)
        }
      }}
    >
      <CardHeader className="pb-3 border-b bg-muted/20">
        <div className="flex justify-between items-start gap-4">
          <div className="space-y-1 min-w-0">
            <CardTitle className="text-base font-semibold leading-tight truncate" title={title}>{title}</CardTitle>
            <CardDescription className="text-xs font-mono truncate">
              Req ID: {reqId.slice(0, 8)}
            </CardDescription>
          </div>
          <Badge variant="outline" className="shrink-0 bg-background">
            {repo.stage}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="p-0 flex-1 flex flex-col">
        <div className="p-4 flex-1 flex flex-col gap-4 text-xs">
          <div className="space-y-1.5">
            <span className="text-muted-foreground font-medium uppercase tracking-wider text-[10px]">Repository</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs truncate bg-muted/40 px-2 py-1.5 rounded-md flex-1 border border-border/50" title={repo.repo_url}>
                {repo.repo_url.split('/').pop() || repo.repo_url}
              </span>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-7 w-7 shrink-0" 
                onClick={() => copyToClipboard(repo.repo_url)}
                title="Copy URL"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
          
          <div className="space-y-1.5 flex-1">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium uppercase tracking-wider text-[10px]">Last Update</span>
            </div>
            <div className="text-sm font-medium text-foreground/80">
              {format(new Date(repo.created_at), 'MMM d, yyyy HH:mm')}
            </div>
          </div>
          
          <div className="flex gap-2 pt-4 border-t mt-auto flex-wrap">
            {repo.instance_id && (
              <Button 
                variant="secondary" 
                size="sm" 
                className="h-8 text-xs flex-1 transition-colors min-w-[100px]"
                onClick={(e) => {
                  e.stopPropagation()
                  router.push(`/robots?instanceId=${repo.instance_id}`)
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
                className="h-8 text-xs flex-1 transition-colors min-w-[100px]"
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
              variant="secondary" 
              size="sm" 
              className="h-8 text-xs flex-1 transition-colors min-w-[100px]"
              onClick={(e) => {
                e.stopPropagation()
                router.push(`/requirements/${reqId}`)
              }}
            >
              <FileText className="h-3 w-3 mr-1.5 opacity-70" />
              Req
            </Button>

            <Button 
              variant="secondary" 
              size="sm" 
              className="h-8 text-xs flex-1 transition-colors min-w-[100px]"
              onClick={(e) => {
                e.stopPropagation()
                window.open(repo.repo_url, '_blank')
              }}
            >
              <Github className="h-3 w-3 mr-1.5 opacity-70" />
              Repo
            </Button>
            
            {repo.source_code && (
              <Button 
                variant="secondary" 
                size="sm" 
                className="h-8 text-xs flex-1 transition-colors min-w-[100px]"
                onClick={(e) => {
                  e.stopPropagation()
                  window.open(repo.source_code!, '_blank')
                }}
              >
                <Folder className="h-3 w-3 mr-1.5 opacity-70" />
                Source
              </Button>
            )}
            
            {repo.preview_url && (
              <Button 
                variant="secondary" 
                size="sm" 
                className="h-8 text-xs flex-1 transition-colors min-w-[100px]"
                onClick={(e) => {
                  e.stopPropagation()
                  window.open(repo.preview_url!, '_blank')
                }}
              >
                <ExternalLink className="h-3 w-3 mr-1.5 opacity-70" />
                Preview
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
