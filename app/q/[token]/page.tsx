"use client"

import React from "react"
import { BuyerQuoteDetailView } from "@/app/buyer/components/BuyerQuoteDetailView"

export default function PublicQuotePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const resolvedParams = React.use(params)

  return (
    <BuyerQuoteDetailView
      publicAccessToken={resolvedParams.token}
      backHref={null}
      returnUrl={`/q/${resolvedParams.token}`}
    />
  )
}
