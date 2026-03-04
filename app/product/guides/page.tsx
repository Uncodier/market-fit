import { Metadata } from "next"
import { GuidesClient } from "./GuidesClient"

export const metadata: Metadata = {
  title: "GTM Guides & Playbooks | Makinari",
  description: "Learn step-by-step Go-To-Market strategies, from cold email outreach to account-based marketing.",
  openGraph: {
    title: "GTM Guides & Playbooks | Makinari",
    description: "Learn step-by-step Go-To-Market strategies, from cold email outreach to account-based marketing.",
    type: "website",
  }
}

export default function GuidesPage() {
  return <GuidesClient />
}