import Link from 'next/link'
import { Button } from '@/app/components/ui/button'
import { BuyerHomeView } from '@/app/buyer/components/BuyerHomeView'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'

export default function HomePage() {
  return <div className="space-y-6">
    <header><h1 className="text-3xl font-semibold">Your account</h1><p className="text-muted-foreground">Buying and supplier activity in one account. No workspace is required.</p></header>
    <div className="grid gap-4 sm:grid-cols-3">
      <Card><CardHeader><CardTitle>Credentials</CardTitle></CardHeader><CardContent><p className="mb-3">Manage private personal evidence and immutable renewals.</p><Button variant="outline" asChild><Link href="/home/profile">Profile and credentials</Link></Button></CardContent></Card>
      <Card><CardHeader><CardTitle>Supplier activity</CardTitle></CardHeader><CardContent><p className="mb-3">Participate through explicit supplier representation grants.</p><Button variant="outline" asChild><Link href="/home/submissions">View participation</Link></Button></CardContent></Card>
      <Card><CardHeader><CardTitle>Discover tenders</CardTitle></CardHeader><CardContent><p className="mb-3">Browse published opportunities and their terms.</p><Button variant="outline" asChild><Link href="/tenders">Browse tenders</Link></Button></CardContent></Card>
    </div>
    <BuyerHomeView />
  </div>
}