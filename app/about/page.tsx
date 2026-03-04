import { Metadata } from "next"
import { AboutClient } from "./AboutClient"

export const metadata: Metadata = {
  title: "About Us | Makinari",
  description: "Meet the founders and team behind Makinari, making tomorrow's tech today with expertise that shapes the future of business.",
  openGraph: {
    title: "About Us | Makinari",
    description: "Meet the founders and team behind Makinari.",
    type: "website",
  }
}

export default function AboutPage() {
  return <AboutClient />
}
