import Link from 'next/link'
import { Button } from '@/app/components/ui/button'
import { TenderHeader, TenderFooter } from './public-header'

export default function NotFound() {
  return <div className="flex flex-col min-h-screen bg-background"><TenderHeader /><main className="flex-1 mx-auto w-full max-w-7xl space-y-4 px-4 md:px-8 py-24 text-center">
    <h1 className="text-3xl font-semibold">Tender not found</h1>
    <p className="text-muted-foreground">This publication is not available in the public directory.</p>
    <Button variant="outline" asChild><Link href="/tenders">Browse public tenders</Link></Button>
  </main><TenderFooter /></div>
}