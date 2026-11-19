import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import Link from "next/link"
import type { AuthChangeEvent, Session } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/app/components/ui/button"
import { Card } from "@/app/components/ui/card"
import { Pagination } from "@/app/components/ui/pagination"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"

type Member = {
  ordinal: number
  person_id: string
  processing_status: 'pending' | 'completed'
  outcome: 'matched' | 'no_match' | 'needs_review' | null
  leads: { id: string; name: string; email: string | null } | null
}
type Snapshot = { name: string; status: string; members: Member[]; total: number }
const PAGE_SIZE = 25
const statusLabels: Record<string, string> = {
  pending: 'Pending', running: 'In Progress', mining: 'In Progress',
  completed: 'Completed', failed: 'Failed',
}

export function SelectedListResults({ list, onClose, sidebarToggle }: {
  list: { id: string; siteId: string }
  onClose: () => void
  sidebarToggle?: ReactNode
}) {
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [identityChanged, setIdentityChanged] = useState(false)

  useEffect(() => {
    const client = createClient()
    let active = true
    let actor: string | null | undefined
    const invalidateIdentity = () => {
      active = false
      setSnapshot(null)
      setLoading(false)
      setIdentityChanged(true)
    }
    const { data: listener } = client.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (!active) return
      const nextActor = event === 'SIGNED_OUT' ? null : session?.user?.id ?? null
      // INITIAL_SESSION and same-user refreshes do not change identity. Once
      // identity changes, retire this read even if the original user signs back in.
      if (actor !== undefined && actor !== nextActor) invalidateIdentity()
      else actor = nextActor
    })
    const load = async () => {
      setLoading(true)
      setError(false)
      setSnapshot(null)
      try {
        const session = await client.auth.getSession()
        if (!active) return
        const sessionActor = session.data.session?.user?.id ?? null
        if (actor !== undefined && actor !== sessionActor) {
          invalidateIdentity()
          return
        }
        actor = sessionActor
        if (session.error || !actor) throw new Error('Authentication required')
        // Both reads use the current user's RLS; no service-role or provider requests.
        const parent = await client.from('icp_mining').select('id, name, status, icp_criteria')
          .eq('id', list.id).eq('site_id', list.siteId).maybeSingle()
        if (!active) return
        if (parent.error || !parent.data || parent.data.icp_criteria?.source !== 'selected_people') {
          throw new Error('Selected list unavailable')
        }
        const members = await client.from('icp_mining_people')
          .select('ordinal, person_id, processing_status, outcome, leads(id, name, email)', { count: 'exact' })
          .eq('icp_mining_id', list.id).eq('site_id', list.siteId)
          .order('ordinal', { ascending: true }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
        if (!active) return
        if (members.error || !Array.isArray(members.data) || members.count === null || members.count === undefined) {
          throw new Error('Selected members unavailable')
        }
        setSnapshot({ name: parent.data.name?.trim() || `List ${list.id.slice(0, 8)}…`,
          status: parent.data.status, members: members.data as unknown as Member[], total: members.count })
      } catch {
        if (active) setError(true)
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [list.id, list.siteId, page, revision])

  return (
    <div className="flex-1 min-h-0 min-w-0 overflow-auto p-4 md:p-6">
      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {sidebarToggle}
            <h2 className="text-lg font-semibold break-words">{snapshot?.name || 'Selected people list'}</h2>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setRevision(value => value + 1)} disabled={loading || identityChanged}>Refresh</Button>
            <Button variant="ghost" onClick={onClose}>Back to search</Button>
          </div>
        </div>
        {identityChanged ? <p role="alert">Your session changed. Select the list again.</p>
          : loading ? <p role="status">Loading list members...</p>
          : error ? <div role="alert" className="space-y-2">
            <p>Could not load list members. Please try again.</p>
            <Button variant="outline" onClick={() => setRevision(value => value + 1)}>Retry</Button>
          </div> : snapshot && <>
            <p role="status">List status: {statusLabels[snapshot.status] || 'Unknown'} · {snapshot.total} selected people</p>
            <p className="text-sm text-muted-foreground">Processing completion does not mean every person generated a lead. Each outcome is shown below.</p>
            {snapshot.total === 0 ? <p>No selected people in this list.</p> : <>
              <Table>
                <TableHeader><TableRow><TableHead>Person</TableHead><TableHead>Processing</TableHead><TableHead>Outcome</TableHead><TableHead>Lead</TableHead></TableRow></TableHeader>
                <TableBody>{snapshot.members.map(member => <TableRow key={member.ordinal}>
                  <TableCell>{member.leads?.name || member.person_id}</TableCell>
                  <TableCell>{member.processing_status === 'completed' ? 'Completed' : 'Pending'}</TableCell>
                  <TableCell>{member.outcome === 'matched' ? 'Matched' : member.outcome === 'no_match' ? 'No match' : member.outcome === 'needs_review' ? 'Needs review' : '—'}</TableCell>
                  <TableCell>{member.leads ? <Link className="underline" href={`/leads/${encodeURIComponent(member.leads.id)}`}>View lead</Link> : '—'}</TableCell>
                </TableRow>)}</TableBody>
              </Table>
              <Pagination currentPage={page} totalPages={Math.max(1, Math.ceil(snapshot.total / PAGE_SIZE))} onPageChange={setPage} disabled={loading} />
            </>}
          </>}
      </Card>
    </div>
  )
}