import { Metadata } from "next"
import { GtmEngineeringClient } from "./GtmEngineeringClient"

export const metadata: Metadata = {
  title: "GTM Engineering Platform | Makinari",
  description: "The ultimate platform for Go-To-Market Engineers. Build, deploy, and scale robust revenue engines on a unified architecture with programmable AI agents.",
  openGraph: {
    title: "GTM Engineering Platform | Makinari",
    description: "The ultimate platform for Go-To-Market Engineers. Build, deploy, and scale robust revenue engines on a unified architecture with programmable AI agents.",
    type: "website",
  }
}

export default function GtmEngineeringPage() {
  return <GtmEngineeringClient />
}
