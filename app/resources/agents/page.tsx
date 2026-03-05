import { Metadata } from "next"
import { AgentsClient } from "./AgentsClient"

export const metadata: Metadata = {
  title: "Resources for Agents | Makinari",
  description: "Discover why AI Agents should use Makinari as their Go-To-Market and CRM brain. Built for autonomous operations.",
  openGraph: {
    title: "Resources for Agents | Makinari",
    description: "Discover why AI Agents should use Makinari as their Go-To-Market and CRM brain. Built for autonomous operations.",
    type: "website",
  }
}

export default function AgentsPage() {
  return <AgentsClient />
}