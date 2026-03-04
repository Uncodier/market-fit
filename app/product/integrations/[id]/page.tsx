import { Metadata } from "next"
import { IntegrationDetailClient } from "./IntegrationDetailClient"
import { integrations, moreIntegrations } from "../integrations-data"
import { notFound } from "next/navigation"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const allIntegrations = [...integrations];
  // Note: we don't need to push moreIntegrations if it's already in the integrations array,
  // but to be safe let's combine them or use the full list
  const integration = allIntegrations.find(i => i.id === resolvedParams.id)
  
  if (!integration) {
    return {
      title: "Integration Not Found | Makinari"
    }
  }
  
  return {
    title: `${integration.name} Integration | Makinari`,
    description: `Connect ${integration.name} with Makinari. ${integration.description}`,
  }
}

// In Next.js App Router, using `generateStaticParams` ensures static paths are generated correctly
export function generateStaticParams() {
  return [...integrations].map((integration) => ({
    id: integration.id,
  }));
}

export default async function IntegrationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const allIntegrations = [...integrations];
  const integration = allIntegrations.find(i => i.id === resolvedParams.id)
  
  if (!integration) {
    notFound()
  }
  
  return <IntegrationDetailClient integration={integration} />
}
