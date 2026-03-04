import { Metadata } from "next"
import { TermsClient } from "./TermsClient"

export const metadata: Metadata = {
  title: "Terms of Service | Makinari",
  description: "Terms of Service and conditions for using Makinari.",
  openGraph: {
    title: "Terms of Service | Makinari",
    description: "Terms of Service and conditions for using Makinari.",
    type: "website",
  }
}

export default function TermsPage() {
  return <TermsClient />
}
