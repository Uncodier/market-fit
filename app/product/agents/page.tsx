import { Metadata } from "next"
import { AgentsClient } from "./AgentsClient"

export const metadata: Metadata = {
  title: "AI Agents | Capabilities",
  description: "Explore the capabilities of our AI Agents by use case.",
  openGraph: {
    title: "AI Agents | Makinari",
    description: "Explore the capabilities of our AI Agents by use case.",
    type: "website",
  }
}

export default function AgentsPage() {
  return <AgentsClient />
}
