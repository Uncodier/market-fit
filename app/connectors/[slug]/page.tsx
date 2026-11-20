import { Suspense } from "react"
import ConnectorDetailPage from "../connector-detail"
import { ConnectorDetailSkeleton } from "../connector-skeletons"

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <Suspense fallback={<ConnectorDetailSkeleton fullPage />}><ConnectorDetailPage slug={slug} /></Suspense>
}