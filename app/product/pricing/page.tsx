import { Metadata } from "next"
import { PricingClient } from "./PricingClient"

export const metadata: Metadata = {
  title: "Pricing | Simple, Transparent Pricing",
  description: "Start for free and scale as you grow. No hidden fees. Only pay for the usage you actually consume.",
  openGraph: {
    title: "Pricing | Makinari",
    description: "Start for free and scale as you grow. Only pay for the usage you actually consume.",
    type: "website",
  }
}

export default function PricingPage() {
  return <PricingClient />
}
