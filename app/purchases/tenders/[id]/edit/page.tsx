import { TenderEditor } from '../../tender-editor'
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <TenderEditor id={(await params).id} />
}