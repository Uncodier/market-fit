import { Metadata } from "next"
import { PartnerCommissionsClient } from "./PartnerCommissionsClient"

export const metadata: Metadata = {
  title: "Partner Commissions | Makinari",
  description: "Variable commission structure for partners and distributors.",
  openGraph: {
    title: "Partner Commissions | Makinari",
    description: "Variable commission structure for partners and distributors.",
    type: "website",
  }
}

export default function PartnerCommissionsPage() {
  return <PartnerCommissionsClient />
}