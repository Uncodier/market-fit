"use client"

import dynamic from "next/dynamic"
import { RecordDetailSkeleton } from "./components/RecordDetailSkeleton"

const RecordDetailPage = dynamic(() => import("./record-item-client"), {
  ssr: false,
  loading: () => <RecordDetailSkeleton />
})

export default function Page() {
  return <RecordDetailPage />
}
