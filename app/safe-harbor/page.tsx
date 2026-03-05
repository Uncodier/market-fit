import { Metadata } from "next"
import { SafeHarborClient } from "./SafeHarborClient"

export const metadata: Metadata = {
  title: "Safe Harbor Policy | Makinari",
  description: "Safe Harbor Policy regarding forward-looking statements, product roadmaps, and AI performance at Makinari.",
  openGraph: {
    title: "Safe Harbor Policy | Makinari",
    description: "Safe Harbor Policy regarding forward-looking statements, product roadmaps, and AI performance at Makinari.",
    type: "website",
  }
}

export default function SafeHarborPage() {
  return <SafeHarborClient />
}
