"use client"

import dynamic from "next/dynamic"
import { useParams } from "next/navigation"
import { RecordDetailSkeleton } from "./components/RecordDetailSkeleton"

const RecordDetailPage = dynamic(() => import("./record-item-client"), {
  ssr: false,
  loading: () => <RecordDetailSkeleton />
})

export default function Page() {
  const { id } = useParams<{ id: string }>()
  return <RecordDetailPage key={id} />
}
