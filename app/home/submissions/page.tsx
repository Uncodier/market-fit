'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import Link from 'next/link'
import { useAuthContext } from '@/app/components/auth/auth-provider'
import { Button } from '@/app/components/ui/button'
import { DocumentToolbar, DocumentTable } from '@/app/purchases/procurement/commerce/document-ui'
import { SubmissionForm } from './submission-form'
import { type Opportunity, type Submission, readPortalJson } from './types'

export default function SubmissionsPage() {
  const { user } = useAuthContext()
  return user ? <Suspense fallback={<p>Loading supplier activity…</p>}><AccountSubmissions key={user.id} /></Suspense> : <p>Sign in to view supplier activity.</p>
}

function AccountSubmissions() {
  const { user } = useAuthContext()
  const requestedPublication = useSearchParams().get('publication')
  const [drafts, setDrafts] = useState<Opportunity[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const draftId = (row: Opportunity) => `${row.publication_id}:${row.supplier_id}`
  function prepare(row: Opportunity) {
    setDrafts(current => current.some(item => draftId(item) === draftId(row)) ? current : [...current, row])
    setSelected(draftId(row)); setNotice('')
  }
  const [tab, setTab] = useState('opportunities')
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState('')
  const opportunities = useSWR(user ? ['supplier-opportunities', user.id] : null,
    () => readPortalJson('/api/procurement/credentials/participation') as Promise<{ opportunities: Opportunity[] }>)
  const submissions = useSWR(user ? ['supplier-submissions', user.id] : null,
    async () => {
      const result = await readPortalJson('/api/procurement/commerce/submissions') as { data: Submission[] }
      return { submissions: result.data }
    })
  const available = opportunities.data?.opportunities.filter(opportunity => !requestedPublication || opportunity.publication_id === requestedPublication)
  return <section className="space-y-6">
    <header><h1 className="text-3xl font-semibold">Supplier activity</h1><p className="text-muted-foreground">Your explicitly authorized supplier relationships, opportunities and submitted quotations.</p></header>
    <p className="text-sm">An invitation or matching contact email does not grant representation. Ask the buying workspace administrator to verify your account and authorize the supplier relationship. Your account ID: <code>{user?.id}</code></p>
    {(opportunities.error || submissions.error) && <p role="alert" className="text-destructive">{opportunities.error?.message || submissions.error?.message}</p>}
    {notice && <p role="status">{notice}</p>}
    {drafts.map(draft => <SubmissionForm key={draftId(draft)} open={selected === draftId(draft)} opportunity={draft} onCancel={() => setSelected(null)} onSubmitted={() => {
      setSelected(null); setDrafts(current => current.filter(row => draftId(row) !== draftId(draft))); setNotice('Quotation submitted. This is not an award or certification acceptance.'); void submissions.mutate()
    }} />)}
    <DocumentToolbar tabs={[{ value: 'opportunities', label: 'Invitations and opportunities' }, { value: 'submissions', label: 'Submitted quotations' }]} value={tab} onChange={setTab} search={search} onSearch={setSearch}
      actions={<Button variant="ghost" size="sm" asChild><Link href="/home/profile">Manage private credentials</Link></Button>} />
    {requestedPublication && <p>Showing the requested publication only. <Button variant="link" asChild><Link href="/home/submissions">View all opportunities</Link></Button></p>}
    {tab === 'opportunities' ? <DocumentTable loading={opportunities.isLoading} empty="No matching open opportunities for your authorized supplier relationships."
      rows={(available ?? []).filter(row => `${row.title} ${row.supplier_name}`.toLowerCase().includes(search.toLowerCase())).map(row => ({ ...row, id: `${row.publication_id}:${row.supplier_id}` }))} columns={[
        { label: 'Tender', render: row => <><p className="font-medium">{row.title}</p><p className="text-muted-foreground">Version {row.version} · {row.currency}</p></> },
        { label: 'Representing', render: row => row.supplier_name },
        { label: 'Closes', render: row => new Date(row.participation_deadline).toLocaleString() },
        { label: 'Action', render: row => <Button variant="ghost" size="sm" disabled={!!opportunities.error} onClick={() => prepare(row)}>Prepare quotation</Button> },
      ]} /> : <DocumentTable loading={submissions.isLoading} empty="No submitted quotations." rows={(submissions.data?.submissions ?? []).filter(row => `${row.tender_title} ${row.reference}`.toLowerCase().includes(search.toLowerCase()))} columns={[
        { label: 'Tender / reference', render: row => <>{row.tender_title}<p>{row.reference}</p></> },
        { label: 'Net / tax', render: row => `${row.currency} · Net ${(row.net_amount_minor / 100).toFixed(2)} · Tax ${(row.tax_amount_minor / 100).toFixed(2)}` },
        { label: 'Submitted', render: row => new Date(row.submitted_at).toLocaleString() },
        { label: 'Receipt', render: row => row.id },
      ]} />}

  </section>
}