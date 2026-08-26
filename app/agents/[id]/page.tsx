"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import React from "react"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Textarea } from "@/app/components/ui/textarea"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardDescription,
  SectionCardContent,
  SectionCardFooter,
} from "@/app/components/ui/section-card"
import { ActionFooter } from "@/app/components/ui/card-footer"
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
  Trash2,
  FolderOpen,
  Link as LinkIcon,
  XCircle as UnlinkIcon
} from "@/app/components/ui/icons"
import { AgentActivity } from "@/app/types/agents"
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
import { getAssets, attachAssetToAgent, detachAssetFromAgent, type Asset } from "@/app/assets/actions"
import { toast } from "sonner"
import {
  AGENT_ROLE_KEY_MAPPING,
  DEFAULT_AGENT_TEMPLATES,
  getDefaultActivitiesForRole,
  getDefaultAgentTemplate,
  getDefaultIntegrationsForRole,
  getDefaultToolsForRole,
  getDefaultTriggersForRole,
  resolveTemplateRole,
} from "@/app/agents/agent-defaults"
import {
  ActivitiesSkeleton,
  AgentPageSkeleton,
  ContextFilesSkeleton,
} from "@/app/agents/agent-detail-skeletons"
import { invalidateAgentsCache } from "@/app/agents/agents-cache"
import { isAgentUuid, upsertAgentRecord } from "@/app/agents/save-agent"

// Compatible file types for agents (same as in upload-file-dialog)
const AGENT_COMPATIBLE_FILE_TYPES = [
  'application/pdf',
  'text/csv',
  'application/vnd.ms-excel',
  'text/markdown',
  'text/plain',
  'application/json',
  'text/yaml',
  'application/x-yaml',
  'image/jpeg',
  'image/png',
  'image/webp'
]

const AGENT_COMPATIBLE_EXTENSIONS = [
  '.pdf', '.csv', '.md', '.txt', '.json', '.yaml', '.yml', '.jpg', '.jpeg', '.png', '.webp'
]

// Helper function to check if an asset is compatible with agents
const isAssetCompatibleWithAgent = (asset: Asset): boolean => {
  // Check by file type first
  if (AGENT_COMPATIBLE_FILE_TYPES.includes(asset.file_type)) {
    return true
  }
  
  // Then check by extension as fallback
  const extension = `.${asset.name.split('.').pop()?.toLowerCase()}`
  return AGENT_COMPATIBLE_EXTENSIONS.includes(extension)
}

// Asset interface with attachment status
interface AssetWithAttachment {
  id: string
  name: string
  description: string | null
  file_path: string
  file_type: string
  file_size: number | null
  metadata: Record<string, any> | null
  is_public: boolean
  site_id: string
  user_id: string
  created_at: string
  updated_at: string
  isAttachedToAgent?: boolean
  tags: string[]
}

// Activity Item Component
interface ActivityItemProps {
  id: string
  name: string
  description: string
  status: AgentActivity["status"]
  onToggle: (id: string, enabled: boolean) => void
}

const ActivityItem = ({ id, name, description, status, onToggle }: ActivityItemProps) => {
  // Convert status to enabled state (available = true, others = false)
  const enabled = status === "available";
  
  return (
    <div className="border rounded-lg p-3 flex items-center">
      <div className="flex-1 flex items-center space-x-3">
        <Check className={cn("h-4 w-4", enabled ? "text-primary" : "text-muted-foreground/30")} />
        <div>
          <h4 className="font-medium text-sm">{name}</h4>
          <p className="text-muted-foreground text-xs">{description}</p>
        </div>
      </div>
      <div>
        <Switch 
          checked={enabled} 
          onCheckedChange={(checked) => onToggle(id, checked)}
          aria-label={`Toggle ${name}`}
        />
      </div>
    </div>
  )
}


// Content component that will use React.use()
function AgentDetailPageContent() {
  const params = useParams() as { id: string }
  const agentId = params.id
  const router = useRouter()
  const { currentSite } = useSite()
  const supabase = createClient()
  
  // Check if this is a new agent
  const isNewAgent = agentId === "new"
  
  // States for data and loading
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [dataSource, setDataSource] = useState<"database" | "new" | "not-found">("new")
  
  const roleParam = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("role") : null
  const defaultTemplate = getDefaultAgentTemplate(agentId, isNewAgent, roleParam)
  
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
  const [activities, setActivities] = useState<AgentActivity[]>(getDefaultActivitiesForRole(defaultTemplate.role))
  
  const [activeTab, setActiveTab] = useState("basic")
  const [isSaving, setIsSaving] = useState(false)
  
  // Search states
  const [toolSearch, setToolSearch] = useState("")
  const [triggerSearch, setTriggerSearch] = useState("")
  const [integrationSearch, setIntegrationSearch] = useState("")
  const [contextSearch, setContextSearch] = useState("")
  const [activitySearch, setActivitySearch] = useState("")
  
  // Estado para el loading de archivos de contexto
  const [isContextFilesLoading, setIsContextFilesLoading] = useState(false)
  
  // Estado para el loading de actividades
  const [isActivitiesLoading, setIsActivitiesLoading] = useState(false)
  
  // Assets state
  const [availableAssets, setAvailableAssets] = useState<AssetWithAttachment[]>([])
  const [isAssetsLoading, setIsAssetsLoading] = useState(false)
  const [attachedAssetIds, setAttachedAssetIds] = useState<string[]>([])
  
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
        
        if (isAgentUuid(agentId)) {
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
                connected: !!data.connected,
                isOpenClaw: !!data.isOpenClaw
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
          
          // Parse and set activities
          const defaultEmptyActivities = getDefaultActivitiesForRole(agentId)
          if (agentData.activities && typeof agentData.activities === 'object') {
            try {
              const activitiesArr = Object.entries(agentData.activities).map(([id, data]: [string, any]) => ({
                id,
                name: data.name || id,
                description: data.description || "",
                status: (data.status === "available" || data.status === "in_progress" || data.status === "deprecated") 
                  ? (data.status as AgentActivity["status"])
                  : (data.enabled ? "available" : "deprecated") as AgentActivity["status"]
              }))
              
              if (activitiesArr.length > 0) {
                console.log("Setting activities from database:", activitiesArr)
                setActivities(activitiesArr)
              } else {
                console.log("No activities found in database, using defaults")
                setActivities(defaultEmptyActivities)
              }
            } catch (err) {
              console.error("Error parsing activities:", err)
              setActivities(defaultEmptyActivities)
            }
          } else {
            console.log("No activities object found, using defaults")
            setActivities(defaultEmptyActivities)
          }
        } else {
          // Non-UUID ID - treat as new agent with defaults
          console.log("Invalid UUID format, treating as new agent with template ID:", agentId)
          setLoadError(null)
          setDataSource("new")
          
          // Try to load template details based on role
          // Role is in format of growth_lead, support, etc. or new human-readable format
          let template = DEFAULT_AGENT_TEMPLATES.find(t => t.role === agentId);
          let roleForDefaults = agentId;
          
          if (!template) {
            const mappedRole = AGENT_ROLE_KEY_MAPPING[agentId];
            if (mappedRole) {
              template = DEFAULT_AGENT_TEMPLATES.find(t => t.role === mappedRole);
              roleForDefaults = mappedRole;
            }
          }
          
          if (template) {
            console.log("Found matching template:", template);
            setName(template.name);
            setDescription(template.description);
            setPrompt(template.promptTemplate);
            setType(template.type as "sales" | "support" | "marketing");
            
            // Set tools based on the specific role
            setTools(getDefaultToolsForRole(roleForDefaults));
            
            // Set activities based on the specific role
            setActivities(getDefaultActivitiesForRole(roleForDefaults));
          } else {
            // If no template found, use defaults
            console.log("No template found for ID:", agentId, "using defaults");
            setTools(getDefaultToolsForRole());
            setActivities(getDefaultActivitiesForRole());
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
  
  // Load compatible assets from the current site
  useEffect(() => {
    async function loadCompatibleAssets() {
      if (!currentSite?.id) return
      
      setIsAssetsLoading(true)
      try {
        const { assets: fetchedAssets, error } = await getAssets(currentSite.id)
        
        if (error) {
          console.error("Error loading assets:", error)
          return
        }
        
        // Filter only compatible assets and add metadata
        const compatibleAssets = fetchedAssets?.filter(isAssetCompatibleWithAgent).map((asset: Asset) => {
          const metadata = asset.metadata as { tags?: string[] } || {}
          return {
            ...asset,
            tags: metadata.tags || [],
            isAttachedToAgent: attachedAssetIds.includes(asset.id)
          }
        }) || []
        
        setAvailableAssets(compatibleAssets)
      } catch (err) {
        console.error("Error loading compatible assets:", err)
      } finally {
        setIsAssetsLoading(false)
      }
    }
    
    loadCompatibleAssets()
  }, [currentSite?.id, attachedAssetIds])
  
  // Update attached asset IDs when context files change
  useEffect(() => {
    const attachedIds = contextFiles.map(file => file.id)
    setAttachedAssetIds(attachedIds)
  }, [contextFiles])
  
  // Handle asset attach
  const handleAssetAttach = async (assetId: string) => {
    if (isNewAgent) {
      // For new agents, we can't attach assets until they're saved
      toast.error("Please save the agent first before attaching assets")
      return
    }
    
    setIsAssetsLoading(true)
    try {
      const { error } = await attachAssetToAgent(agentId, assetId)
      
      if (error) {
        console.error("Error attaching asset:", error)
        toast.error("Failed to attach asset")
        return
      }
      
      // Find the asset and add it to context files
      const asset = availableAssets.find(a => a.id === assetId)
      if (asset) {
        const newContextFile = {
          id: asset.id,
          name: asset.name,
          path: asset.file_path
        }
        setContextFiles(prev => [...prev, newContextFile])
        toast.success("Asset attached successfully")
      }
    } catch (err) {
      console.error("Error attaching asset:", err)
      toast.error("Failed to attach asset")
    } finally {
      setIsAssetsLoading(false)
    }
  }
  
  // Handle asset detach
  const handleAssetDetach = async (assetId: string) => {
    if (isNewAgent) return
    
    setIsAssetsLoading(true)
    try {
      const { error } = await detachAssetFromAgent(agentId, assetId)
      
      if (error) {
        console.error("Error detaching asset:", error)
        toast.error("Failed to detach asset")
        return
      }
      
      // Remove from context files
      setContextFiles(prev => prev.filter(file => file.id !== assetId))
      toast.success("Asset detached successfully")
    } catch (err) {
      console.error("Error detaching asset:", err)
      toast.error("Failed to detach asset")
    } finally {
      setIsAssetsLoading(false)
    }
  }
  
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
  
  // Handle activity toggle
  const handleActivityToggle = (activityId: string, enabled: boolean) => {
    setActivities(activities.map(activity => 
      activity.id === activityId ? { 
        ...activity, 
        status: enabled ? "available" : "deprecated" as AgentActivity["status"]
      } : activity
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
  
  const persistAgent = async () => {
    if (!currentSite) {
      throw new Error("Missing site information")
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      throw new Error("User not authenticated")
    }

    const currentRoleParam = typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("role")
      : null

    const toolsConfig = tools.reduce((config, tool) => {
      config[tool.id] = {
        enabled: tool.enabled,
        name: tool.name,
        description: tool.description,
      }
      return config
    }, {} as Record<string, unknown>)

    const integrationsConfig = integrations.reduce((config, integration) => {
      config[integration.id] = {
        connected: integration.connected,
        name: integration.name,
        description: integration.description,
      }
      return config
    }, {} as Record<string, unknown>)

    const triggersConfig = triggers.reduce((config, trigger) => {
      config[trigger.id] = {
        enabled: trigger.enabled,
        name: trigger.name,
        description: trigger.description,
      }
      return config
    }, {} as Record<string, unknown>)

    const activitiesConfig = activities.reduce((config, activity) => {
      config[activity.id] = {
        name: activity.name,
        description: activity.description,
        status: activity.status,
        enabled: activity.status === "available",
      }
      return config
    }, {} as Record<string, unknown>)

    const savedId = await upsertAgentRecord(supabase, {
      agentId,
      isNewAgent,
      siteId: currentSite.id,
      userId: session.user.id,
      name,
      description,
      type,
      status,
      prompt,
      backstory,
      role: resolveTemplateRole(agentId, isNewAgent, currentRoleParam),
      tools: toolsConfig,
      activities: activitiesConfig,
      integrations: integrationsConfig,
      configuration: {
        contextFiles: contextFiles.map((file) => ({
          id: file.id,
          name: file.name,
          path: file.path,
        })),
        triggers: triggersConfig,
      },
    })

    invalidateAgentsCache()
    if (savedId !== agentId) {
      router.replace(`/agents/${savedId}`)
    }

    return savedId
  }

  const handleSaveSection = async (successMessage: string, errorMessage: string) => {
    setIsSaving(true)
    try {
      await persistAgent()
      toast.success(successMessage)
    } catch (error) {
      console.error(errorMessage, error)
      const detail =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: unknown }).message)
          : null
      toast.error(detail ? `${errorMessage}: ${detail}` : errorMessage)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveBasicInfo = () =>
    handleSaveSection("Basic information saved successfully", "Failed to save basic information")

  const handleSavePrompt = () =>
    handleSaveSection("Agent prompt saved successfully", "Failed to save agent prompt")

  const handleSaveBackstory = () =>
    handleSaveSection("Agent backstory saved successfully", "Failed to save agent backstory")

  const handleSaveActivities = () =>
    handleSaveSection("Activities saved successfully", "Failed to save activities")

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
          <div className="px-4 md:px-16 pt-0">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-8">
                <TabsList>
                  <TabsTrigger value="basic">Basic Information</TabsTrigger>
                  <TabsTrigger value="tools" className="hidden" data-hide-in-safari>Tools</TabsTrigger>
                  <TabsTrigger value="triggers" className="hidden" data-hide-in-safari>Triggers</TabsTrigger>
                  <TabsTrigger value="integrations" className="hidden" data-hide-in-safari>Integrations</TabsTrigger>
                  <TabsTrigger value="context">Context Files</TabsTrigger>
                  <TabsTrigger value="activities">Activities</TabsTrigger>
                </TabsList>
                {activeTab === "tools" && (
                  <SearchInput
                    placeholder="Search tools..."
                    value={toolSearch}
                    onSearch={setToolSearch}
                    onChange={(e) => setToolSearch(e.target.value)}
                  />
                )}
                {activeTab === "triggers" && (
                  <SearchInput
                    placeholder="Search triggers..."
                    value={triggerSearch}
                    onSearch={setTriggerSearch}
                    onChange={(e) => setTriggerSearch(e.target.value)}
                  />
                )}
                {activeTab === "integrations" && (
                  <SearchInput
                    placeholder="Search integrations..."
                    value={integrationSearch}
                    onSearch={setIntegrationSearch}
                    onChange={(e) => setIntegrationSearch(e.target.value)}
                  />
                )}
                {activeTab === "context" && (
                  <SearchInput
                    placeholder="Search context files..."
                    value={contextSearch}
                    onSearch={setContextSearch}
                    onChange={(e) => setContextSearch(e.target.value)}
                  />
                )}
                {activeTab === "activities" && (
                  <SearchInput
                    placeholder="Search activities..."
                    value={activitySearch}
                    onSearch={setActivitySearch}
                    onChange={(e) => setActivitySearch(e.target.value)}
                  />
                )}
              </div>
            </div>
          </div>
        </StickyHeader>
        <div className="px-4 md:px-16 py-8 pb-16 max-w-[880px] mx-auto">
          <TabsContent value="basic" className="space-y-4">
            <SectionCard className="mb-8">
              <SectionCardHeader>
                <SectionCardTitle>Basic Information</SectionCardTitle>
                <SectionCardDescription>
                  Configure the basic details of your agent
                </SectionCardDescription>
              </SectionCardHeader>
              <SectionCardContent className="space-y-4">
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
              </SectionCardContent>
              <ActionFooter>
                <Button variant="outline"
                  type="button"
                  onClick={handleSaveBasicInfo}
                  disabled={isSaving} size="sm">
                  {isSaving ? "Saving..." : "Save Basic Information"}
                </Button>
              </ActionFooter>
            </SectionCard>
            
            <SectionCard className="mb-8">
              <SectionCardHeader>
                <SectionCardTitle>Agent Prompt</SectionCardTitle>
                <SectionCardDescription>
                  Define the system prompt that sets the behavior and capabilities of your agent
                </SectionCardDescription>
              </SectionCardHeader>
              <SectionCardContent>
                <Textarea 
                  value={prompt} 
                  onChange={(e) => setPrompt(e.target.value)} 
                  placeholder="Enter system prompt for the agent"
                  rows={10}
                  className="font-mono text-sm"
                />
              </SectionCardContent>
              <ActionFooter>
                <Button variant="outline"
                  type="button"
                  onClick={handleSavePrompt}
                  disabled={isSaving} size="sm">
                  {isSaving ? "Saving..." : "Save Prompt"}
                </Button>
              </ActionFooter>
            </SectionCard>
            
            <SectionCard className="mb-8">
              <SectionCardHeader>
                <SectionCardTitle>Agent Backstory</SectionCardTitle>
                <SectionCardDescription>
                  Create a compelling backstory to give your agent more personality and context
                </SectionCardDescription>
              </SectionCardHeader>
              <SectionCardContent>
                <Textarea 
                  value={backstory} 
                  onChange={(e) => setBackstory(e.target.value)} 
                  placeholder="Enter a backstory for this agent (e.g., professional background, experience, expertise)"
                  rows={6}
                />
              </SectionCardContent>
              <ActionFooter>
                <Button variant="outline"
                  type="button"
                  onClick={handleSaveBackstory}
                  disabled={isSaving} size="sm">
                  {isSaving ? "Saving..." : "Save Backstory"}
                </Button>
              </ActionFooter>
            </SectionCard>
          </TabsContent>

          <TabsContent value="tools" className="space-y-4">
            {/* Favorites Section */}
            <SectionCard>
              <SectionCardHeader>
                <SectionCardTitle>Favorites</SectionCardTitle>
                <SectionCardDescription>
                  Your most used tools
                </SectionCardDescription>
              </SectionCardHeader>
              <SectionCardContent>
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
              </SectionCardContent>
            </SectionCard>

            {/* All Tools Section */}
            <SectionCard>
              <SectionCardHeader>
                <SectionCardTitle>All Tools</SectionCardTitle>
                <SectionCardDescription>
                  Enable or disable tools that your agent can use
                </SectionCardDescription>
              </SectionCardHeader>
              <SectionCardContent>
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
              </SectionCardContent>
            </SectionCard>
          </TabsContent>

          <TabsContent value="triggers" className="space-y-4">
            {/* Favorites Section */}
            <SectionCard>
              <SectionCardHeader>
                <SectionCardTitle>Favorites</SectionCardTitle>
                <SectionCardDescription>
                  Your most used triggers
                </SectionCardDescription>
              </SectionCardHeader>
              <SectionCardContent>
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
              </SectionCardContent>
            </SectionCard>

            {/* All Triggers Section */}
            <SectionCard>
              <SectionCardHeader>
                <SectionCardTitle>All Triggers</SectionCardTitle>
                <SectionCardDescription>
                  Configure when and how your agent should be activated
                </SectionCardDescription>
              </SectionCardHeader>
              <SectionCardContent>
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
              </SectionCardContent>
            </SectionCard>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-4">
            {/* Favorites Section */}
            <SectionCard>
              <SectionCardHeader>
                <SectionCardTitle>Favorites</SectionCardTitle>
                <SectionCardDescription>
                  Your most used integrations
                </SectionCardDescription>
              </SectionCardHeader>
              <SectionCardContent>
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
              </SectionCardContent>
            </SectionCard>

            {/* All Integrations Section */}
            <SectionCard>
              <SectionCardHeader>
                <SectionCardTitle>All Integrations</SectionCardTitle>
                <SectionCardDescription>
                  Connect your agent to external services
                </SectionCardDescription>
              </SectionCardHeader>
              <SectionCardContent>
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
              </SectionCardContent>
            </SectionCard>
          </TabsContent>

          <TabsContent value="context" className="space-y-4">
            <SectionCard className="mb-8">
              <SectionCardHeader>
                <SectionCardTitle>Context Files</SectionCardTitle>
                <SectionCardDescription>
                  Add files that provide context for your agent
                </SectionCardDescription>
              </SectionCardHeader>
              <SectionCardContent>
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
              </SectionCardContent>
              <ActionFooter>
                <UploadFileDialog 
                  agentId={agentId} 
                  onFileUploaded={handleFileUploaded}
                  buttonLabel="Add File"
                />
              </ActionFooter>
            </SectionCard>
            
            {/* Compatible Assets Section */}
            <SectionCard>
              <SectionCardHeader>
                <div>
                  <SectionCardTitle>Available Assets</SectionCardTitle>
                  <SectionCardDescription>
                    Compatible files from your site that can be attached to this agent
                  </SectionCardDescription>
                </div>
              </SectionCardHeader>
              <SectionCardContent>
                {isAssetsLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-8 w-8 rounded" />
                          <div className="space-y-1">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-20" />
                          </div>
                        </div>
                        <Skeleton className="h-8 w-20" />
                      </div>
                    ))}
                  </div>
                ) : availableAssets.length > 0 ? (
                  <div className="space-y-2">
                    {availableAssets.map((asset) => (
                      <div 
                        key={asset.id} 
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 dark:hover:bg-gray-800/60 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0">
                            {asset.file_type.startsWith('image/') ? (
                              <img 
                                src={asset.file_path} 
                                alt={asset.name}
                                className="h-8 w-8 object-cover rounded"
                                onError={(e) => {
                                  const target = e.currentTarget as HTMLImageElement
                                  target.style.display = 'none'
                                  const nextElement = target.nextElementSibling as HTMLElement
                                  if (nextElement) {
                                    nextElement.style.display = 'flex'
                                  }
                                }}
                              />
                            ) : null}
                            <div className={`h-8 w-8 rounded bg-muted flex items-center justify-center ${asset.file_type.startsWith('image/') ? 'hidden' : ''}`}>
                              <FileText className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm truncate">{asset.name}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                              <span>{asset.file_type}</span>
                              {asset.tags.length > 0 && (
                                <>
                                  <span>•</span>
                                  <div className="flex gap-1">
                                    {asset.tags.slice(0, 2).map((tag) => (
                                      <Badge 
                                        key={tag} 
                                        variant="secondary" 
                                        className="text-[10px] px-1 py-0 h-4"
                                      >
                                        {tag}
                                      </Badge>
                                    ))}
                                    {asset.tags.length > 2 && (
                                      <span className="text-[10px] text-muted-foreground">
                                        +{asset.tags.length - 2} more
                                      </span>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {asset.isAttachedToAgent && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                              Attached
                            </Badge>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (asset.isAttachedToAgent) {
                                handleAssetDetach(asset.id)
                              } else {
                                handleAssetAttach(asset.id)
                              }
                            }}
                            disabled={isAssetsLoading}
                          >
                            {asset.isAttachedToAgent ? (
                              <>
                                <UnlinkIcon className="h-3 w-3 mr-1" />
                                Detach
                              </>
                            ) : (
                              <>
                                <LinkIcon className="h-3 w-3 mr-1" />
                                Attach
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyCard 
                    icon={<FolderOpen className="h-10 w-10 text-muted-foreground" />}
                    contentClassName="mb-4"
                    title="No compatible assets found" 
                    description="Upload compatible files (PDF, CSV, MD, TXT, JSON, YAML, or images) to attach them to your agent" 
                    className="flex flex-col items-center justify-center py-8"
                  />
                )}
              </SectionCardContent>
            </SectionCard>
          </TabsContent>

          <TabsContent value="activities" className="space-y-4">
            <SectionCard className="mb-8">
              <SectionCardHeader>
                <SectionCardTitle>Activities</SectionCardTitle>
                <SectionCardDescription>
                  Configure the activities this agent can perform
                </SectionCardDescription>
              </SectionCardHeader>
              <SectionCardContent>
                {isActivitiesLoading ? (
                  <ActivitiesSkeleton />
                ) : activities.length > 0 ? (
                  <div className="space-y-3">
                    {activities
                      .filter(activity => 
                        activity.name.toLowerCase().includes(activitySearch.toLowerCase()) ||
                        activity.description.toLowerCase().includes(activitySearch.toLowerCase())
                      )
                      .map(activity => (
                        <ActivityItem 
                          key={activity.id}
                          id={activity.id}
                          name={activity.name}
                          description={activity.description}
                          status={activity.status}
                          onToggle={handleActivityToggle}
                        />
                      ))}
                  </div>
                ) : (
                  <EmptyCard 
                    icon={<Tag className="h-10 w-10 text-muted-foreground" />}
                    contentClassName="mb-4"
                    title="No activities configured" 
                    description="Add activities to specify what this agent can do" 
                    className="flex flex-col items-center justify-center py-8"
                  />
                )}
              </SectionCardContent>
              <ActionFooter>
                <Button variant="outline"
                  type="button"
                  onClick={handleSaveActivities}
                  disabled={isSaving} size="sm">
                  {isSaving ? "Saving..." : "Save Activities"}
                </Button>
              </ActionFooter>
            </SectionCard>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

export default AgentDetailPageContent 