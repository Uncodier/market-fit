"use client"

import React from "react"
import { BuyerQuoteDetailView } from "@/app/buyer/components/BuyerQuoteDetailView"
import { BuyerShell } from "@/app/buyer/components/BuyerShell"

export default function PublicQuotePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const resolvedParams = React.use(params)

  return (
    <BuyerShell requireAuth={false}>
      <BuyerQuoteDetailView
        publicAccessToken={resolvedParams.token}
        backHref={null}
        returnUrl={`/q/${resolvedParams.token}`}
      />
    </BuyerShell>
  )
}
