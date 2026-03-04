import { Metadata } from "next"
import { OutboundClient } from "./OutboundClient"

export const metadata: Metadata = {
  title: "Outbound | AI-Powered Sales Outreach",
  description: "Build pipeline without the patchwork. Natively integrated sequencing and omni-channel outbound.",
  openGraph: {
    title: "Outbound | Makinari",
    description: "Build pipeline without the patchwork.",
    type: "website",
  }
}

export default function OutboundPage() {
  return <OutboundClient />
}
