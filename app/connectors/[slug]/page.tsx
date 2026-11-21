import ConnectorDetailPage from "../connector-detail"

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <ConnectorDetailPage slug={slug} />
}