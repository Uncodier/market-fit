import { Metadata } from "next"
import { AgentsClient } from "./AgentsClient"

export const metadata: Metadata = {
  title: "AI Agents | Your Digital Workforce",
  description: "Hire AI agents to handle repetitive tasks, generate content, and analyze data 24/7 without needing to scale your headcount.",
  openGraph: {
    title: "AI Agents | Makinari",
    description: "Hire AI agents to handle repetitive tasks 24/7 without scaling headcount.",
    type: "website",
  }
}

export default function AgentsPage() {
  return <AgentsClient />
}