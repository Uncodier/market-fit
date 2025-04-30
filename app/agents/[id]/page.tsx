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
import { cn } from "@/lib/utils"
import { AgentTool } from "@/app/components/agents/agent-tool"
import { AgentIntegration } from "@/app/components/agents/agent-integration"
import { ContextFile } from "@/app/components/agents/context-file"
import { AgentTrigger } from "@/app/components/agents/agent-trigger"
import { SearchInput } from "@/app/components/ui/search-input"
import { Switch } from "@/app/components/ui/switch"
import { useSite } from "@/app/context/SiteContext"
import { createClient } from "@/lib/supabase/client"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { UploadFileDialog } from "@/app/components/agents/upload-file-dialog"
import { Skeleton } from "@/app/components/ui/skeleton"

// Get default tools for role
const getDefaultToolsForRole = (role: string = "") => {
  // All tools disabled by default for new agents
  return [
    { id: "search", name: "Web Search", description: "Search the web for real-time information", enabled: false },
    { id: "code", name: "Code Interpreter", description: "Execute code and analyze data", enabled: false },
    { id: "files", name: "File Browser", description: "Browse and access files in the workspace", enabled: false },
    { id: "knowledge", name: "Knowledge Base", description: "Access company knowledge base", enabled: false },
    { id: "calendar", name: "Calendar", description: "Check and manage calendar events", enabled: false },
  ]
}

// Get default integrations for role
const getDefaultIntegrationsForRole = () => {
  // All integrations disconnected by default for new agents
  return [
    { id: "slack", name: "Slack", description: "Connect to Slack workspace", connected: false },
    { id: "salesforce", name: "Salesforce", description: "Access Salesforce CRM data", connected: false },
    { id: "zendesk", name: "Zendesk", description: "Integrate with Zendesk support tickets", connected: false },
    { id: "hubspot", name: "HubSpot", description: "Connect to HubSpot CRM", connected: false },
    { id: "google", name: "Google Workspace", description: "Access Google Docs, Sheets, etc.", connected: false },
  ]
}

// Get default triggers for role
const getDefaultTriggersForRole = () => {
  // All triggers disabled by default for new agents
  return [
    { id: "message", name: "New Message", description: "Trigger when a new message is received", enabled: false },
    { id: "schedule", name: "Scheduled", description: "Trigger based on a schedule", enabled: false },
    { id: "webhook", name: "Webhook", description: "Trigger via webhook endpoint", enabled: false },
    { id: "email", name: "Email", description: "Trigger on new email", enabled: false },
    { id: "api", name: "API Call", description: "Trigger via API request", enabled: false },
  ]
}

// Esqueleto de carga para la sección de archivos contextuales
function ContextFilesSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-3">
        <div className="space-y-1">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-60" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>
      
      <div className="space-y-3">
        {Array(3).fill(0).map((_, i) => (
          <div key={i} className="border rounded-lg p-3 flex items-center">
            <div className="flex-1 flex items-center space-x-3">
              <Skeleton className="h-4 w-4 rounded-full" />
              <div className="space-y-1 flex-1">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
            <div className="flex space-x-1">
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Añadir nuevo componente de esqueleto para toda la página
function AgentPageSkeleton() {
  return (
    <div className="flex-1 p-0">
      <div className="sticky top-[64px] min-h-[71px] flex items-center p-0 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border/40 z-10">
        <div className="sticky left-[256px] w-[calc(100vw-256px)] transition-all duration-200 ease-in-out">
          <div className="px-16 pt-0">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-8">
                <div className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
                  {['Basic Information', 'Tools', 'Triggers', 'Integrations', 'Context Files'].map((tab, index) => (
                    <div 
                      key={index} 
                      className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ${
                        index === 0 
                          ? 'bg-background text-foreground shadow-sm' 
                          : 'text-muted-foreground'
                      }`}
                    >
                      {tab}
                    </div>
                  ))}
                </div>
              </div>
              <div className="ml-auto">
                <div className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground h-10 px-4 py-2">
                  Save changes
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="px-16 py-8 pb-16 max-w-[880px] mx-auto">
        <div className="space-y-8">
          {/* Basic information card */}
          <div className="rounded-lg border shadow-sm">
            <div className="p-6">
              <div className="space-y-2 mb-4">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b pb-4 mb-4">
                  <div className="space-y-1">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-64" />
                  </div>
                  <Skeleton className="h-6 w-12 rounded-full" />
                </div>
                
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-10 w-full" />
                </div>
                
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-24 w-full" />
                </div>
              </div>
            </div>
          </div>
          
          {/* Agent prompt card */}
          <div className="rounded-lg border shadow-sm">
            <div className="p-6">
              <div className="space-y-2 mb-4">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-4 w-80" />
              </div>
              
              <Skeleton className="h-40 w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AgentManagePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const agentId = params.id
  const { currentSite } = useSite()
  const supabase = createClient()
  
  // Check if this is a new agent
  const isNewAgent = agentId === "new"
  
  // States for data and loading
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [dataSource, setDataSource] = useState<"database" | "new" | "not-found">("new")
  
  // Default agent names and descriptions based on organizational roles
  const defaultAgentTemplates = [
    { 
      role: "growth_lead",
      name: "Growth Lead/Manager", 
      description: "Strategy integration, team coordination, budget management, KPI tracking",
      type: "marketing",
      promptTemplate: "You are a Growth Lead/Manager assistant. Your goal is to help with strategy integration, team coordination, budget management, and KPI tracking.",
      backstory: "As a former Growth Lead at several successful startups, I've managed marketing teams that achieved 3x user growth in under a year. I specialize in connecting marketing strategies with business goals and excel at coordinating cross-functional teams to execute growth initiatives efficiently."
    },
    { 
      role: "data_analyst",
      name: "Data Analyst", 
      description: "Data analysis, lead qualification, segmentation, performance metrics, optimization",
      type: "marketing",
      promptTemplate: "You are a Data Analyst assistant. Your goal is to help with data analysis, lead qualification, segmentation, performance metrics, and optimization.",
      backstory: "With 8+ years of experience in marketing analytics, I've helped companies transform raw data into actionable insights. I specialize in customer segmentation, attribution modeling, and performance tracking that drives measurable business results. I've implemented data-driven strategies that increased conversion rates by up to 40%."
    },
    { 
      role: "growth_marketer",
      name: "Growth Marketer", 
      description: "Marketing strategy, omnichannel campaigns, A/B testing, SEO techniques",
      type: "marketing",
      promptTemplate: "You are a Growth Marketer assistant. Your goal is to help with marketing strategy, omnichannel campaigns, A/B testing, and SEO techniques.",
      backstory: "I've worked with over 50 SaaS companies to develop and execute growth strategies across multiple channels. My expertise includes SEO optimization that's driven 200%+ organic traffic growth, designing conversion-focused marketing funnels, and implementing rigorous A/B testing frameworks that continuously improve campaign performance."
    },
    { 
      role: "ux_designer",
      name: "UX Designer", 
      description: "Conversion optimization, UX/UI design for funnel, onboarding experience",
      type: "marketing",
      promptTemplate: "You are a UX Designer assistant. Your goal is to help with conversion optimization, UX/UI design for funnel, and onboarding experience.",
      backstory: "I've led UX design teams at both startups and enterprise companies, creating intuitive user experiences that drive engagement and retention. I specialize in user research, journey mapping, and conversion-focused design that transforms complex processes into simple, delightful interactions. My redesigns have improved conversion rates by an average of 35%."
    },
    { 
      role: "sales",
      name: "Sales/CRM Specialist", 
      description: "Lead management, demos, systematic follow-up, sales cycle",
      type: "sales",
      promptTemplate: "You are a Sales/CRM Specialist assistant. Your goal is to help with lead management, demos, systematic follow-up, and sales cycle optimization.",
      backstory: "With over a decade in SaaS sales, I've built and optimized sales processes from scratch that generated millions in ARR. I excel at implementing CRM systems that improve lead management efficiency by 50%+ and designing sales playbooks that shorten sales cycles while increasing close rates. I've trained dozens of sales reps who consistently exceed their targets."
    },
    { 
      role: "support",
      name: "Customer Support", 
      description: "Knowledge base management, FAQ development, customer issue escalation",
      type: "support",
      promptTemplate: "You are a Customer Support assistant. Your goal is to help with knowledge base management, FAQ development, and customer issue escalation.",
      backstory: "I've built support teams from the ground up at several high-growth companies, achieving 98%+ customer satisfaction ratings. I specialize in creating comprehensive knowledge bases that reduce ticket volume by 40% and implementing efficient ticket management systems. I'm particularly skilled at turning customer feedback into actionable product improvements."
    },
    { 
      role: "content_creator",
      name: "Content Creator & Copywriter", 
      description: "Persuasive copywriting, site content, blog posts, email sequences",
      type: "marketing",
      promptTemplate: "You are a Content Creator & Copywriter assistant. Your goal is to help with persuasive copywriting, site content, blog posts, and email sequences.",
      backstory: "I've written for brands across multiple industries, creating content strategies that drive engagement and conversions. My email campaigns typically achieve 30%+ open rates and 5%+ CTR. I specialize in creating SEO-optimized blog content that ranks in the top 3 positions and crafting compelling website copy that tells a brand's story while driving action."
    }
  ]
  
  // Find default template to use
  const getDefaultTemplate = () => {
    // First, check if agentId corresponds directly to a template role
    if (!isNewAgent) {
      const templateByRole = defaultAgentTemplates.find(t => t.role === agentId);
      if (templateByRole) {
        console.log("Found template by direct role match:", agentId);
        return templateByRole;
      }
    }
    
    // Then check if we have a role parameter in the URL
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const roleParam = urlParams.get('role');
      
      if (roleParam) {
        const template = defaultAgentTemplates.find(t => t.role === roleParam);
        if (template) return template;
      }
    }
    
    // Default to Customer Support if no parameter is found
    const supportTemplate = defaultAgentTemplates.find(t => t.role === "support");
    if (supportTemplate) return supportTemplate;
    
    // Fallback if support template somehow not found
    return defaultAgentTemplates[5]; // Customer Support
  }
  
  // Use the default template
  const defaultTemplate = getDefaultTemplate()
  
  // Initialize state variables with default values for new agents
  const [name, setName] = useState(defaultTemplate.name)
  const [description, setDescription] = useState(defaultTemplate.description)
  const [status, setStatus] = useState<"active" | "inactive">("inactive")
  const [prompt, setPrompt] = useState(defaultTemplate.promptTemplate)
  const [type, setType] = useState<"sales" | "support" | "marketing">(defaultTemplate.type as "sales" | "support" | "marketing")
  const [backstory, setBackstory] = useState(defaultTemplate.backstory || "")
  
  const [tools, setTools] = useState(getDefaultToolsForRole(defaultTemplate.role))
  const [integrations, setIntegrations] = useState(getDefaultIntegrationsForRole())
  const [contextFiles, setContextFiles] = useState<{id: string, name: string, path: string}[]>([])
  const [triggers, setTriggers] = useState(getDefaultTriggersForRole())
  
  const [activeTab, setActiveTab] = useState("basic")
  const [isSaving, setIsSaving] = useState(false)
  
  // Search states
  const [toolSearch, setToolSearch] = useState("")
  const [triggerSearch, setTriggerSearch] = useState("")
  const [integrationSearch, setIntegrationSearch] = useState("")
  const [contextSearch, setContextSearch] = useState("")
  
  // Estado para el loading de archivos de contexto
  const [isContextFilesLoading, setIsContextFilesLoading] = useState(false)
  
  // Load agent data and related assets
  useEffect(() => {
    // For new agents, just use the default values already set and don't load from DB
    if (isNewAgent) {
      console.log("Creating new agent with defaults:", {
        name,
        description,
        prompt,
        type
      })
      
      // The type is already set based on the template, so we don't need to update it again
      setIsLoading(false);
      return;
    }
    
    // For existing agents, load from database
    async function loadAgentData() {
      try {
        setIsLoading(true)
        setLoadError(null)
        
        // Check if agentId is a valid UUID
        const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(agentId)
        
        // For valid UUIDs, always fetch from the database
        if (isValidUUID) {
          console.log("Fetching agent with valid UUID:", agentId)
          const { data: agentData, error } = await supabase
            .from('agents')
            .select('*')
            .eq('id', agentId)
            .single()
          
          if (error) {
            console.error("Error fetching agent:", error)
            setLoadError(error.message)
            setDataSource("not-found")
            setIsLoading(false)
            return
          }
          
          if (!agentData) {
            setLoadError("Agent not found")
            setDataSource("not-found")
            setIsLoading(false)
            return
          }
          
          console.log("Agent data loaded from DB:", agentData)
          setDataSource("database")
          
          // Update state with real data
          setName(agentData.name)
          setDescription(agentData.description || "")
          setStatus(agentData.status as "active" | "inactive")
          setType(agentData.type)
          setPrompt(agentData.prompt)
          setBackstory(agentData.backstory || "")
          
          // Parse and set tools - if none found, use empty defaults
          const defaultEmptyTools = getDefaultToolsForRole()
          if (agentData.tools && typeof agentData.tools === 'object') {
            try {
              const toolsArr = Object.entries(agentData.tools).map(([id, data]: [string, any]) => ({
                id,
                name: data.name || id,
                description: data.description || "",
                enabled: !!data.enabled
              }))
              
              if (toolsArr.length > 0) {
                console.log("Setting tools from database:", toolsArr)
                setTools(toolsArr)
              } else {
                console.log("No tools found in database, using defaults")
                setTools(defaultEmptyTools)
              }
            } catch (err) {
              console.error("Error parsing tools:", err)
              setTools(defaultEmptyTools)
            }
          } else {
            console.log("No tools object found, using defaults")
            setTools(defaultEmptyTools)
          }
          
          // Parse and set integrations
          const defaultEmptyIntegrations = getDefaultIntegrationsForRole()
          if (agentData.integrations && typeof agentData.integrations === 'object') {
            try {
              const integrationsArr = Object.entries(agentData.integrations).map(([id, data]: [string, any]) => ({
                id,
                name: data.name || id,
                description: data.description || "",
                connected: !!data.connected
              }))
              
              if (integrationsArr.length > 0) {
                console.log("Setting integrations from database:", integrationsArr)
                setIntegrations(integrationsArr)
              } else {
                console.log("No integrations found in database, using defaults")
                setIntegrations(defaultEmptyIntegrations)
              }
            } catch (err) {
              console.error("Error parsing integrations:", err)
              setIntegrations(defaultEmptyIntegrations)
            }
          } else {
            console.log("No integrations object found, using defaults")
            setIntegrations(defaultEmptyIntegrations)
          }
          
          // Load related assets from agent_assets table
          console.log("Loading agent assets for agent:", agentId)
          const { data: agentAssets, error: assetsError } = await supabase
            .from('agent_assets')
            .select(`
              asset_id,
              assets:asset_id (
                id, 
                name, 
                file_path
              )
            `)
            .eq('agent_id', agentId)
          
          if (assetsError) {
            console.error("Error loading agent assets:", assetsError)
          } else if (agentAssets && agentAssets.length > 0) {
            // Transform data into the format expected by the component
            const files = agentAssets.map((item: { assets: { id: string, name: string, file_path: string } }) => ({
              id: item.assets.id,
              name: item.assets.name,
              path: item.assets.file_path
            }))
            console.log("Setting context files from agent_assets:", files)
            setContextFiles(files)
          } else {
            // Fallback to legacy configuration.contextFiles if available
            if (agentData.configuration && 
                agentData.configuration.contextFiles && 
                Array.isArray(agentData.configuration.contextFiles)) {
              console.log("Setting context files from legacy format:", agentData.configuration.contextFiles)
              setContextFiles(agentData.configuration.contextFiles)
            } else {
              console.log("No context files found, using empty array")
              setContextFiles([])
            }
          }
          
          // Parse and set triggers
          const defaultEmptyTriggers = getDefaultTriggersForRole()
          if (agentData.configuration && 
              agentData.configuration.triggers && 
              typeof agentData.configuration.triggers === 'object') {
            try {
              const triggersArr = Object.entries(agentData.configuration.triggers).map(([id, data]: [string, any]) => ({
                id,
                name: data.name || id,
                description: data.description || "",
                enabled: !!data.enabled
              }))
              
              if (triggersArr.length > 0) {
                console.log("Setting triggers from database:", triggersArr)
                setTriggers(triggersArr)
              } else {
                console.log("No triggers found in database, using defaults")
                setTriggers(defaultEmptyTriggers)
              }
            } catch (err) {
              console.error("Error parsing triggers:", err)
              setTriggers(defaultEmptyTriggers)
            }
          } else {
            console.log("No triggers configuration found, using defaults")
            setTriggers(defaultEmptyTriggers)
          }
        } else {
          // Non-UUID ID - treat as new agent with defaults
          console.log("Invalid UUID format, treating as new agent with template ID:", agentId)
          setLoadError(null)
          setDataSource("new")
          
          // Try to load template details based on role
          // Role is in format of growth_lead, support, etc.
          const template = defaultAgentTemplates.find(t => t.role === agentId);
          if (template) {
            console.log("Found matching template:", template);
            setName(template.name);
            setDescription(template.description);
            setPrompt(template.promptTemplate);
            setType(template.type as "sales" | "support" | "marketing");
            
            // Set tools based on the specific role
            setTools(getDefaultToolsForRole(agentId));
          } else {
            // If no template found, use defaults
            console.log("No template found for ID:", agentId, "using defaults");
            setTools(getDefaultToolsForRole());
          }
          
          // Set other default empty values
          setIntegrations(getDefaultIntegrationsForRole())
          setContextFiles([])
          setTriggers(getDefaultTriggersForRole())
        }
      } catch (err) {
        console.error("Error loading agent data:", err)
        setLoadError(err instanceof Error ? err.message : "Unknown error loading agent")
        setDataSource("not-found")
      } finally {
        setIsLoading(false)
      }
    }
    
    loadAgentData()
  }, [agentId, isNewAgent, supabase])
  
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
  const handleFileRemove = async (fileId: string) => {
    // Mostrar el esqueleto mientras se actualiza la UI
    setIsContextFilesLoading(true)
    
    // If this is a new agent, just remove from the local state
    if (isNewAgent) {
      setContextFiles(contextFiles.filter(file => file.id !== fileId))
      setIsContextFilesLoading(false)
      return
    }
    
    try {
      // First remove the relationship from agent_assets
      const { error } = await supabase
        .from('agent_assets')
        .delete()
        .match({ 
          agent_id: agentId,
          asset_id: fileId
        })
      
      if (error) {
        console.error("Error removing file association:", error)
        setIsContextFilesLoading(false)
        return
      }
      
      // Then update the UI
      setContextFiles(contextFiles.filter(file => file.id !== fileId))
    } catch (err) {
      console.error("Error removing file:", err)
    } finally {
      // Ocultar el esqueleto después de un pequeño retraso
      setTimeout(() => {
        setIsContextFilesLoading(false)
      }, 800)
    }
  }
  
  // Handle file upload completed
  const handleFileUploaded = (fileData: { id: string; name: string; path: string }) => {
    // Mostrar el esqueleto mientras se actualiza la UI
    setIsContextFilesLoading(true)
    
    // Agregar el nuevo archivo a la lista
    setContextFiles([...contextFiles, fileData])
    
    // Ocultar el esqueleto después de un pequeño retraso para mostrar la transición
    setTimeout(() => {
      setIsContextFilesLoading(false)
    }, 800)
  }
  
  // Handle trigger toggle
  const handleTriggerToggle = (triggerId: string, enabled: boolean) => {
    setTriggers(triggers.map(trigger => 
      trigger.id === triggerId ? { ...trigger, enabled } : trigger
    ))
  }
  
  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value)
  }
  
  // Update breadcrumb
  useEffect(() => {
    document.title = isNewAgent ? "New Agent | Agents" : `${name || "Agent"} | Agents`;
    
    const event = new CustomEvent('breadcrumb:update', {
      detail: {
        title: isNewAgent ? "New Agent" : name
      }
    });
    
    window.dispatchEvent(event);
    
    return () => {
      document.title = 'Agents | Market Fit';
    };
  }, [isNewAgent, name]);
  
  // Handle save
  const handleSave = async () => {
    if (!currentSite) {
      console.error("Missing site information")
      return
    }
    
    setIsSaving(true)
    
    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.user) {
        console.error("User not authenticated")
        return
      }
      
      // Prepare data for database
      
      // Convert tools array to configuration format
      const toolsConfig = tools.reduce((config, tool) => {
        config[tool.id] = { 
          enabled: tool.enabled,
          name: tool.name,
          description: tool.description
        }
        return config
      }, {} as Record<string, any>)
      
      // Convert integrations array to configuration format
      const integrationsConfig = integrations.reduce((config, integration) => {
        config[integration.id] = { 
          connected: integration.connected,
          name: integration.name,
          description: integration.description
        }
        return config
      }, {} as Record<string, any>)
      
      // Convert triggers array to configuration format
      const triggersConfig = triggers.reduce((config, trigger) => {
        config[trigger.id] = { 
          enabled: trigger.enabled,
          name: trigger.name,
          description: trigger.description
        }
        return config
      }, {} as Record<string, any>)
      
      // Legacy configuration format for context files
      // Note: We're now using agent_assets table but keep this for backward compatibility
      const filesConfig = contextFiles.map(file => ({
        id: file.id,
        name: file.name,
        path: file.path
      }))
      
      // Check if agentId is a valid UUID
      const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(agentId);
      const isExistingAgent = isValidUUID && !isNewAgent;
      
      let agentRole: string;
      
      // Para agentes existentes, necesitamos obtener su rol actual
      if (isExistingAgent) {
        console.log("Getting existing role for agent:", agentId);
        const { data: existingAgentData } = await supabase
          .from('agents')
          .select('role')
          .eq('id', agentId)
          .single();
        
        // Mantener el rol existente ya que es un dato no editable
        agentRole = existingAgentData?.role || "";
        console.log("Using existing role:", agentRole);
      } else {
        // Para agentes nuevos, usar el rol de la plantilla, no el nombre
        // Buscar si el agentId coincide con algún rol de plantilla
        const templateMatch = defaultAgentTemplates.find(t => t.role === agentId);
        
        if (templateMatch) {
          // Si hay coincidencia directa con un ID de plantilla, usar ese rol
          agentRole = templateMatch.role;
        } else {
          // Si no, verificar si se especificó un rol en los parámetros de URL
          const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
          const roleParam = urlParams ? urlParams.get('role') : null;
          
          if (roleParam && defaultAgentTemplates.some(t => t.role === roleParam)) {
            // Si hay un parámetro de rol válido, usarlo
            agentRole = roleParam;
          } else {
            // De lo contrario, usar el rol del template por defecto
            agentRole = defaultTemplate.role;
          }
        }
        console.log("Setting new agent role from template:", agentRole);
      }
      
      // Prepare agent data for database
      const agentData = {
        name,
        description,
        type,
        status,
        prompt,
        backstory,
        role: name, // Usar el nombre en lugar del rol para evitar problemas con snake_case
        conversations: 0,
        success_rate: 0,
        tools: toolsConfig,
        activities: {},
        integrations: integrationsConfig,
        configuration: {
          contextFiles: filesConfig,
          triggers: triggersConfig
        },
        site_id: currentSite.id,
        user_id: session.user.id,
        updated_at: new Date().toISOString(),
        last_active: new Date().toISOString()
      }
      
      let result;
      let savedAgentId: string;
      
      // For agents with valid UUID, use upsert with onConflict='id'
      if (isExistingAgent) {
        console.log("Updating existing agent with ID:", agentId);
        result = await supabase
          .from('agents')
          .upsert(
            { 
              ...agentData,
              id: agentId
            }, 
            { 
              onConflict: 'id',
              ignoreDuplicates: false
            }
          )
          .select()
          .single();
        
        savedAgentId = agentId;
      } else {
        // For new agents, check if there's already an agent with the same role, user_id, and site_id
        console.log("Checking for existing agent with same name, user_id, and site_id");
        const { data: existingAgent } = await supabase
          .from('agents')
          .select('id')
          .eq('role', name)
          .eq('user_id', session.user.id)
          .eq('site_id', currentSite.id)
          .maybeSingle();
        
        if (existingAgent?.id) {
          // If agent already exists, update it
          console.log("Found existing agent with ID:", existingAgent.id);
          result = await supabase
            .from('agents')
            .update(agentData)
            .eq('id', existingAgent.id)
            .select()
            .single();
          
          savedAgentId = existingAgent.id;
        } else {
          // If no agent exists, create a new one
          console.log("Creating new agent");
          result = await supabase
            .from('agents')
            .insert(agentData)
            .select()
            .single();
          
          savedAgentId = result.data?.id;
        }
      }
      
      const { data, error } = result;
      
      if (error) {
        console.error("Error saving agent:", error);
        throw error;
      }
      
      console.log("Agent saved successfully:", data);
      
      // Redirect back to agents list
      router.push("/agents");
    } catch (error) {
      console.error("Error saving agent:", error);
    } finally {
      setIsSaving(false);
    }
  }
  
  // If there was an error loading the agent
  if (loadError && dataSource === "not-found") {
    return (
      <div className="flex-1 p-8 flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">Error loading agent</h1>
        <p className="text-muted-foreground mb-6">{loadError}</p>
        <Button onClick={() => router.push("/agents")}>
          Back to Agents
        </Button>
      </div>
    )
  }
  
  // Show loading state
  if (isLoading) {
    return <AgentPageSkeleton />;
  }
  
  return (
    <div className="flex-1 p-0">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="h-full">
        <StickyHeader>
          <div className="px-16 pt-0">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-8">
                <TabsList>
                  <TabsTrigger value="basic">Basic Information</TabsTrigger>
                  <TabsTrigger value="tools">Tools</TabsTrigger>
                  <TabsTrigger value="triggers">Triggers</TabsTrigger>
                  <TabsTrigger value="integrations">Integrations</TabsTrigger>
                  <TabsTrigger value="context">Context Files</TabsTrigger>
                </TabsList>
                {activeTab === "tools" && (
                  <SearchInput
                    placeholder="Search tools..."
                    value={toolSearch}
                    onSearch={setToolSearch}
                  />
                )}
                {activeTab === "triggers" && (
                  <SearchInput
                    placeholder="Search triggers..."
                    value={triggerSearch}
                    onSearch={setTriggerSearch}
                  />
                )}
                {activeTab === "integrations" && (
                  <SearchInput
                    placeholder="Search integrations..."
                    value={integrationSearch}
                    onSearch={setIntegrationSearch}
                  />
                )}
                {activeTab === "context" && (
                  <SearchInput
                    placeholder="Search context files..."
                    value={contextSearch}
                    onSearch={setContextSearch}
                  />
                )}
              </div>
              <div className="ml-auto">
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
            </div>
          </div>
        </StickyHeader>
        <div className="px-16 py-8 pb-16 max-w-[880px] mx-auto">
          <TabsContent value="basic" className="space-y-4">
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>
                  Configure the basic details of your agent
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between border-b pb-4 mb-4">
                  <div>
                    <h3 className="font-medium text-base">Agent Status</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {status === "active" ? "Your agent is active and responding to queries" : "Your agent is inactive and will not respond to queries"}
                    </p>
                  </div>
                  <Switch 
                    checked={status === "active"} 
                    onCheckedChange={(checked) => setStatus(checked ? "active" : "inactive")}
                    aria-label="Toggle agent status"
                  />
                </div>
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
            
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Agent Backstory</CardTitle>
                <CardDescription>
                  Create a compelling backstory to give your agent more personality and context
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea 
                  value={backstory} 
                  onChange={(e) => setBackstory(e.target.value)} 
                  placeholder="Enter a backstory for this agent (e.g., professional background, experience, expertise)"
                  rows={6}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tools" className="space-y-4">
            {/* Favorites Section */}
            <Card>
              <CardHeader>
                <CardTitle>Favorites</CardTitle>
                <CardDescription>
                  Your most used tools
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {tools.slice(0, 2).map(tool => (
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

            {/* All Tools Section */}
            <Card>
              <CardHeader>
                <CardTitle>All Tools</CardTitle>
                <CardDescription>
                  Enable or disable tools that your agent can use
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {tools
                    .filter(tool => 
                      tool.name.toLowerCase().includes(toolSearch.toLowerCase()) ||
                      tool.description.toLowerCase().includes(toolSearch.toLowerCase())
                    )
                    .map(tool => (
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
          </TabsContent>

          <TabsContent value="triggers" className="space-y-4">
            {/* Favorites Section */}
            <Card>
              <CardHeader>
                <CardTitle>Favorites</CardTitle>
                <CardDescription>
                  Your most used triggers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {triggers.slice(0, 2).map(trigger => (
                    <AgentTrigger 
                      key={trigger.id}
                      id={trigger.id}
                      name={trigger.name}
                      description={trigger.description}
                      enabled={trigger.enabled}
                      onToggle={handleTriggerToggle}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* All Triggers Section */}
            <Card>
              <CardHeader>
                <CardTitle>All Triggers</CardTitle>
                <CardDescription>
                  Configure when and how your agent should be activated
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {triggers
                    .filter(trigger => 
                      trigger.name.toLowerCase().includes(triggerSearch.toLowerCase()) ||
                      trigger.description.toLowerCase().includes(triggerSearch.toLowerCase())
                    )
                    .map(trigger => (
                      <AgentTrigger 
                        key={trigger.id}
                        id={trigger.id}
                        name={trigger.name}
                        description={trigger.description}
                        enabled={trigger.enabled}
                        onToggle={handleTriggerToggle}
                      />
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-4">
            {/* Favorites Section */}
            <Card>
              <CardHeader>
                <CardTitle>Favorites</CardTitle>
                <CardDescription>
                  Your most used integrations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {integrations.slice(0, 2).map(integration => (
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

            {/* All Integrations Section */}
            <Card>
              <CardHeader>
                <CardTitle>All Integrations</CardTitle>
                <CardDescription>
                  Connect your agent to external services
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {integrations
                    .filter(integration => 
                      integration.name.toLowerCase().includes(integrationSearch.toLowerCase()) ||
                      integration.description.toLowerCase().includes(integrationSearch.toLowerCase())
                    )
                    .map(integration => (
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
          </TabsContent>

          <TabsContent value="context" className="space-y-4">
            <Card className="mb-8">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Context Files</CardTitle>
                  <CardDescription>
                    Add files that provide context for your agent
                  </CardDescription>
                </div>
                <UploadFileDialog 
                  agentId={agentId} 
                  onFileUploaded={handleFileUploaded}
                />
              </CardHeader>
              <CardContent>
                {isContextFilesLoading ? (
                  <ContextFilesSkeleton />
                ) : contextFiles.length > 0 ? (
                  <div className="space-y-2">
                    {contextFiles
                      .filter(file => 
                        file.name.toLowerCase().includes(contextSearch.toLowerCase())
                      )
                      .map(file => (
                        <ContextFile 
                          key={file.id}
                          id={file.id}
                          name={file.name}
                          path={file.path}
                          agentId={agentId}
                          onRemove={handleFileRemove}
                          onUpdate={handleFileUploaded}
                        />
                      ))}
                  </div>
                ) : (
                  <EmptyCard 
                    icon={<FileText className="h-10 w-10 text-muted-foreground" />}
                    contentClassName="mb-4"
                    title="No context files added" 
                    description="Add files to provide additional context for your agent" 
                    className="flex flex-col items-center justify-center py-8"
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
} 