import Link from 'next/link'
import { Button } from '@/app/components/ui/button'
import { SectionCard, SectionCardHeader, SectionCardTitle, SectionCardContent } from '@/app/components/ui/section-card'
import { TenderHeader, TenderFooter } from '../../public-header'
import { notFound } from 'next/navigation'
import { loadPublicTenders, participationClosed } from '../../public-data'
export const dynamic = 'force-dynamic'
export default async function Page({ params }: { params: Promise<{ siteSlug: string; tenderSlug: string }> }) {
  const route = await params
  const result = await loadPublicTenders(route.siteSlug, route.tenderSlug)
  if (result.error) return <div className="min-h-screen bg-background flex flex-col"><TenderHeader siteSlug={route.siteSlug} /><main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-8 py-8 md:py-12"><div role="alert" className="space-y-3 py-8"><h1 className="text-2xl font-bold">Unable to load tender</h1><p>{result.error}</p><Button variant="outline" asChild><Link href={`/tenders/${route.siteSlug}/${route.tenderSlug}`}>Retry</Link></Button></div></main><TenderFooter /></div>
  const tender = result.rows[0]
  if (!tender) notFound()
  const terms = tender.snapshot
  const closed = participationClosed(tender)
  return <div className="min-h-screen bg-background flex flex-col"><TenderHeader siteSlug={route.siteSlug}
    primaryActions={!closed ? <Button asChild className="h-9 !min-w-0 rounded-full px-4 font-bold"><Link href={`/home/submissions?publication=${tender.publication_id}`}>Submit proposal</Link></Button> : undefined} />
    <main className="flex-1 w-full max-w-7xl mx-auto space-y-6 px-4 md:px-8 py-4 md:py-6"><nav aria-label="Tender navigation" className="text-sm text-muted-foreground"><Link className="hover:underline" href="/tenders">Tenders</Link><span className="mx-3">/</span><Link className="hover:underline" href={`/tenders/${route.siteSlug}`}>{route.siteSlug}</Link></nav><div className="grid grid-cols-1 items-start gap-8 lg:gap-10 lg:grid-cols-12"><div className="space-y-6 lg:col-span-7 xl:col-span-8">
    <header><p className="text-sm text-muted-foreground">Published version {tender.version} · {closed ? 'Participation closed' : 'Participation period open'}</p><h1 className="mt-2 text-2xl md:text-3xl font-bold tracking-tight leading-tight">{terms.title}</h1></header>
    <p className="whitespace-pre-wrap">{terms.description}</p>
    <SectionCard><SectionCardHeader><SectionCardTitle>Requirements</SectionCardTitle></SectionCardHeader><SectionCardContent className="space-y-4">{terms.requirements.map((line, index) => <article key={line.id} className="rounded border p-4"><h3 className="font-medium">Requirement {index + 1} · {line.quantity} {line.unit}</h3><p className="whitespace-pre-wrap">{line.description}</p></article>)}</SectionCardContent></SectionCard>
    </div><aside className="space-y-6 lg:col-span-5 xl:col-span-4 lg:sticky lg:top-28">
    <SectionCard><SectionCardHeader><SectionCardTitle>Participation</SectionCardTitle></SectionCardHeader><SectionCardContent className="space-y-4">
      <p>{closed ? 'Participation closed' : 'Participation period open'}</p>
      <p className="text-sm text-muted-foreground">Sign in with an authorized supplier account. The buying workspace must grant representation before you can participate; public visibility does not grant access.</p>
      <p className="text-sm">Participation: {terms.participation.replaceAll('_', ' ')} · Offer opening: {terms.opening_policy.replaceAll('_', ' ')}</p>
      <p className="text-sm">Participation closes: {new Date(terms.participation_deadline).toLocaleString('en', { timeZone: 'UTC' })} UTC</p>
      <p className="text-sm">Opening: {new Date(terms.opening_at).toLocaleString('en', { timeZone: 'UTC' })} UTC</p>
    </SectionCardContent></SectionCard></aside></div>
    <p className="text-sm text-muted-foreground">This page contains published requirements only. Viewing a tender is not a supplier invitation, quotation submission, award, or purchase order.</p>
  </main><TenderFooter /></div>
}