import { Metadata } from "next"
import { GuideDetailClient } from "./GuideDetailClient"
import { guides } from "../guides-data"
import { notFound } from "next/navigation"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const resolvedParams = await params
  const guide = guides.find(g => g.id === resolvedParams.id)
  
  if (!guide) {
    return {
      title: "Guide Not Found | Makinari"
    }
  }
  
  return {
    title: `${guide.name} | GTM Guides | Makinari`,
    description: guide.description,
  }
}

export function generateStaticParams() {
  return guides.map((guide) => ({
    id: guide.id,
  }));
}

export default async function GuideDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  const guide = guides.find(g => g.id === resolvedParams.id)
  
  if (!guide) {
    notFound()
  }
  
  return <GuideDetailClient guide={guide} />
}