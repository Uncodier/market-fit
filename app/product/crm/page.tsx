import { Metadata } from "next"
import { CrmClient } from "./CrmClient"

export const metadata: Metadata = {
  title: "CRM | AI-Powered Customer Relationship Management",
  description: "Operate from a single source of truth. Your pipeline manages itself with automated activity logging and stage gating.",
  openGraph: {
    title: "CRM | Makinari",
    description: "Operate from a single source of truth.",
    type: "website",
  }
}

export default function CrmPage() {
  return <CrmClient />
}
