"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Input } from "@/app/components/ui/input"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Search } from "@/app/components/ui/icons"
import { AgentList } from "@/app/components/agents/agent-list"
import { Agent, AgentType } from "@/app/types/agents"

export const agents: Agent[] = [
  {
    id: "1",
    name: "Sales Assistant",
    description: "Helps qualify leads and answer product questions",
    type: "sales",
    status: "active",
    conversations: 342,
    successRate: 78,
    lastActive: "2024-01-25",
    icon: "ShoppingCart"
  },
  {
    id: "2",
    name: "Support Agent",
    description: "Handles customer support inquiries and troubleshooting",
    type: "support",
    status: "learning",
    conversations: 1342,
    successRate: 94,
    lastActive: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    icon: "HelpCircle"
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
    icon: "BarChart"
  },
  {
    id: "4",
    name: "Product Expert",
    description: "Detailed product information and feature explanations",
    type: "sales",
    status: "learning",
    conversations: 45,
    successRate: 67,
    lastActive: "2024-01-20",
    icon: "Tag"
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
    icon: "Settings"
  },
  {
    id: "6",
    name: "Lead Generation Specialist",
    description: "Focuses on identifying and qualifying potential leads",
    type: "sales",
    status: "active",
    conversations: 278,
    successRate: 82,
    lastActive: "2024-01-23",
    icon: "Users"
  },
  {
    id: "7",
    name: "Sales Closer",
    description: "Specialized in converting qualified leads into customers",
    type: "sales",
    status: "active",
    conversations: 156,
    successRate: 91,
    lastActive: "2024-01-26",
    icon: "Check"
  },
  {
    id: "8",
    name: "Account Manager",
    description: "Handles ongoing client relationships and upselling",
    type: "sales",
    status: "active",
    conversations: 423,
    successRate: 88,
    lastActive: "2024-01-24",
    icon: "User"
  },
  {
    id: "9",
    name: "SEO Specialist",
    description: "Provides guidance on search engine optimization strategies",
    type: "marketing",
    status: "active",
    conversations: 134,
    successRate: 79,
    lastActive: "2024-01-22",
    icon: "Search"
  },
  {
    id: "10",
    name: "Content Marketing Expert",
    description: "Specializes in content strategy and creation",
    type: "marketing",
    status: "learning",
    conversations: 87,
    successRate: 75,
    lastActive: "2024-01-19",
    icon: "FileText"
  },
  {
    id: "11",
    name: "Social Media Manager",
    description: "Handles social media strategy and campaign execution",
    type: "marketing",
    status: "active",
    conversations: 256,
    successRate: 84,
    lastActive: "2024-01-25",
    icon: "Globe"
  },
  {
    id: "12",
    name: "Growth Hacker",
    description: "Focuses on innovative strategies for rapid business growth",
    type: "marketing",
    status: "active",
    conversations: 123,
    successRate: 80,
    lastActive: "2024-01-23",
    icon: "TrendingUp"
  },
  {
    id: "13",
    name: "Email Marketing Specialist",
    description: "Expert in email campaign strategy and optimization",
    type: "marketing",
    status: "learning",
    conversations: 167,
    successRate: 82,
    lastActive: "2024-01-21",
    icon: "Mail"
  },
  {
    id: "14",
    name: "Analytics & Data Expert",
    description: "Provides insights from marketing and sales data",
    type: "marketing",
    status: "active",
    conversations: 92,
    successRate: 90,
    lastActive: "2024-01-24",
    icon: "PieChart"
  }
]

export default function AgentsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const router = useRouter()
  
  console.log("Rendering AgentsPage, agents:", agents)

  // Restablecer el breadcrumb cuando se cargue la página principal de agentes
  useEffect(() => {
    // Actualizar el título de la página
    document.title = 'Agents | Market Fit';
    
    // Emitir un evento para restablecer el breadcrumb
    const event = new CustomEvent('breadcrumb:update', {
      detail: {
        title: null
      }
    });
    
    window.dispatchEvent(event);
  }, []);

  const filteredAgents = agents.filter(agent => 
    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleManageAgent = (agent: Agent) => {
    console.log("Managing agent:", agent.id)
    router.push(`/agents/${agent.id}`)
  }

  const handleChatWithAgent = (agent: Agent) => {
    console.log("Navigating to chat with agent:", agent.id)
    router.push(`/chat?agentId=${agent.id}&agentName=${encodeURIComponent(agent.name)}`)
  }

  return (
    <div className="flex-1 p-0">
      <Tabs defaultValue="all" className="space-y-4">
        <StickyHeader>
          <div className="px-16 pt-0">
            <div className="flex items-center gap-8">
              <div className="flex-1">
                <TabsList>
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