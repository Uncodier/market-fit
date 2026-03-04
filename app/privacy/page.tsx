import { Metadata } from "next"
import { PrivacyClient } from "./PrivacyClient"

export const metadata: Metadata = {
  title: "Privacy Policy | Makinari",
  description: "Privacy Policy and data handling practices at Makinari.",
  openGraph: {
    title: "Privacy Policy | Makinari",
    description: "Privacy Policy and data handling practices at Makinari.",
    type: "website",
  }
}

export default function PrivacyPage() {
  return <PrivacyClient />
}
