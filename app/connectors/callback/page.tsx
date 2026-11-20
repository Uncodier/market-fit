import { Suspense } from "react"
import type { Metadata } from "next"
import ConnectorCallback from "./connector-callback"
import { ConnectorLoading } from "../connector-feedback"

export const metadata: Metadata = { referrer: "no-referrer", robots: { index: false, follow: false } }

export default function Page() {
  return <Suspense fallback={<ConnectorLoading />}><ConnectorCallback /></Suspense>
}