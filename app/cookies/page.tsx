import { Metadata } from "next"
import { CookiesClient } from "./CookiesClient"

export const metadata: Metadata = {
  title: "Cookie Policy | Makinari",
  description: "Cookie Policy explaining how Makinari uses cookies and similar technologies.",
  openGraph: {
    title: "Cookie Policy | Makinari",
    description: "Cookie Policy explaining how Makinari uses cookies and similar technologies.",
    type: "website",
  }
}

export default function CookiesPage() {
  return <CookiesClient />
}
