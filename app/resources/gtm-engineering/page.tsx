import { Metadata } from "next"
import { GtmEngineeringClient } from "./GtmEngineeringClient"

export const metadata: Metadata = {
  title: "GTM Engineering & RevOps Automation Platform | Makinari",
  description: "The ultimate platform for Go-To-Market Engineers and RevOps teams. Build, deploy, and scale intent-driven revenue engines on a unified architecture with programmable AI agents and native B2B data orchestration.",
  openGraph: {
    title: "GTM Engineering & RevOps Automation Platform | Makinari",
    description: "The ultimate platform for Go-To-Market Engineers and RevOps teams. Build, deploy, and scale intent-driven revenue engines on a unified architecture with programmable AI agents and native B2B data orchestration.",
    type: "website",
  }
}

export default function GtmEngineeringPage() {
  return <GtmEngineeringClient />
}
