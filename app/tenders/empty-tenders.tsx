'use client'

import Link from 'next/link'
import { EmptyState } from '@/app/components/ui/empty-state'
import { Button } from '@/app/components/ui/button'

export function EmptyTenders({ href }: { href: string }) {
  return <EmptyState variant="simple" title="No published tenders match this view."
    description="Try another search or browse all public opportunities."
    action={<Button variant="outline" asChild><Link href={href}>Clear search</Link></Button>} />
}