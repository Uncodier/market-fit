import { Metadata } from "next"
import { FeatureDetailClient } from "./FeatureDetailClient"
import { features } from "../features-data"
import { notFound } from "next/navigation"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const resolvedParams = await params
  const feature = features.find(f => f.id === resolvedParams.id)
  
  if (!feature) {
    return {
      title: "Feature Not Found | Makinari"
    }
  }
  
  return {
    title: `${feature.name} Feature | Makinari`,
    description: `Learn more about the ${feature.name} feature in Makinari. ${feature.description}`,
  }
}

export function generateStaticParams() {
  return features.map((feature) => ({
    id: feature.id,
  }));
}

export default async function FeatureDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  const feature = features.find(f => f.id === resolvedParams.id)
  
  if (!feature) {
    notFound()
  }
  
  return <FeatureDetailClient feature={feature} />
}
