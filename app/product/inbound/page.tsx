import { Metadata } from "next"
import { InboundClient } from "./InboundClient"

export const metadata: Metadata = {
  title: "Inbound | AI-Driven Demand Generation",
  description: "Turn traffic into conversions. Capture high-intent leads on autopilot and keep your inbound pipeline full.",
  openGraph: {
    title: "Inbound | Makinari",
    description: "Turn traffic into conversions.",
    type: "website",
  }
}

export default function InboundPage() {
  return <InboundClient />
}
