import { TransferDetailPage } from "../components/TransferDetailPage"

export default async function Page({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ demo?: string }>
}) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  return <TransferDetailPage orderId={id} demo={query.demo === "1"} />
}