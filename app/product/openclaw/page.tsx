import { Metadata } from "next"
import { OpenclawClient } from "./OpenclawClient"

export const metadata: Metadata = {
  title: "Open Claw | Your Digital Workforce",
  description: "Hire AI agents to handle repetitive tasks, generate content, and analyze data 24/7 without needing to scale your headcount.",
  openGraph: {
    title: "Open Claw | Makinari",
    description: "Hire AI agents to handle repetitive tasks 24/7 without scaling headcount.",
    type: "website",
  }
}

export default function OpenclawPage() {
  return <OpenclawClient />
}