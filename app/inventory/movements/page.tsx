import { InventoryMovementsPage } from "./components/InventoryMovementsPage"

export default async function Page({ searchParams }: {
  searchParams: Promise<{ demo?: string; sort?: string }>
}) {
  const params = await searchParams
  return <InventoryMovementsPage demo={params.demo === "1"} initialSort={params.sort === "oldest" ? "oldest" : "newest"} />
}