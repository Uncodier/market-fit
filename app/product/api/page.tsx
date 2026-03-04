import { Metadata } from "next"
import { ApiClient } from "./ApiClient"

export const metadata: Metadata = {
  title: "API & MCP Server | Makinari",
  description: "Connect your AI models directly with our MCP Server or integrate programmatically using our REST API.",
  openGraph: {
    title: "API & MCP Server | Makinari",
    description: "Connect your AI models directly with our MCP Server or integrate programmatically using our REST API.",
    type: "website",
  }
}

export default function ApiPage() {
  return <ApiClient />
}
