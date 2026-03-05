import { Metadata } from "next"
import { ReportingClient } from "./ReportingClient"

export const metadata: Metadata = {
  title: "Reporting & Analytics | Data-Driven Growth",
  description: "Uncover insights that drive your business. Track product usage, sales pipeline, and marketing ROI with real-time reporting.",
  openGraph: {
    title: "Reporting | Makinari",
    description: "Uncover insights that drive your business.",
    type: "website",
  }
}

export default function ReportingPage() {
  return <ReportingClient />
}