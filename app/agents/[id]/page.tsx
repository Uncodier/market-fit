"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import React from "react"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Textarea } from "@/app/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Label } from "@/app/components/ui/label"
import { Badge } from "@/app/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"
import { 
  SaveIcon,
  FileText,
  User as UserIcon,
  ShoppingCart,
  HelpCircle,
  BarChart,
  Tag,
  Settings,
  Users,
  Check,
  PieChart,
  Trash2
} from "@/app/components/ui/icons"
import { Agent } from "@/app/types/agents"
import { agents } from "../page"
import { cn } from "@/lib/utils"
import { AgentTool } from "@/app/components/agents/agent-tool"
import { AgentIntegration } from "@/app/components/agents/agent-integration"
import { ContextFile } from "@/app/components/agents/context-file"

export default function AgentManagePage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const router = useRouter()
  // Usar React.use() para acceder a params.id
  const unwrappedParams = React.use(params as Promise<{ id: string }>)
  const agentId = unwrappedParams.id
  
  // Find the agent from the mock data
  const agent = agents.find(a => a.id === agentId)
  
  const [name, setName] = useState(agent?.name || "")
  const [description, setDescription] = useState(agent?.description || "")
  const [prompt, setPrompt] = useState(`You are a helpful AI assistant specialized in ${agent?.type || "support"}. Your goal is to provide accurate and helpful information to users.`)
  const [activeTab, setActiveTab] = useState("basic")
  const [isSaving, setIsSaving] = useState(false)
  
  // Actualizar el título en el breadcrumb cuando se cargue la página
  useEffect(() => {
    if (agent) {
      // Actualizar el título de la página para el breadcrumb
      document.title = `${agent.name} | Agents`;
      
      // Emitir un evento personalizado para actualizar el breadcrumb
      const event = new CustomEvent('breadcrumb:update', {
        detail: {
          title: agent.name
        }
      });
      
      window.dispatchEvent(event);
    }
    
    // Limpiar al desmontar
    return () => {
      document.title = 'Agents | Market Fit';
    };
  }, [agent]);
  
  // Mock tools data
  const [tools, setTools] = useState([
    { id: "search", name: "Web Search", description: "Search the web for real-time information", enabled: true },
    { id: "code", name: "Code Interpreter", description: "Execute code and analyze data", enabled: false },
    { id: "files", name: "File Browser", description: "Browse and access files in the workspace", enabled: true },
    { id: "knowledge", name: "Knowledge Base", description: "Access company knowledge base", enabled: true },
    { id: "calendar", name: "Calendar", description: "Check and manage calendar events", enabled: false },
  ])
  
  // Mock integrations data
  const [integrations, setIntegrations] = useState([
    { id: "slack", name: "Slack", description: "Connect to Slack workspace", connected: true },
    { id: "salesforce", name: "Salesforce", description: "Access Salesforce CRM data", connected: false },
    { id: "zendesk", name: "Zendesk", description: "Integrate with Zendesk support tickets", connected: true },
    { id: "hubspot", name: "HubSpot", description: "Connect to HubSpot CRM", connected: false },
    { id: "google", name: "Google Workspace", description: "Access Google Docs, Sheets, etc.", connected: false },
  ])
  
  // Mock context files data
  const [contextFiles, setContextFiles] = useState([
    { id: "file1", name: "Product Manual.pdf", path: "/docs/product-manual.pdf" },
    { id: "file2", name: "FAQ.md", path: "/docs/faq.md" },
    { id: "file3", name: "Pricing.xlsx", path: "/docs/pricing.xlsx" },
  ])
  
  // Handle tool toggle
  const handleToolToggle = (toolId: string, enabled: boolean) => {
    setTools(tools.map(tool => 
      tool.id === toolId ? { ...tool, enabled } : tool
    ))
  }
  
  // Handle integration toggle
  const handleIntegrationToggle = (integrationId: string, connected: boolean) => {
    setIntegrations(integrations.map(integration => 
      integration.id === integrationId ? { ...integration, connected } : integration
    ))
  }
  
  // Handle file removal
  const handleFileRemove = (fileId: string) => {
    setContextFiles(contextFiles.filter(file => file.id !== fileId))
  }
  
  // Handle add file (mock)
  const handleAddFile = () => {
    const newId = `file${contextFiles.length + 1}`
    const newFile = { 
      id: newId, 
      name: `New File ${contextFiles.length + 1}.txt`, 
      path: `/docs/new-file-${contextFiles.length + 1}.txt` 
    }
    setContextFiles([...contextFiles, newFile])
  }
  
  // Handle save
  const handleSave = () => {
    setIsSaving(true)
    
    // Simulación de guardado
    setTimeout(() => {
      console.log("Saving agent configuration:", {
        id: agentId,
        name,
        description,
        prompt,
        tools,
        integrations,
        contextFiles
      })
      // Here you would save the data to your backend
      setIsSaving(false)
      router.push("/agents")
    }, 1000)
  }
  
  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value)
  }
  
  // If agent not found
  if (!agent) {
    return (
      <div className="flex-1 p-8 flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">Agent not found</h1>
        <p className="text-muted-foreground mb-6">The agent you're looking for doesn't exist or has been deleted.</p>
        <Button onClick={() => router.push("/agents")}>
          Back to Agents
        </Button>
      </div>
    )
  }
  
  return (
    <div className="flex-1 p-0">
      <StickyHeader>
        <div className="flex items-center justify-between px-16 w-full">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-auto">
            <TabsList>
              <TabsTrigger value="basic">Basic Information</TabsTrigger>
              <TabsTrigger value="tools">Tools</TabsTrigger>
              <TabsTrigger value="integrations">Integrations</TabsTrigger>
              <TabsTrigger value="context">Context Files</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              "Saving..."
            ) : (
              <>
                <SaveIcon className="h-4 w-4 mr-2" />
                Save changes
              </>
            )}
          </Button>
        </div>
      </StickyHeader>
      
      <div className="px-16 py-8 pb-16 max-w-[880px] mx-auto">
        {activeTab === "basic" && (
          <>
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>
                  Configure the basic details of your agent
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input 
                    id="name" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="Enter agent name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea 
                    id="description" 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)} 
                    placeholder="Enter agent description"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
            
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Agent Prompt</CardTitle>
                <CardDescription>
                  Define the system prompt that sets the behavior and capabilities of your agent
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea 
                  value={prompt} 
                  onChange={(e) => setPrompt(e.target.value)} 
                  placeholder="Enter system prompt for the agent"
                  rows={10}
                  className="font-mono text-sm"
                />
              </CardContent>
            </Card>
          </>
        )}
        
        {activeTab === "tools" && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Available Tools</CardTitle>
              <CardDescription>
                Enable or disable tools that your agent can use
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {tools.map(tool => (
                  <AgentTool 
                    key={tool.id}
                    id={tool.id}
                    name={tool.name}
                    description={tool.description}
                    enabled={tool.enabled}
                    onToggle={handleToolToggle}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        
        {activeTab === "integrations" && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Integrations</CardTitle>
              <CardDescription>
                Connect your agent to external services and data sources
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {integrations.map(integration => (
                  <AgentIntegration 
                    key={integration.id}
                    id={integration.id}
                    name={integration.name}
                    description={integration.description}
                    connected={integration.connected}
                    onToggle={handleIntegrationToggle}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        
        {activeTab === "context" && (
          <Card className="mb-8">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Context Files</CardTitle>
                <CardDescription>
                  Add files that provide context for your agent
                </CardDescription>
              </div>
              <Button onClick={handleAddFile} size="sm">
                Add File
              </Button>
            </CardHeader>
            <CardContent>
              {contextFiles.length > 0 ? (
                <div className="space-y-2">
                  {contextFiles.map(file => (
                    <ContextFile 
                      key={file.id}
                      id={file.id}
                      name={file.name}
                      path={file.path}
                      onRemove={handleFileRemove}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FileText className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium mb-1">No context files added</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Add files to provide additional context for your agent
                  </p>
                  <Button onClick={handleAddFile} size="sm">
                    Add File
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
} 