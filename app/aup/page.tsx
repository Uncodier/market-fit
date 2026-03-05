import { Metadata } from "next"
import { AupClient } from "./AupClient"

export const metadata: Metadata = {
  title: "Acceptable Use Policy | Makinari",
  description: "Acceptable Use Policy for Makinari services.",
  openGraph: {
    title: "Acceptable Use Policy | Makinari",
    description: "Acceptable Use Policy for Makinari services.",
    type: "website",
  }
}

export default function AupPage() {
  return <AupClient />
}
