"use client"

import dynamic from "next/dynamic"

const ContentDetailPage = dynamic(() => import("./content-item-client"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
      Loading...
    </div>
  ),
})

export default function Page(props: { params: Promise<{ id: string }> }) {
  return <ContentDetailPage {...props} />
}
