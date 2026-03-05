import { Metadata } from "next"
import { DpaClient } from "./DpaClient"

export const metadata: Metadata = {
  title: "Data Processing Agreement | Makinari",
  description: "Data Processing Agreement (DPA) outlining the terms for processing personal data at Makinari.",
  openGraph: {
    title: "Data Processing Agreement | Makinari",
    description: "Data Processing Agreement (DPA) outlining the terms for processing personal data at Makinari.",
    type: "website",
  }
}

export default function DpaPage() {
  return <DpaClient />
}
