import { demoProcurementQuotes } from '@/lib/demo-data/procurement-commerce'
import type { CredentialMetadata, CredentialRevision } from './schema'

type DemoAttachment = {
  revision_id: string
  revision: Pick<CredentialRevision, 'id' | 'revision' | 'metadata' | 'original_name' | 'mime_type' | 'byte_size'>
  requirementReference?: string
}

/** Fictional presentation fixtures only: no files, verification results or API writes. */
export function quotationEvidenceDemoData(quotationId: string) {
  const quote = demoProcurementQuotes.find(item => item.id === quotationId)
  const supplier = quote?.supplier_name ?? 'Demo supplier'
  const base: CredentialMetadata = {
    holder_kind: 'person', holder_name: 'Taylor Example (fictional person)',
    issuer: 'Example Professional Learning Board (fictional issuer)',
    type: 'professional_training', title: '', reference: '', scope: '',
    issued_on: '2026-02-15', expires_on: '2027-02-15', non_expiring: false,
  }
  function attachment(id: string, revision: number, byteSize: number, metadata: Partial<CredentialMetadata>, requirementReference?: string): DemoAttachment {
    const revisionId = `demo-evidence-${quotationId}-${id}-r${revision}`
    return {
      revision_id: revisionId, requirementReference,
      revision: {
        id: revisionId, revision, metadata: { ...base, ...metadata },
        original_name: `fictional-${id}.pdf`, mime_type: 'application/pdf', byte_size: byteSize,
      },
    }
  }
  return {
    supplier,
    proposal: attachment('technical-proposal', 2, 245760, {
      title: 'Technical proposal (fictional sample)', type: 'technical_proposal',
      issuer: `${supplier} (fictional demo supplier)`, reference: `DEMO-${quote?.reference ?? 'PROPOSAL-001'}`,
      scope: 'Onboarding for 20 workstations, remote support, quarterly service reporting and a named account manager.\nDelivery: 10 business days. Payment terms: net 30.',
      issued_on: '2026-10-20', expires_on: '2026-12-20',
    }),
    certificates: [
      attachment('security-training', 2, 98304, {
        title: 'Information security training certificate (fictional sample)', reference: 'DEMO-SEC-2026-042',
        scope: 'Personal training in secure workstation onboarding and remote support.\nSample coverage: workplace devices and support operations; not an organization certification.',
      }, 'Information security training — fictional requirement'),
      attachment('support-training', 1, 65536, {
        title: 'Workplace support course certificate (fictional sample)', reference: 'DEMO-SUPPORT-2025-018',
        scope: 'Completion of a fictional workplace support course covering device setup, incident triage and service reporting.',
        issued_on: '2025-11-05', expires_on: null, non_expiring: true,
      }, 'Workplace support experience — fictional requirement'),
    ],
  }
}