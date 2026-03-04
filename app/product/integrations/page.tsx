import { Metadata } from "next"
import { IntegrationsClient } from "./IntegrationsClient"

export const metadata: Metadata = {
  title: "Integrations | Connect Your Entire Stack",
  description: "Sync data across your favorite tools. From CRMs to communication channels, we integrate with everything you need.",
  openGraph: {
    title: "Integrations | Makinari",
    description: "Connect your entire stack and sync data across your favorite tools.",
    type: "website",
  }
}

export default function IntegrationsPage() {
  return <IntegrationsClient />
}
