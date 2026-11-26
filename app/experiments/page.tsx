"use client"

import { detailViewHref } from "@/lib/navigation/detail-view-navigation"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSite } from '@/app/context/SiteContext'
import { useAuthContext } from '@/app/components/auth/auth-context'
import { Button } from '@/app/components/ui/button'
import { SearchInput } from '@/app/components/ui/search-input'
import { StickyHeader } from '@/app/components/ui/sticky-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import { useToast } from '@/app/components/ui/use-toast'
import { getDemoSiteId } from '@/lib/demo-utils'
import { startExperiment, stopExperiment } from './actions'
import { ExperimentEmptyState, ExperimentRow, ExperimentRowSkeleton } from './experiment-index-rows'
import { readExperimentIndex, type ExperimentIndexRow } from './read-experiment-index'

const tabs = { all: 'All Experiments', active: 'Active', completed: 'Completed', draft: 'Draft' } as const
const statuses = Object.keys(tabs) as (keyof typeof tabs)[]
const triggerClass = 'w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5'

export default function ExperimentsPage() {
  const { currentSite, requestScope, isLoading } = useSite()
  const auth = useAuthContext()
  const site = currentSite?.id
  const actor = !auth.isLoading && !auth.user?.is_anonymous ? auth.user?.id : undefined
  const demo = getDemoSiteId()
  const ready = !isLoading && site && (demo ? demo === site : !site.startsWith('demo-') && actor &&
    requestScope?.actorId === actor && requestScope.siteId === site)
  return <ExperimentIndex key={JSON.stringify([actor, ready ? site : null])} siteId={ready ? site : undefined}
    waiting={isLoading || (!demo && auth.isLoading)} />
}

function ExperimentIndex({ siteId, waiting }: { siteId?: string; waiting: boolean }) {
  const [rows, setRows] = useState<ExperimentIndexRow[]>()
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    if (!siteId) return
    const controller = new AbortController()
    void readExperimentIndex(siteId, controller.signal).then(result => {
      if (!controller.signal.aborted) setRows(result)
    }, () => { if (!controller.signal.aborted) setFailed(true) })
    return () => controller.abort()
  }, [siteId, attempt])

  async function changeStatus(id: string, start: boolean) {
    if (!siteId || busy[id]) return
    setBusy(prev => ({ ...prev, [id]: true }))
    try {
      const result = await (start ? startExperiment(id) : stopExperiment(id))
      if (result.error) throw new Error(result.error)
      const now = new Date().toISOString()
      setRows(prev => prev?.map(row => row.id !== id ? row : start
        ? { ...row, status: 'active', start_date: now } : { ...row, status: 'completed', end_date: now }))
      toast({ title: 'Success', description: `Experiment ${start ? 'started' : 'stopped'} successfully` })
    } catch (error) {
      toast({ title: 'Error', variant: 'destructive', description: error instanceof Error ? error.message : 'An unexpected error occurred' })
    } finally { setBusy(prev => ({ ...prev, [id]: false })) }
  }

  const query = search.trim().toLowerCase()
  const matches = (rows ?? []).filter(row => !query || [row.name, row.description, row.hypothesis, row.campaign?.title,
    ...row.segments.map(segment => segment.name)].some(value => value?.toLowerCase().includes(query)))
  return <div className="flex-1 p-0">
    <Tabs defaultValue="all" className="h-full">
      <StickyHeader><div className="flex w-full items-center gap-8">
        <TabsList>{statuses.map(status => <TabsTrigger key={status} value={status} className={triggerClass}>{tabs[status]}</TabsTrigger>)}</TabsList>
        <SearchInput placeholder="Search experiments..." type="text" value={search} onChange={event => setSearch(event.target.value)}
          disabled={!siteId && !waiting} className="w-full h-10 md:h-9" containerClassName="w-full" />
      </div></StickyHeader>
      <div className="p-8 space-y-4"><div className="px-8">
        {waiting || (siteId && !failed && !rows) ? <div aria-label="Loading experiments" aria-busy="true" className="space-y-4">
          {Array.from({ length: 3 }, (_, i) => <ExperimentRowSkeleton key={i} />)}
        </div> : !siteId ? <p role="status">Please select a site to view its experiments.</p>
          : failed ? <div role="alert" className="space-y-3"><p>Experiments could not be loaded.</p><Button variant="outline" onClick={() => {
            setFailed(false); setAttempt(n => n + 1)
          }}>Retry</Button></div> : statuses.map(status => {
            const visible = status === 'all' ? matches : matches.filter(row => row.status === status)
            return <TabsContent key={status} value={status} className="space-y-4">{visible.length === 0 ?
              status === 'all' && query ? <p className="py-8 text-center text-muted-foreground">No experiments found matching “{search}”</p>
                : <ExperimentEmptyState status={status} />
              : <div className="space-y-2">{visible.map(experiment => <ExperimentRow key={experiment.id} experiment={experiment}
                isExpanded={false} isLoading={!!busy[experiment.id]} onStart={id => void changeStatus(id, true)}
                onStop={id => void changeStatus(id, false)} onView={row => router.push(detailViewHref(siteId, "/experiments", row.id, visible))} />)}</div>}
            </TabsContent>
          })}
      </div></div>
    </Tabs>
  </div>
}