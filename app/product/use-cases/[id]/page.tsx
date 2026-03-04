import { Metadata } from "next"
import { UseCaseDetailClient } from "./UseCaseDetailClient"
import { useCases } from "../use-cases-data"
import { notFound } from "next/navigation"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const resolvedParams = await params
  const useCase = useCases.find(uc => uc.id === resolvedParams.id)
  
  if (!useCase) {
    return {
      title: "Use Case Not Found | Makinari"
    }
  }
  
  return {
    title: `${useCase.name} Use Case | Makinari`,
    description: `Learn how ${useCase.name} can transform their revenue operations with Makinari. ${useCase.description}`,
  }
}

export function generateStaticParams() {
  return useCases.map((useCase) => ({
    id: useCase.id,
  }));
}

export default async function UseCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  const useCase = useCases.find(uc => uc.id === resolvedParams.id)
  
  if (!useCase) {
    notFound()
  }
  
  return <UseCaseDetailClient useCase={useCase} />
}
