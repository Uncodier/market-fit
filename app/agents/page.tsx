"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Input } from "@/app/components/ui/input"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Search } from "@/app/components/ui/icons"
import { AgentList } from "@/app/components/agents/agent-list"
import { Agent, AgentType } from "@/app/types/agents"

const agents: Agent[] = [
  {
    id: "1",
    name: "Sales Assistant",
    description: "Helps qualify leads and answer product questions",
    type: "sales",
    status: "active",
    conversations: 342,
    successRate: 78,
    lastActive: "2024-01-25",
  },
  {
    id: "2",
    name: "Support Agent",
    description: "Handles customer support inquiries and troubleshooting",
    type: "support",
    status: "active",
    conversations: 567,
    successRate: 92,
    lastActive: "2024-01-25",
  },
  {
    id: "3",
    name: "Marketing Specialist",
    description: "Provides information about marketing campaigns",
    type: "marketing",
    status: "active",
    conversations: 189,
    successRate: 85,
    lastActive: "2024-01-24",
  },
  {
    id: "4",
    name: "Product Expert",
    description: "Detailed product information and feature explanations",
    type: "sales",
    status: "training",
    conversations: 45,
    successRate: 67,
    lastActive: "2024-01-20",
  },
  {
    id: "5",
    name: "Technical Support",
    description: "Advanced technical troubleshooting and guidance",
    type: "support",
    status: "inactive",
    conversations: 231,
    successRate: 88,
    lastActive: "2024-01-15",
  },
]

export default function AgentsPage() {
  const [searchQuery, setSearchQuery] = useState("")

  const filteredAgents = agents.filter(agent => 
    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleManageAgent = (agent: Agent) => {
    console.log("Managing agent:", agent.id)
    // Implementar lógica de gestión
  }

  const handleChatWithAgent = (agent: Agent) => {
    console.log("Chatting with agent:", agent.id)
    // Implementar lógica de chat
  }

  return (
    <div className="flex-1 p-0">
      <Tabs defaultValue="all" className="space-y-4">
        <StickyHeader>
          <div className="px-16 pt-0">
            <div className="flex items-center gap-8">
              <div className="flex-1">
                <TabsList className="w-full">
                  <TabsTrigger value="all">All Agents</TabsTrigger>
                  <TabsTrigger value="sales">Sales</TabsTrigger>
                  <TabsTrigger value="support">Support</TabsTrigger>
                  <TabsTrigger value="marketing">Marketing</TabsTrigger>
                </TabsList>
              </div>
              <div className="relative w-64">
                <Input 
                  placeholder="Search agents..." 
                  className="w-full"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  icon={<Search className="h-4 w-4 text-muted-foreground" />}
                />
                <kbd className="pointer-events-none absolute right-2 top-4 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </div>
            </div>
          </div>
        </StickyHeader>
        
        <div className="p-8 space-y-4">
          <div className="px-8">
            <TabsContent value="all">
              <AgentList 
                agents={filteredAgents}
                onManageAgent={handleManageAgent}
                onChatWithAgent={handleChatWithAgent}
              />
            </TabsContent>
            <TabsContent value="sales">
              <AgentList 
                agents={filteredAgents}
                type="sales"
                onManageAgent={handleManageAgent}
                onChatWithAgent={handleChatWithAgent}
              />
            </TabsContent>
            <TabsContent value="support">
              <AgentList 
                agents={filteredAgents}
                type="support"
                onManageAgent={handleManageAgent}
                onChatWithAgent={handleChatWithAgent}
              />
            </TabsContent>
            <TabsContent value="marketing">
              <AgentList 
                agents={filteredAgents}
                type="marketing"
                onManageAgent={handleManageAgent}
                onChatWithAgent={handleChatWithAgent}
              />
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  )
}