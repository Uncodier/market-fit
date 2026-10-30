'use client'

import { useState } from 'react'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { SectionCard, SectionCardHeader, SectionCardContent } from '@/app/components/ui/section-card'
import { demoProcurementQuotes } from '@/lib/demo-data/procurement-commerce'

export function DemoQuotationEvidence({ quotationId }: { quotationId: string }) {
  const [expanded, setExpanded] = useState(false)
  const quote = demoProcurementQuotes.find(item => item.id === quotationId)
  return <SectionCard>
    <SectionCardHeader title="Supplier evidence" description="Fictional documents for this demonstration. No private files are downloaded." />
    <SectionCardContent className="space-y-4">
      <div><p className="font-medium">Technical proposal · Revision 2</p><p className="text-sm text-muted-foreground">{quote?.supplier_name ?? 'Demo supplier'} · Workplace onboarding and annual support</p></div>
      <div className="flex items-center justify-between gap-3"><span>Business registration · Revision 1</span><Badge variant="outline">Accepted</Badge></div>
      <div className="flex items-center justify-between gap-3"><span>Information security certificate · Revision 2</span><Badge variant="outline">Under review</Badge></div>
      <Button variant="outline" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}>Preview sample evidence</Button>
      {expanded && <div className="rounded-lg border p-4 text-sm space-y-2">
        <h3 className="font-semibold">Demo evidence preview</h3>
        <p>Scope: onboarding for 20 workstations, remote support, quarterly service reporting and a named account manager.</p>
        <p>Delivery: 10 business days. Support coverage: Monday–Friday, 09:00–18:00. Payment terms: net 30.</p>
        <p>This sample is not a real certificate or an approval decision.</p>
      </div>}
    </SectionCardContent>
  </SectionCard>
}