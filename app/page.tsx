import { Metadata } from "next"
import { AuthLandingClient } from "@/app/components/auth/AuthLandingClient"

export const metadata: Metadata = {
  title: "Makinari | The Revenue Operations Platform",
  description: "Complete Toolkit for Revenue Operations. Automate your entire sales process with AI agents that work 24/7. From lead generation to closing deals.",
  openGraph: {
    title: "Makinari | The Revenue Operations Platform",
    description: "Automate your entire sales process with AI agents that work 24/7.",
    type: "website",
    images: [
      {
        url: "/opengraph-image.jpg",
        width: 1200,
        height: 630,
        alt: "MAKINARI Preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Makinari | The Revenue Operations Platform",
    description: "Automate your entire sales process with AI agents that work 24/7.",
    images: ["/opengraph-image.jpg"],
  }
}

export default function HomePage() {
  return <AuthLandingClient />
}
