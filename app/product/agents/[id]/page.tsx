import { Metadata } from "next"
import { AgentDetailClient } from "./AgentDetailClient"
import { agents } from "@/app/data/mock-agents"
import { notFound } from "next/navigation"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const resolvedParams = await params
  const agent = agents.find(a => a.id === resolvedParams.id)
  
  if (!agent) {
    return {
      title: "Agent Not Found | Makinari"
    }
  }
  
  return {
    title: `${agent.name} | Makinari Agents`,
    description: `Learn more about the ${agent.name} agent in Makinari. ${agent.description}`,
  }
}

export function generateStaticParams() {
  return agents.map((agent) => ({
    id: agent.id,
  }));
}

export default async function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  const agent = agents.find(a => a.id === resolvedParams.id)
  
  if (!agent) {
    notFound()
  }
  
  return <AgentDetailClient agent={agent} />
}
