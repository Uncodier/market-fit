import { TransferOrdersPage } from "../movements/components/TransferOrdersPage"

export default async function Page({ searchParams }: { searchParams: Promise<{ demo?: string; sort?: string }> }) {
  const query = await searchParams
  return <TransferOrdersPage demo={query.demo === "1"} initialSort={query.sort === "oldest" ? "oldest" : "newest"} />
}