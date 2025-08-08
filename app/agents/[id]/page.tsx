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
  Trash2,
  FolderOpen,
  Link as LinkIcon,
  XCircle as UnlinkIcon
} from "@/app/components/ui/icons"
import { Agent, AgentActivity } from "@/app/types/agents"
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

// Get default activities for role
const getDefaultActivitiesForRole = (role: string = ""): AgentActivity[] => {
  // Role-specific activities with detailed attributes matching the original format
  switch(role) {
    case "Growth Lead/Manager":
      return [
        {
          id: "gl1",
          name: "Task Monitoring",
          description: "Track progress of assigned tasks and ensure timely completion of deliverables",
          status: "available"
        },
        {
          id: "gl2",
          name: "Stakeholder Coordination",
          description: "Facilitate decision-making processes with key stakeholders and project owners",
          status: "available"
        },
        {
          id: "gl3",
          name: "Vendor Management",
          description: "Monitor vendor relationships, deliverables and ensure alignment with project goals",
          status: "available"
        },
        {
          id: "gl4",
          name: "Task Validation",
          description: "Review completed tasks against requirements and provide quality assurance",
          status: "available"
        },
        {
          id: "gl5",
          name: "Team Coordination",
          description: "Facilitate cross-functional collaboration, resolve conflicts and align team efforts with strategic goals",
          status: "available"
        },
        {
          id: "gl6",
          name: "Daily Stand Up",
          description: "Generate comprehensive daily team progress report with insights and next steps",
          status: "available"
        },
        {
          id: "gl7",
          name: "Assign Leads",
          description: "Automatically assign leads to appropriate team members based on criteria and workload",
          status: "available"
        }
      ];
    case "Data Analyst":
      return [
        {
          id: "da1",
          name: "User Behavior Analysis",
          description: "Analyze user activity patterns and engagement metrics across website and mobile app",
          status: "available"
        },
        {
          id: "da2",
          name: "Sales Trend Analysis",
          description: "Identify and interpret sales patterns, growth opportunities and conversion metrics",
          status: "available"
        },
        {
          id: "da3",
          name: "Cost Trend Analysis",
          description: "Monitor expense patterns, identify cost optimization opportunities and ROI evaluation",
          status: "available"
        },
        {
          id: "da4",
          name: "Cohort Health Monitoring",
          description: "Track customer cohort performance, retention metrics, and lifetime value analysis",
          status: "available"
        },
        {
          id: "da5",
          name: "Data-Driven Task Validation",
          description: "Verify completed tasks against performance data and validate with metric-based evidence",
          status: "available"
        }
      ];
    case "Growth Marketer":
      return [
        {
          id: "mk1",
          name: "Create Marketing Campaign",
          description: "Develop a complete marketing campaign with creative, copy, and channel strategy",
          status: "available"
        },
        {
          id: "mk2",
          name: "SEO Content Optimization",
          description: "Analyze and optimize website content for better search performance",
          status: "available"
        },
        {
          id: "mk3",
          name: "A/B Test Design",
          description: "Create statistically valid A/B tests for landing pages or email campaigns",
          status: "available"
        },
        {
          id: "mk4",
          name: "Analyze Segments",
          description: "Identify and analyze customer segments to optimize targeting and conversion strategies",
          status: "available"
        },
        {
          id: "mk5",
          name: "Campaign Requirements Creation",
          description: "Develop detailed specifications and requirements documentation for marketing campaigns",
          status: "available"
        }
      ];
    case "UX Designer":
      return [
        {
          id: "ux1",
          name: "Website Analysis",
          description: "Conduct comprehensive evaluation of website usability, information architecture and user experience",
          status: "available"
        },
        {
          id: "ux2",
          name: "Application Analysis",
          description: "Evaluate mobile and desktop applications for usability issues, interaction design and user flows",
          status: "available"
        },
        {
          id: "ux3",
          name: "Product Requirements Creation",
          description: "Develop detailed user-centered product requirements, specifications and design documentation",
          status: "available"
        }
      ];
    case "Sales/CRM Specialist":
      return [
        {
          id: "sl1",
          name: "Lead Follow-up Management",
          description: "Systematically track and engage with leads through personalized communication sequences",
          status: "available"
        },
        {
          id: "sl2",
          name: "Appointment Generation",
          description: "Create and schedule qualified sales meetings with prospects through effective outreach",
          status: "available"
        },
        {
          id: "sl3",
          name: "Lead Generation",
          description: "Identify and qualify potential customers through various channels and targeting strategies",
          status: "available"
        },
        {
          id: "sl4",
          name: "Lead Profile Research",
          description: "Analyze prospect backgrounds, needs, and pain points to create personalized sales approaches",
          status: "available"
        },
        {
          id: "sl5",
          name: "Generate Sales Order",
          description: "Create complete sales orders with product details, pricing, and customer information",
          status: "available"
        }
      ];
    case "Customer Support":
      return [
        {
          id: "cs1",
          name: "Knowledge Base Management",
          description: "Create, update, and organize product documentation and user guides for self-service support",
          status: "available"
        },
        {
          id: "cs2",
          name: "FAQ Development",
          description: "Identify common customer questions and create comprehensive answers for quick resolution",
          status: "available"
        },
        {
          id: "cs3",
          name: "Escalation Management",
          description: "Handle complex customer issues and escalate to appropriate teams with complete context",
          status: "available"
        }
      ];
    case "Content Creator & Copywriter":
      return [
        {
          id: "ct1",
          name: "Content Calendar Creation",
          description: "Develop a content calendar with themes, topics, and publishing schedule",
          status: "available"
        },
        {
          id: "ct2",
          name: "Email Sequence Copywriting",
          description: "Write engaging email sequences for nurturing prospects through the funnel",
          status: "available"
        },
        {
          id: "ct3",
          name: "Landing Page Copywriting",
          description: "Create persuasive, conversion-focused copy for landing pages",
          status: "available"
        }
      ];
    default:
      // Default activities if role not recognized
      return [
        {
          id: "default1",
          name: "General Assistance",
          description: "Provide general assistance and information on various topics",
          status: "available"
        },
        {
          id: "default2",
          name: "Research Requests",
          description: "Conduct research on specific topics and provide detailed findings",
          status: "available"
        },
        {
          id: "default3",
          name: "Recommendations",
          description: "Provide customized recommendations based on specific requirements",
          status: "available"
        }
      ];
  }
};

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

// Esqueleto de carga para la sección de actividades
function ActivitiesSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-3">
        <div className="space-y-1">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
      
      <div className="space-y-3">
        {Array(6).fill(0).map((_, i) => (
          <div key={i} className="border rounded-lg p-3 flex items-center">
            <div className="flex-1 flex items-center space-x-3">
              <Skeleton className="h-4 w-4 rounded-full" />
              <div className="space-y-1 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-44" />
              </div>
            </div>
            <Skeleton className="h-5 w-10 rounded-full" />
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
                  {['Basic Information', 'Tools', 'Triggers', 'Integrations', 'Context Files', 'Activities'].map((tab, index) => (
                    <div 
                      key={index} 
                      className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ${
                        index === 0 
                          ? 'bg-background text-foreground shadow-sm' 
                          : (index === 1 || index === 2 || index === 3 ? 'hidden' : 'text-muted-foreground')
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

// Content component that will use React.use()
function AgentDetailPageContent({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = React.use(params)
  const agentId = unwrappedParams.id
  const router = useRouter()
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
      role: "Growth Lead/Manager",
      name: "Growth Lead/Manager", 
      description: "Strategy integration, team coordination, budget management, KPI tracking",
      type: "marketing",
      promptTemplate: "You are a Growth Lead/Manager assistant. Your goal is to help with strategy integration, team coordination, budget management, and KPI tracking.",
      backstory: "As a former Growth Lead at several successful startups, I've managed marketing teams that achieved 3x user growth in under a year. I specialize in connecting marketing strategies with business goals and excel at coordinating cross-functional teams to execute growth initiatives efficiently."
    },
    { 
      role: "Data Analyst",
      name: "Data Analyst", 
      description: "Data analysis, lead qualification, segmentation, performance metrics, optimization",
      type: "marketing",
      promptTemplate: "You are a Data Analyst assistant. Your goal is to help with data analysis, lead qualification, segmentation, performance metrics, and optimization.",
      backstory: "With 8+ years of experience in marketing analytics, I've helped companies transform raw data into actionable insights. I specialize in customer segmentation, attribution modeling, and performance tracking that drives measurable business results. I've implemented data-driven strategies that increased conversion rates by up to 40%."
    },
    { 
      role: "Growth Marketer",
      name: "Growth Marketer", 
      description: "Marketing strategy, omnichannel campaigns, A/B testing, SEO techniques",
      type: "marketing",
      promptTemplate: "You are a Growth Marketer assistant. Your goal is to help with marketing strategy, omnichannel campaigns, A/B testing, and SEO techniques.",
      backstory: "I've worked with over 50 SaaS companies to develop and execute growth strategies across multiple channels. My expertise includes SEO optimization that's driven 200%+ organic traffic growth, designing conversion-focused marketing funnels, and implementing rigorous A/B testing frameworks that continuously improve campaign performance."
    },
    { 
      role: "UX Designer",
      name: "UX Designer", 
      description: "Conversion optimization, UX/UI design for funnel, onboarding experience",
      type: "marketing",
      promptTemplate: "You are a UX Designer assistant. Your goal is to help with conversion optimization, UX/UI design for funnel, and onboarding experience.",
      backstory: "I've led UX design teams at both startups and enterprise companies, creating intuitive user experiences that drive engagement and retention. I specialize in user research, journey mapping, and conversion-focused design that transforms complex processes into simple, delightful interactions. My redesigns have improved conversion rates by an average of 35%."
    },
    { 
      role: "Sales/CRM Specialist",
      name: "Sales/CRM Specialist", 
      description: "Lead management, demos, systematic follow-up, sales cycle",
      type: "sales",
      promptTemplate: "You are a Sales/CRM Specialist assistant. Your goal is to help with lead management, demos, systematic follow-up, and sales cycle optimization.",
      backstory: "With over a decade in SaaS sales, I've built and optimized sales processes from scratch that generated millions in ARR. I excel at implementing CRM systems that improve lead management efficiency by 50%+ and designing sales playbooks that shorten sales cycles while increasing close rates. I've trained dozens of sales reps who consistently exceed their targets."
    },
    { 
      role: "Customer Support",
      name: "Customer Support", 
      description: "Knowledge base management, FAQ development, customer issue escalation",
      type: "support",
      promptTemplate: "You are a Customer Support assistant. Your goal is to help with knowledge base management, FAQ development, and customer issue escalation.",
      backstory: "I've built support teams from the ground up at several high-growth companies, achieving 98%+ customer satisfaction ratings. I specialize in creating comprehensive knowledge bases that reduce ticket volume by 40% and implementing efficient ticket management systems. I'm particularly skilled at turning customer feedback into actionable product improvements."
    },
    { 
      role: "Content Creator & Copywriter",
      name: "Content Creator & Copywriter", 
      description: "Persuasive copywriting, site content, blog posts, email sequences",
      type: "marketing",
      promptTemplate: "You are a Content Creator & Copywriter assistant. Your goal is to help with persuasive copywriting, site content, blog posts, and email sequences.",
      backstory: "I've written for brands across multiple industries, creating content strategies that drive engagement and conversions. My email campaigns typically achieve 30%+ open rates and 5%+ CTR. I specialize in creating SEO-optimized blog content that ranks in the top 3 positions and crafting compelling website copy that tells a brand's story while driving action."
    }
  ]
  
  // Mapping from old role keys to new human-readable roles
  const roleKeyMapping: Record<string, string> = {
    "growth_lead": "Growth Lead/Manager",
    "data_analyst": "Data Analyst",
    "growth_marketer": "Growth Marketer",
    "ux_designer": "UX Designer",
    "sales": "Sales/CRM Specialist",
    "support": "Customer Support",
    "content_creator": "Content Creator & Copywriter"
  };

  // Find default template to use
  const getDefaultTemplate = () => {
    // First, check if agentId corresponds directly to a template role (new format)
    if (!isNewAgent) {
      const templateByRole = defaultAgentTemplates.find(t => t.role === agentId);
      if (templateByRole) {
        console.log("Found template by direct role match:", agentId);
        return templateByRole;
      }
      
      // Then check if agentId is an old role key that needs mapping
      const mappedRole = roleKeyMapping[agentId];
      if (mappedRole) {
        const templateByMappedRole = defaultAgentTemplates.find(t => t.role === mappedRole);
        if (templateByMappedRole) {
          console.log("Found template by mapped role:", agentId, "->", mappedRole);
          return templateByMappedRole;
        }
      }
    }
    
    // Then check if we have a role parameter in the URL
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const roleParam = urlParams.get('role');
      
      if (roleParam) {
        // First try direct match
        const template = defaultAgentTemplates.find(t => t.role === roleParam);
        if (template) return template;
        
        // Then try mapped role
        const mappedRole = roleKeyMapping[roleParam];
        if (mappedRole) {
          const templateByMappedRole = defaultAgentTemplates.find(t => t.role === mappedRole);
          if (templateByMappedRole) return templateByMappedRole;
        }
      }
    }
    
    // Default to Customer Support if no parameter is found
    const supportTemplate = defaultAgentTemplates.find(t => t.role === "Customer Support");
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
          let template = defaultAgentTemplates.find(t => t.role === agentId);
          let roleForDefaults = agentId;
          
          // If not found, try mapping from old role key
          if (!template) {
            const mappedRole = roleKeyMapping[agentId];
            if (mappedRole) {
              template = defaultAgentTemplates.find(t => t.role === mappedRole);
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
      
      // Convert activities array to configuration format
      const activitiesConfig = activities.reduce((config, activity) => {
        config[activity.id] = { 
          name: activity.name,
          description: activity.description,
          status: activity.status,
          enabled: activity.status === "available" // For backwards compatibility
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
        // Para agentes nuevos, usar el rol de la plantilla
        // Buscar si el agentId coincide con algún rol de plantilla
        const templateMatch = defaultAgentTemplates.find(t => t.role === agentId);
        
        if (templateMatch) {
          // Si hay coincidencia directa con un ID de plantilla, usar ese rol
          agentRole = templateMatch.role;
        } else {
          // Check if agentId is an old role key that needs mapping
          const mappedRole = roleKeyMapping[agentId];
          if (mappedRole) {
            agentRole = mappedRole;
          } else {
            // Si no, verificar si se especificó un rol en los parámetros de URL
            const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
            const roleParam = urlParams ? urlParams.get('role') : null;
            
            if (roleParam) {
              // First try direct match
              if (defaultAgentTemplates.some(t => t.role === roleParam)) {
                agentRole = roleParam;
              } else {
                // Then try mapped role
                const mappedRoleParam = roleKeyMapping[roleParam];
                if (mappedRoleParam && defaultAgentTemplates.some(t => t.role === mappedRoleParam)) {
                  agentRole = mappedRoleParam;
                } else {
                  // De lo contrario, usar el rol del template por defecto
                  agentRole = defaultTemplate.role;
                }
              }
            } else {
              // De lo contrario, usar el rol del template por defecto
              agentRole = defaultTemplate.role;
            }
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
        role: agentRole, // Usar el rol real del agente, no su nombre
        conversations: 0,
        success_rate: 0,
        tools: toolsConfig,
        activities: activitiesConfig,
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
        console.log("Checking for existing agent with same role, user_id, and site_id");
        const { data: existingAgent } = await supabase
          .from('agents')
          .select('id')
          .eq('role', agentRole)
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
                  <TabsTrigger value="tools" className="hidden">Tools</TabsTrigger>
                  <TabsTrigger value="triggers" className="hidden">Triggers</TabsTrigger>
                  <TabsTrigger value="integrations" className="hidden">Integrations</TabsTrigger>
                  <TabsTrigger value="context">Context Files</TabsTrigger>
                  <TabsTrigger value="activities">Activities</TabsTrigger>
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
                {activeTab === "activities" && (
                  <SearchInput
                    placeholder="Search activities..."
                    value={activitySearch}
                    onSearch={setActivitySearch}
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
            
            {/* Compatible Assets Section */}
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Available Assets</CardTitle>
                  <CardDescription>
                    Compatible files from your site that can be attached to this agent
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
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
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
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
                            variant={asset.isAttachedToAgent ? "outline" : "default"}
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
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activities" className="space-y-4">
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Activities</CardTitle>
                <CardDescription>
                  Configure the activities this agent can perform
                </CardDescription>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

export default AgentDetailPageContent 