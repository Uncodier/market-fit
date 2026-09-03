"use client"

import dynamic from "next/dynamic"

import { ContentSkeleton } from "./content-detail-skeleton"

const ContentDetailPage = dynamic(() => import("./content-item-client"), {
  ssr: false,
  loading: () => <ContentSkeleton />
})

export default function Page(props: { params: Promise<{ id: string }> }) {
  return <ContentDetailPage {...props} />
}
