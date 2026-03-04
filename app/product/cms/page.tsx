import { Metadata } from "next"
import { CmsClient } from "./CmsClient"

export const metadata: Metadata = {
  title: "CMS | AI Content Management System",
  description: "Automate your content pipeline from creation to distribution. Build your brand with SEO-optimized, auto-generated content.",
  openGraph: {
    title: "CMS | Makinari",
    description: "Automate your content pipeline.",
    type: "website",
  }
}

export default function CmsPage() {
  return <CmsClient />
}
