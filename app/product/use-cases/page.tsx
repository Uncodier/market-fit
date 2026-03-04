import { Metadata } from "next"
import { UseCasesClient } from "./UseCasesClient"

export const metadata: Metadata = {
  title: "Use Cases | Makinari for your Industry",
  description: "Discover how Makinari transforms revenue operations across different business models and industries.",
  openGraph: {
    title: "Use Cases | Makinari",
    description: "Discover how Makinari transforms revenue operations across different business models and industries.",
    type: "website",
  }
}

export default function UseCasesPage() {
  return <UseCasesClient />
}
