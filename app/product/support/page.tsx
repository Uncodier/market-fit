import { Metadata } from "next"
import { SupportClient } from "./SupportClient"

export const metadata: Metadata = {
  title: "Support & Customer Success | Makinari",
  description: "Manage tickets from web, WhatsApp, and email with proactive AI agents that resolve issues instantly.",
  openGraph: {
    title: "Support & Customer Success | Makinari",
    description: "Manage tickets from web, WhatsApp, and email with proactive AI agents.",
    type: "website",
  }
}

export default function SupportPage() {
  return <SupportClient />
}
