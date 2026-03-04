import { Metadata } from "next"
import { FeaturesClient } from "./FeaturesClient"

export const metadata: Metadata = {
  title: "Features | Complete Toolkit for Revenue Operations",
  description: "Everything you need to automate your entire sales process, from lead generation to closing deals.",
  openGraph: {
    title: "Features | Makinari",
    description: "Everything you need to automate your entire sales process.",
    type: "website",
  }
}

export default function FeaturesPage() {
  return <FeaturesClient />
}
