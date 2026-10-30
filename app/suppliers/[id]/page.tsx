import { SuppliersWorkspace } from "../components/workspace"

export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <SuppliersWorkspace id={id} />
}