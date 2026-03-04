import { Metadata } from "next"
import { GlossaryDetailClient } from "./GlossaryDetailClient"
import { glossaryTerms } from "../../glossary-data"
import { notFound } from "next/navigation"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const resolvedParams = await params
  const termData = glossaryTerms.find(g => g.id === resolvedParams.id)
  
  if (!termData) {
    return {
      title: "Term Not Found | GTM Glossary | Makinari"
    }
  }
  
  return {
    title: `${termData.term} | GTM Glossary | Makinari`,
    description: termData.definition,
  }
}

export function generateStaticParams() {
  return glossaryTerms.map((termData) => ({
    id: termData.id,
  }));
}

export default async function GlossaryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  const termData = glossaryTerms.find(g => g.id === resolvedParams.id)
  
  if (!termData) {
    notFound()
  }
  
  return <GlossaryDetailClient termData={termData} />
}
