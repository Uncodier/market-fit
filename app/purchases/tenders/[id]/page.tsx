import { TenderDetail } from '../tender-detail'
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <TenderDetail id={(await params).id} />
}