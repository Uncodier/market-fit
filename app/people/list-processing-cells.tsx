import Link from 'next/link'
import { Badge } from '@/app/components/ui/badge'
import { TableCell } from '@/app/components/ui/table'
import type { SavedListMember } from './saved-list-types'

export type ListProcessing = Pick<SavedListMember, 'processing' | 'outcome' | 'lead'>

export function ListProcessingCells({ member }: { member?: ListProcessing }) {
  const outcome = member?.outcome === 'matched' ? 'Matched'
    : member?.outcome === 'no_match' ? 'No match' : member?.outcome === 'needs_review' ? 'Needs review' : '—'
  return <>
    <TableCell><Badge variant="secondary">{member?.processing === 'completed' ? 'Completed' : member ? 'Pending' : '—'}</Badge></TableCell>
    <TableCell>{outcome}</TableCell>
    <TableCell>{member?.lead ? <Link className="text-primary hover:underline" href={`/leads/${encodeURIComponent(member.lead.id)}`}>
      View lead
    </Link> : '—'}</TableCell>
  </>
}