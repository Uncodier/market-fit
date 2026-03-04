import { Metadata } from "next"
import { PartnerCommissionsClient } from "./PartnerCommissionsClient"

export const metadata: Metadata = {
  title: "Partner Commissions | Makinari",
  description: "Estructura de comisiones variables para partners y distribuidores.",
  openGraph: {
    title: "Partner Commissions | Makinari",
    description: "Estructura de comisiones variables para partners y distribuidores.",
    type: "website",
  }
}

export default function PartnerCommissionsPage() {
  return <PartnerCommissionsClient />
}