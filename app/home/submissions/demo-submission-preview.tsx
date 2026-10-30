'use client'

import Link from 'next/link'
import { SubmissionShell } from './submission-shell'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { DocumentTable } from '@/app/purchases/procurement/commerce/document-ui'
import { ProcurementDemoNotice } from '@/app/purchases/procurement/ui/demo-notice'
import { demoTenderSite } from '@/lib/demo-data/procurement-portal'
import type { Opportunity } from './types'

/** A read-only preview, deliberately separate from draft, upload and submission hooks. */
export function DemoSubmissionPreview({ opportunity, open = true, onCancel }: {
  opportunity: Opportunity; open?: boolean; onCancel: () => void
}) {
  return <SubmissionShell open={open} onClose={onCancel} title="Preview proposal" description={opportunity.title}>
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
      <ProcurementDemoNotice />
      <div className="space-y-2"><Label htmlFor="demo-proposal-supplier">Representing</Label><Input id="demo-proposal-supplier" value={opportunity.supplier_name} readOnly /></div>
      <div className="space-y-2"><Label htmlFor="demo-proposal-reference">Quotation reference</Label><Input id="demo-proposal-reference" value="NS-2026-1042" readOnly /></div>
      <DocumentTable rows={opportunity.requirements} empty="No requirements" columns={[
        { label: 'Requirement', render: row => row.description },
        { label: 'Quantity', render: row => `${row.quantity} ${row.unit}` },
        { label: 'Unit net (USD)', render: row => row.id === 'demo-line-onboarding' ? '$120.00' : '$3,600.00' },
      ]} />
      <p className="font-semibold">Net $6,000.00 · Tax (8%) $480.00 · Total $6,480.00 USD</p>
      <p>Evidence: Workplace technology professional certificate · Alex Morgan · revision 2. Fictional example only; no file is stored or available for download.</p>
      <div className="flex flex-wrap gap-3"><Button asChild variant="outline"><Link href="/home/profile">View credentials</Link></Button>
        <Button asChild variant="outline"><Link href={`/tenders/${demoTenderSite.slug}/${opportunity.tender_id}`}>View public tender</Link></Button></div>
      <div className="flex gap-3"><Button disabled>Save draft</Button><Button disabled>Submit quotation</Button></div>
      <Button variant="outline" onClick={onCancel}>Close preview</Button>
    </div>
  </SubmissionShell>
}