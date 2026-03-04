import { Metadata } from "next"
import { AuthLandingClient } from "@/app/components/auth/AuthLandingClient"

export const metadata: Metadata = {
  title: "Makinari | The Revenue Operations Platform",
  description: "Complete Toolkit for Revenue Operations. Automate your entire sales process with AI agents that work 24/7. From lead generation to closing deals.",
  openGraph: {
    title: "Makinari | The Revenue Operations Platform",
    description: "Automate your entire sales process with AI agents that work 24/7.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Makinari | The Revenue Operations Platform",
    description: "Automate your entire sales process with AI agents that work 24/7.",
  }
}

export default function HomePage() {
  return <AuthLandingClient />
}
