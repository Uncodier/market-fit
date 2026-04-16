"use client"

import { useEffect, useState, Suspense, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/app/components/ui/button"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { Badge } from "@/app/components/ui/badge"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Textarea } from "@/app/components/ui/textarea"
import { toast } from "sonner"
import { updateRequirementStatus, updateCompletionStatus, updateRequirementPriority, updateRequirementInstructions, updateRequirement, deleteRequirement } from "../actions"
import { markdownToHTML } from "../utils"
import { RequirementStatusList } from "./components/RequirementStatusList"
import { AddSecretDialog } from "@/app/components/ui/add-secret-dialog"

// Function to convert HTML back to markdown
const htmlToMarkdown = (html: string): string => {
  if (!html) return '';
  
  try {
    // Create a temporary element to parse HTML
    const tempElement = document.createElement('div');
    tempElement.innerHTML = html;
    
    // Function to convert DOM node to markdown
    const nodeToMarkdown = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || '';
      }
      
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        const children = Array.from(element.childNodes).map(nodeToMarkdown).join('');
        
        switch (element.tagName.toLowerCase()) {
          case 'h1':
            return `# ${children}\n\n`;
          case 'h2':
            return `## ${children}\n\n`;
          case 'h3':
            return `### ${children}\n\n`;
          case 'h4':
            return `#### ${children}\n\n`;
          case 'h5':
            return `##### ${children}\n\n`;
          case 'h6':
            return `###### ${children}\n\n`;
          case 'p':
            return `${children}\n\n`;
          case 'strong':
          case 'b':
            return `**${children}**`;
          case 'em':
          case 'i':
            return `*${children}*`;
          case 'ul':
            return `${children}\n`;
          case 'ol':
            return `${children}\n`;
          case 'li':
            return `- ${children}\n`;
          case 'blockquote':
            return `> ${children}\n\n`;
          case 'code':
            return `\`${children}\``;
          case 'pre':
            return `\`\`\`\n${children}\n\`\`\`\n\n`;
          case 'br':
            return '\n';
          case 'a':
            const href = element.getAttribute('href');
            return href ? `[${children}](${href})` : children;
          case 'img':
            const src = element.getAttribute('src');
            const alt = element.getAttribute('alt') || '';
            return src ? `![${alt}](${src})` : '';
          default:
            return children;
        }
      }
      
      return '';
    };
    
    const markdown = nodeToMarkdown(tempElement);
    
    // Clean up extra newlines
    return markdown
      .replace(/\n{3,}/g, '\n\n') // Replace 3+ newlines with 2
      .trim();
    
  } catch (error) {
    console.error("Error converting HTML to markdown:", error);
    // Fallback: strip HTML tags
    return html.replace(/<[^>]*>/g, '').trim();
  }
}
import { 
  ChevronLeft,
  Save, 
  X, 
  Archive,
  RotateCcw,
  CheckCircle2,
  Ban,
  FileText,
  MessageSquare,
  ChevronDown,
  Target,
  Type,
  Tag,
  FileText as TextIcon,
  Users,
  BarChart,
  Undo,
  Redo,
  CalendarIcon,
  Bot,
  Wand2,
  AlertCircle,
  Trash2,
  Plus,
  Workflow,
  GitFork,
  CirclePlay,
  Settings,
  Zap,
  Globe,
  Database,
  GripHorizontal,
  PanelRightClose,
  PanelRightOpen,
  Code,
  Key
} from "@/app/components/ui/icons"
import { ZoomableCanvas } from "@/app/components/agents/zoomable-canvas"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { Card, CardContent } from "@/app/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/app/hooks/use-auth"
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import HardBreak from '@tiptap/extension-hard-break'
import '../styles/editor.css'
import { Skeleton } from "@/app/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/app/components/ui/alert-dialog"
import { cn } from "@/lib/utils"

// Constants for status (same as in the main requirements page)
const REQUIREMENT_STATUS = {
  VALIDATED: "validated",
  IN_PROGRESS: "in-progress",
  ON_REVIEW: "on-review",
  DONE: "done",
  BACKLOG: "backlog",
  CANCELED: "canceled"
} as const;

const COMPLETION_STATUS = {
  PENDING: "pending",
  COMPLETED: "completed",
  REJECTED: "rejected"
} as const;

type RequirementStatusType = typeof REQUIREMENT_STATUS[keyof typeof REQUIREMENT_STATUS];
type CompletionStatusType = typeof COMPLETION_STATUS[keyof typeof COMPLETION_STATUS];

// Define interface for requirement
interface Requirement {
  id: string
  title: string
  description: string
  instructions: string
  type: "content" | "design" | "research" | "follow_up" | "task" | "develop" | "analytics" | "testing" | "approval" | "coordination" | "strategy" | "optimization" | "automation" | "integration" | "planning" | "payment"
  priority: "high" | "medium" | "low"
  status: RequirementStatusType
  completionStatus: CompletionStatusType
  source: string
  campaigns?: string[]
  campaignNames?: string[]
  campaign_id?: string
  budget: number | null
  createdAt: string
  segments: string[]
  segmentNames?: string[]
  outsourceInstructions?: string
  campaignOutsourced?: boolean
  metadata?: {
    payment_status?: {
      status: 'pending' | 'paid' | 'failed'
      amount_paid?: number
      amount_due?: number
      currency?: string
      payment_method?: string
      stripe_payment_intent_id?: string
      payment_date?: string
      invoice_number?: string
      outsourced?: boolean
      outsource_provider?: string
      outsource_contact?: string
    }
  }
}

// Loading state skeleton component
const RequirementSkeleton = () => {
  return (
    <div className="flex h-[calc(100dvh-64px)]">
      {/* Main Content Area Skeleton */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-none border-b pl-[20px] pr-4 py-2 h-[71px]">
          <div className="flex gap-2 h-full items-center">
            <Skeleton className="h-9 w-24 rounded" />
            <Skeleton className="h-9 w-24 rounded" />
            <div className="w-px h-6 bg-muted mx-1"></div>
            <div className="flex space-x-1">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div className="p-4 space-y-6 max-w-4xl mx-auto">
            <div className="space-y-4">
              <div className="flex">
                <Skeleton className="h-7 w-60 mb-4" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-5/6" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-4/5" />
              </div>
              <div className="space-y-1 mt-6">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-5 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel Skeleton */}
      <div className="w-80 border-l bg-muted/30 flex flex-col h-full">
        {/* Tabs Header */}
        <div className="flex-none h-[71px] border-b flex items-center justify-center px-4">
          <div className="grid grid-cols-2 w-full gap-2 h-10">
            <Skeleton className="h-full rounded" />
            <Skeleton className="h-full rounded" />
          </div>
        </div>
        
        {/* Tabs Content */}
        <div className="flex-1 p-5 overflow-auto">
          {/* Outsource Tab Content */}
          <div className="bg-muted/40 rounded-lg p-4 border border-border/30 mb-5">
            <Skeleton className="h-4 w-40 mb-3" />
            
            <div className="space-y-3">
              {/* Budget Section */}
              <div className="bg-primary/10 p-3 rounded-md border border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-6 w-1/2 mx-auto" />
              </div>
              
              {/* Instructions Section */}
              <div className="space-y-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-[150px] w-full" />
                <Skeleton className="h-3 w-full" />
              </div>
              
              {/* Other Sections */}
              <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
              
              <div className="space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-20 w-full" />
              </div>
            </div>
          </div>
        </div>
        
        {/* Fixed footer */}
        <div className="border-t p-4 bg-background">
          <Skeleton className="h-10 w-full rounded" />
        </div>
      </div>
    </div>
  )
}

// First, wrap the component with Suspense
export default function RequirementDetailPage() {
  return (
    <Suspense fallback={<RequirementSkeleton />}>
      <RequirementDetailContent />
    </Suspense>
  );
}

// Move the main component logic to a separate component
function RequirementDetailContent() {
  const params = useParams()
  const router = useRouter()
  const { user, isLoading: isAuthLoading } = useAuth()
  const [requirement, setRequirement] = useState<Requirement | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isBuilding, setIsBuilding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasRequirementStatus, setHasRequirementStatus] = useState(false)
  const [showRightPanel, setShowRightPanel] = useState(true)
  const [editorHeight, setEditorHeight] = useState(400) // Default height for editor
  const [isResizing, setIsResizing] = useState(false)
  
  // Custom nodes for the workflow builder
  const [nodes, setNodes] = useState<any[]>([
    {
      id: 'trigger-node',
      type: 'trigger',
      position: { x: 50, y: 150 },
      data: { 
        label: 'When requirement is triggered',
        cron: 'Run once'
      }
    }
  ])
  const [connections, setConnections] = useState<any[]>([])
  
  // State for workflow history (undo/redo)
  const [workflowHistory, setWorkflowHistory] = useState<{
    past: { nodes: any[], connections: any[] }[],
    future: { nodes: any[], connections: any[] }[]
  }>({ past: [], future: [] });
  const isHistoryActionRef = useRef(false);
  const isInitialLoadRef = useRef(true);

  // Track workflow history
  useEffect(() => {
    // Skip initial load
    if (isInitialLoadRef.current) {
      if (nodes.length > 0) {
        setWorkflowHistory({
          past: [{ nodes: JSON.parse(JSON.stringify(nodes)), connections: JSON.parse(JSON.stringify(connections)) }],
          future: []
        });
        isInitialLoadRef.current = false;
      }
      return;
    }

    if (isHistoryActionRef.current) {
      isHistoryActionRef.current = false;
      return;
    }

    const timer = setTimeout(() => {
      setWorkflowHistory(prev => {
        const lastState = prev.past[prev.past.length - 1];
        
        // Deep compare to prevent pushing duplicate states
        if (lastState && 
            JSON.stringify(lastState.nodes) === JSON.stringify(nodes) && 
            JSON.stringify(lastState.connections) === JSON.stringify(connections)) {
          return prev;
        }

        return {
          past: [...prev.past, { 
            nodes: JSON.parse(JSON.stringify(nodes)), 
            connections: JSON.parse(JSON.stringify(connections)) 
          }],
          future: []
        };
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [nodes, connections]);

  const handleUndoWorkflow = () => {
    setWorkflowHistory(prev => {
      if (prev.past.length <= 1) return prev; // Keep at least one initial state
      
      const newPast = [...prev.past];
      const currentState = newPast.pop(); // Pop current state
      const previousState = newPast[newPast.length - 1]; // Get previous state
      
      if (!previousState || !currentState) return prev;
      
      isHistoryActionRef.current = true;
      setNodes(previousState.nodes);
      setConnections(previousState.connections);
      setUnsavedChanges(true);
      
      return {
        past: newPast,
        future: [currentState, ...prev.future]
      };
    });
  };

  const handleRedoWorkflow = () => {
    setWorkflowHistory(prev => {
      if (prev.future.length === 0) return prev;
      
      const newFuture = [...prev.future];
      const nextState = newFuture.shift();
      
      if (!nextState) return prev;
      
      isHistoryActionRef.current = true;
      setNodes(nextState.nodes);
      setConnections(nextState.connections);
      setUnsavedChanges(true);
      
      return {
        past: [...prev.past, nextState],
        future: newFuture
      };
    });
  };
  
  // State for dragging connections
  const [isConnecting, setIsConnecting] = useState<{fromNodeId: string, startX: number, startY: number, sourceHandle?: string} | null>(null);
  const [currentMousePos, setCurrentMousePos] = useState<{x: number, y: number} | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [unsavedChanges, setUnsavedChanges] = useState(false)
  const [pendingSegmentChanges, setPendingSegmentChanges] = useState<{
    pendingSegments: Array<{id: string, name: string}>,
    removedSegmentIds: string[]
  } | null>(null)
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    instructions: '',
    type: 'task' as "content" | "design" | "research" | "follow_up" | "task" | "develop" | "analytics" | "testing" | "approval" | "coordination" | "strategy" | "optimization" | "automation" | "integration" | "planning" | "payment",
    priority: 'medium' as 'high' | 'medium' | 'low',
    status: 'backlog' as RequirementStatusType,
    completionStatus: 'pending' as CompletionStatusType,
    source: '',
    budget: null as number | null,
    segments: [] as string[],
    campaigns: [] as string[],
    campaign_id: '',
    segmentNames: [] as string[],
    campaignNames: [] as string[],
    outsourceInstructions: '',
  })
  const [campaigns, setCampaigns] = useState<Array<{
    id: string, 
    title: string, 
    description?: string,
    segments?: string[],
    segmentNames?: string[]
  }>>([])
  const [segments, setSegments] = useState<Array<{id: string, name: string}>>([])
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>("")
  const [showSegmentDropdown, setShowSegmentDropdown] = useState(false)

  // Initialize editor with TipTap
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        hardBreak: false, // We'll use our own configuration
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      HardBreak.configure({
        keepMarks: true,
        HTMLAttributes: {
          class: 'markdown-line-break',
        },
      }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const markdown = htmlToMarkdown(html);
      setEditForm(prev => ({ 
        ...prev, 
        instructions: html,
        outsourceInstructions: markdown // Keep in sync
      }))
    },
    editorProps: {
      attributes: {
        class: 'prose-lg prose-headings:my-4 prose-p:my-3 prose-ul:my-3',
      },
    },
  })

  // Load requirement data
  useEffect(() => {
    if (params.id && user) {
      loadRequirement()
    } else if (!isAuthLoading && !user) {
      // If we're not loading auth and there's no user, show auth error
      setError("You must be signed in to view requirements")
      setIsLoading(false)
    }
  }, [params.id, user, isAuthLoading])

  // Update the page title when requirement is loaded
  useEffect(() => {
    if (requirement) {
      document.title = `${requirement.title} | Requirements`
      
      // Emit a custom event to update the breadcrumb with requirement title
      const event = new CustomEvent('breadcrumb:update', {
        detail: {
          title: requirement.title,
          path: `/requirements/${requirement.id}`,
          section: 'requirements'
        }
      })
      
      setTimeout(() => {
        window.dispatchEvent(event)
      }, 0)
    }
    
    return () => {
      document.title = 'Requirements | Market Fit'
    }
  }, [requirement])

  // Add listener for segment changes
  useEffect(() => {
    const handleSegmentChanges = (event: CustomEvent) => {
      if (event.detail) {
        console.log("Segment changes detected:", event.detail);
        setPendingSegmentChanges({
          pendingSegments: event.detail.pendingSegments || [],
          removedSegmentIds: event.detail.removedSegmentIds || []
        });
        setUnsavedChanges(true);
      }
    };
    
    window.addEventListener('requirement:segment-changes', handleSegmentChanges as EventListener);
    
    return () => {
      window.removeEventListener('requirement:segment-changes', handleSegmentChanges as EventListener);
    };
  }, []);

  // Check for unsaved changes when form values change
  useEffect(() => {
    if (requirement) {
      // Convert current editor content to markdown for comparison
      const currentMarkdownInstructions = htmlToMarkdown(editForm.instructions);
      
      const hasFormChanges = 
        editForm.title !== (requirement.title || '') ||
        editForm.description !== (requirement.description || '') ||
        currentMarkdownInstructions !== (requirement.instructions || '') ||
        editForm.outsourceInstructions !== (requirement.instructions || '') ||
        editForm.type !== (requirement.type || 'task') ||
        editForm.priority !== (requirement.priority || 'medium') ||
        editForm.status !== (requirement.status || 'backlog') ||
        editForm.completionStatus !== (requirement.completionStatus || 'pending') ||
        editForm.source !== (requirement.source || '') ||
        editForm.budget !== requirement.budget;
      
      setUnsavedChanges(hasFormChanges || pendingSegmentChanges !== null);
    }
  }, [editForm, pendingSegmentChanges, requirement]);

  // Reset unsaved changes after successful save
  useEffect(() => {
    const handleRequirementSaved = () => {
      setUnsavedChanges(false);
      setPendingSegmentChanges(null);
    };
    
    window.addEventListener('requirement:saved', handleRequirementSaved);
    
    return () => {
      window.removeEventListener('requirement:saved', handleRequirementSaved);
    };
  }, []);

  // Update editor when requirement is loaded
  useEffect(() => {
    if (editor && requirement?.instructions) {
      // Convert markdown to HTML for proper display
      const formattedHTML = markdownToHTML(requirement.instructions);
      editor.commands.setContent(formattedHTML);
    }
  }, [requirement, editor])


  // Main function to load requirement data
  const loadRequirement = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      // Get an authenticated supabase client
      const supabase = createClient()
      
      // Fetch the requirement directly from Supabase
      const { data: requirement, error: requirementError } = await supabase
        .from("requirements")
        .select(`
          *,
          requirement_segments(segment_id),
          campaign_requirements(campaign_id),
          metadata
        `)
        .eq("id", params.id)
        .single()
      
      if (requirementError) {
        console.error("Error fetching requirement:", requirementError)
        setError(requirementError.message || "Error loading requirement")
        return
      }
      
      if (!requirement) {
        setError("Requirement not found")
        return
      }
      
      // Check if requirement has any status
      const { data: statusData, error: statusError } = await supabase
        .from('requirement_status')
        .select('id')
        .eq('requirement_id', requirement.id)
        .limit(1)

      if (!statusError && statusData && statusData.length > 0) {
        setHasRequirementStatus(true)
      } else {
        setHasRequirementStatus(false)
      }
      
      // Parse nodes from metadata if they exist
      if (requirement.metadata && requirement.metadata.workflow_nodes) {
        setNodes(requirement.metadata.workflow_nodes);
      }
      if (requirement.metadata && requirement.metadata.workflow_connections) {
        setConnections(requirement.metadata.workflow_connections);
      }
      
      // Fetch segments for the site
      const { data: segments, error: segmentsError } = await supabase
        .from("segments")
        .select("*")
        .eq("site_id", requirement.site_id)
      
      if (segmentsError) {
        console.error("Error fetching segments:", segmentsError)
      }
      
      // Fetch campaigns for the site
      const { data: campaigns, error: campaignsError } = await supabase
        .from("campaigns")
        .select("id, title, description, metadata")
        .eq("site_id", requirement.site_id)
      
      if (campaignsError) {
        console.error("Error fetching campaigns:", campaignsError)
      }
      
      // Create maps for segment and campaign lookups
      const segmentsMap = new Map()
      if (segments) {
        segments.forEach((segment: { id: string, name: string }) => {
          segmentsMap.set(segment.id, segment.name)
        })
      }
      
      const campaignsMap = new Map()
      const campaignsOutsourcedMap = new Map()
      if (campaigns) {
        campaigns.forEach((campaign: { id: string, title: string, metadata?: any }) => {
          campaignsMap.set(campaign.id, campaign.title)
          campaignsOutsourcedMap.set(campaign.id, campaign.metadata?.payment_status?.outsourced || false)
        })
      }
      
      // Extract related segment IDs
      const segmentIds = (requirement.requirement_segments || []).map((sr: any) => sr.segment_id)
      
      // Get segment names
      const segmentNames = segmentIds.map((id: string) => segmentsMap.get(id) || "Unknown")
      
      // Extract related campaign IDs
      const campaignIds = (requirement.campaign_requirements || []).map((cr: any) => cr.campaign_id)
      
      // Get campaign names
      const campaignNames = campaignIds.map((id: string) => campaignsMap.get(id) || "Unknown")
      
      // Get the first campaign as the selected one (if any)
      const campaign_id = campaignIds.length > 0 ? campaignIds[0] : ""
      
      // Check if any of the related campaigns is outsourced
      const campaignOutsourced = campaignIds.some((id: string) => 
        campaignsOutsourcedMap.get(id) === true
      );
      
      // Format the requirement
      const formattedRequirement = {
        id: requirement.id,
        title: requirement.title,
        description: requirement.description || "",
        instructions: requirement.instructions || "",
        type: requirement.type || "task",
        priority: requirement.priority || "medium",
        status: requirement.status || "backlog",
        completionStatus: requirement.completion_status || "pending",
        source: requirement.source || "",
        budget: requirement.budget || null,
        createdAt: requirement.created_at || new Date().toISOString(),
        segments: segmentIds,
        segmentNames: segmentNames,
        campaigns: campaignIds,
        campaignNames: campaignNames,
        campaign_id: campaign_id, // Use the first campaign_id (if it exists)
        outsourceInstructions: requirement.instructions || "", // Initialize with instructions since it is the same field
        campaignOutsourced: campaignOutsourced,
        metadata: requirement.metadata || {}
      }
      
      // Debug log for metadata
      console.log("Requirement metadata:", requirement.metadata);
      console.log("Formatted requirement:", formattedRequirement);
      
      // Process segments for the dropdown
      const formattedSegments = segments?.map((segment: {
        id: string;
        name: string;
        description?: string;
      }) => ({
        id: segment.id,
        name: segment.name,
        description: segment.description || "",
      })) || []
      
      // Process campaigns for the dropdown
      // And add the segments information to each campaign
      const formattedCampaigns = campaigns?.map((campaign: {
        id: string;
        title: string;
        description?: string;
      }) => {
        // For each campaign, we will look for related segments
        const campaignWithSegments = {
          id: campaign.id,
          title: campaign.title,
          description: campaign.description || "",
          segments: [] as string[],
          segmentNames: [] as string[]
        }
        
        // We could load the campaign segments here if necessary
        
        return campaignWithSegments
      }) || []
      
      // Update state
      setRequirement(formattedRequirement)
      setCampaigns(formattedCampaigns)
      setSegments(formattedSegments)
      setEditForm({
        title: formattedRequirement.title,
        description: formattedRequirement.description,
        instructions: formattedRequirement.instructions,
        type: formattedRequirement.type,
        priority: formattedRequirement.priority,
        status: formattedRequirement.status,
        completionStatus: formattedRequirement.completionStatus,
        source: formattedRequirement.source,
        budget: formattedRequirement.budget,
        segments: formattedRequirement.segments,
        campaigns: formattedRequirement.campaigns,
        campaign_id: formattedRequirement.campaign_id,
        segmentNames: formattedRequirement.segmentNames,
        campaignNames: formattedRequirement.campaignNames,
        outsourceInstructions: formattedRequirement.instructions || "", // Keep them in sync
      })

      // Set editor content
      if (editor) {
        const formattedHTML = markdownToHTML(formattedRequirement.instructions || '');
        editor.commands.setContent(formattedHTML);
      }
    } catch (error) {
      console.error("Error loading requirement:", error)
      setError("Failed to load requirement data. Please try again.")
      toast.error("Failed to load requirement")
    } finally {
      setIsLoading(false)
    }
  }

  // Handle update requirement status
  const handleUpdateStatus = async (status: RequirementStatusType) => {
    if (!requirement) return
    
    try {
      setIsSaving(true)
      const { error } = await updateRequirementStatus(requirement.id, status)
      
      if (error) {
        throw new Error(error)
      }
      
      setEditForm(prev => ({ ...prev, status }))
      toast.success(`Status updated to ${status}`)
      
      // Refresh data
      loadRequirement()
    } catch (error) {
      console.error("Error updating status:", error)
      toast.error("Failed to update status")
    } finally {
      setIsSaving(false)
    }
  }

  // Handle update completion status
  const handleUpdateCompletionStatus = async (completionStatus: CompletionStatusType) => {
    if (!requirement) return
    
    try {
      setIsSaving(true)
      const { error } = await updateCompletionStatus(requirement.id, completionStatus)
      
      if (error) {
        throw new Error(error)
      }
      
      setEditForm(prev => ({ ...prev, completionStatus }))
      toast.success(`Completion status updated to ${completionStatus}`)
      
      // Refresh data
      loadRequirement()
    } catch (error) {
      console.error("Error updating completion status:", error)
      toast.error("Failed to update completion status")
    } finally {
      setIsSaving(false)
    }
  }

  // Handle update priority
  const handleUpdatePriority = async (priority: "high" | "medium" | "low") => {
    if (!requirement) return
    
    try {
      setIsSaving(true)
      const { error } = await updateRequirementPriority(requirement.id, priority)
      
      if (error) {
        throw new Error(error)
      }
      
      setEditForm(prev => ({ ...prev, priority }))
      toast.success(`Priority updated to ${priority}`)
      
      // Refresh data
      loadRequirement()
    } catch (error) {
      console.error("Error updating priority:", error)
      toast.error("Failed to update priority")
    } finally {
      setIsSaving(false)
    }
  }

  // Handle mark as done (both status and completion)
  const handleMarkAsDone = async () => {
    if (!requirement) return
    
    try {
      setIsSaving(true)
      
      // Update both status and completion status
      await handleUpdateStatus(REQUIREMENT_STATUS.DONE)
      await handleUpdateCompletionStatus(COMPLETION_STATUS.COMPLETED)
      
      toast.success("Requirement marked as done")
    } catch (error) {
      console.error("Error marking as done:", error)
      toast.error("Failed to mark as done")
    } finally {
      setIsSaving(false)
    }
  }

  // Handle reject (both status and completion)
  const handleReject = async () => {
    if (!requirement) return
    
    try {
      setIsSaving(true)
      
      // Update both status and completion status
      await handleUpdateStatus(REQUIREMENT_STATUS.CANCELED)
      await handleUpdateCompletionStatus(COMPLETION_STATUS.REJECTED)
      
      toast.success("Requirement rejected")
    } catch (error) {
      console.error("Error rejecting requirement:", error)
      toast.error("Failed to reject requirement")
    } finally {
      setIsSaving(false)
    }
  }

  // Helper functions for styling
  const getPriorityColor = (priority: "high" | "medium" | "low") => {
    const priorityColors = {
      high: "bg-red-100/20 text-red-600 dark:text-red-400 hover:bg-red-100/30 border-red-300/30",
      medium: "bg-yellow-100/20 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100/30 border-yellow-300/30",
      low: "bg-blue-100/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100/30 border-blue-300/30"
    }
    return priorityColors[priority]
  }

  const getStatusColor = (status: RequirementStatusType) => {
    const statusColors = {
      [REQUIREMENT_STATUS.VALIDATED]: "bg-green-100/20 text-green-600 dark:text-green-400 hover:bg-green-100/30 border-green-300/30",
      [REQUIREMENT_STATUS.IN_PROGRESS]: "bg-purple-100/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100/30 border-purple-300/30",
      [REQUIREMENT_STATUS.ON_REVIEW]: "bg-blue-100/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100/30 border-blue-300/30",
      [REQUIREMENT_STATUS.DONE]: "bg-green-100/20 text-green-600 dark:text-green-400 hover:bg-green-100/30 border-green-300/30",
      [REQUIREMENT_STATUS.BACKLOG]: "bg-gray-100/20 text-gray-600 dark:text-gray-400 hover:bg-gray-100/30 border-gray-300/30",
      [REQUIREMENT_STATUS.CANCELED]: "bg-red-100/20 text-red-600 dark:text-red-400 hover:bg-red-100/30 border-red-300/30"
    }
    return statusColors[status]
  }

  const getCompletionStatusColor = (status: CompletionStatusType) => {
    const completionStatusColors = {
      [COMPLETION_STATUS.COMPLETED]: "bg-green-100/20 text-green-600 dark:text-green-400 border-green-300/30",
      [COMPLETION_STATUS.REJECTED]: "bg-red-100/20 text-red-600 dark:text-red-400 border-red-300/30",
      [COMPLETION_STATUS.PENDING]: "bg-yellow-100/20 text-yellow-600 dark:text-yellow-400 border-yellow-300/30"
    }
    return completionStatusColors[status]
  }

  const getStatusLabel = (status: RequirementStatusType) => {
    return status === REQUIREMENT_STATUS.IN_PROGRESS 
      ? "In Progress" 
      : status === REQUIREMENT_STATUS.ON_REVIEW
        ? "On Review"
        : status === REQUIREMENT_STATUS.DONE
          ? "Done"
          : status === REQUIREMENT_STATUS.CANCELED
            ? "Canceled"
            : status === REQUIREMENT_STATUS.VALIDATED
              ? "Validated"
              : "Backlog"
  }

  const getCompletionStatusLabel = (status: CompletionStatusType) => {
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  // Add save instructions function
  const handleSaveChanges = async (): Promise<boolean> => {
    if (!requirement) return false
    
    setIsSaving(true)
    try {
      // Convert HTML instructions back to markdown for storage (we'll use the outsourceInstructions if we're on the outsource tab)
      // Since outsourceInstructions is just plain text, we don't need to convert it, but we should make sure we're saving the right one
      const markdownInstructions = editForm.outsourceInstructions || htmlToMarkdown(editForm.instructions);
      
      // Update the requirement with instructions first
      const instructionsResult = await updateRequirementInstructions(requirement.id, markdownInstructions)
      
      if (instructionsResult.error) {
        throw new Error(instructionsResult.error)
      }
      
      // Update the requirement with other fields
      const updatedMetadata = {
        ...(requirement.metadata || {}),
        workflow_nodes: nodes,
        workflow_connections: connections
      };

      const { error } = await updateRequirement({
        id: requirement.id,
        title: editForm.title,
        description: editForm.description,
        type: editForm.type,
        priority: editForm.priority,
        status: editForm.status,
        completionStatus: editForm.completionStatus,
        source: editForm.source,
        budget: editForm.budget,
        segments: editForm.segments,
        campaigns: editForm.campaigns,
        campaign_id: editForm.campaign_id,
        outsourceInstructions: markdownInstructions,
        metadata: updatedMetadata
      })
      
      if (error) {
        throw new Error(error)
      }

      // Process segment changes if any
      if (pendingSegmentChanges) {
        console.log("Processing segment changes:", pendingSegmentChanges);
        const supabase = createClient();
        
        // 1. Remove segments that were deleted
        if (pendingSegmentChanges.removedSegmentIds.length > 0) {
          console.log("Removing segments:", pendingSegmentChanges.removedSegmentIds);
          
          const { error: removeError } = await supabase
            .from('requirement_segments')
            .delete()
            .eq('requirement_id', requirement.id)
            .in('segment_id', pendingSegmentChanges.removedSegmentIds);
            
          if (removeError) {
            console.error("Error removing segments:", removeError);
          }
        }
        
        // 2. Add new segments
        const existingSegmentIds = editForm.segments;
        const newSegments = pendingSegmentChanges.pendingSegments
          .filter(s => !existingSegmentIds.includes(s.id) && 
                       !pendingSegmentChanges.removedSegmentIds.includes(s.id))
          .map(s => s.id);
        
        if (newSegments.length > 0) {
          console.log("Adding new segments:", newSegments);
          
          const { error: addError } = await supabase
            .from('requirement_segments')
            .insert(
              newSegments.map(segmentId => ({
                requirement_id: requirement.id,
                segment_id: segmentId
              }))
            );
            
          if (addError) {
            console.error("Error adding segments:", addError);
          }
        }
        
        // Reset segment changes
        setPendingSegmentChanges(null);
      }
      
      setIsEditing(false)
      toast.success("Requirement updated successfully")
      
      // Dispatch event to notify the requirement was saved successfully
      window.dispatchEvent(new CustomEvent('requirement:saved'));
      
      // Refresh requirement data
      loadRequirement()
      return true
    } catch (error) {
      console.error("Error updating requirement:", error)
      toast.error("Failed to update requirement")
      return false
    } finally {
      setIsSaving(false)
    }
  }

  // Add handleDeleteRequirement function
  const handleDeleteRequirement = async () => {
    try {
      const result = await deleteRequirement(requirement!.id)
      
      if (result.error) {
        throw new Error(result.error)
      }
      
      toast.success("Requirement deleted successfully")
      router.push('/requirements') // Redirect to requirements list page
    } catch (error) {
      console.error("Error deleting requirement:", error)
      toast.error(error instanceof Error ? error.message : "Failed to delete requirement")
    }
  }

  const handleBuildRequirement = async () => {
    if (unsavedChanges) {
      const saved = await handleSaveChanges();
      if (!saved) return;
    }

    if (params.id && typeof params.id === 'string') {
      setIsBuilding(true);
      const currentDate = new Date().toISOString();
      const result = await updateRequirementStatus(params.id, "in-progress", currentDate);
      setIsBuilding(false);
      if (!result.error) {
        toast.success("Build started successfully");
        router.push('/requirements');
      } else {
        toast.error("Failed to start build");
      }
    }
  };

  // Sync state with TopBarActions
  useEffect(() => {
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('requirement:update', {
        detail: {
          id: params.id,
          isBuilding,
          hasRequirementStatus
        }
      }));
    }, 0);
  }, [params.id, isBuilding, hasRequirementStatus]);

  // Listen for build trigger from TopBarActions
  useEffect(() => {
    const handleBuildTrigger = () => {
      handleBuildRequirement();
    };
    
    window.addEventListener('requirement:build-trigger', handleBuildTrigger);
    
    return () => {
      window.removeEventListener('requirement:build-trigger', handleBuildTrigger);
    };
  }, [unsavedChanges, params.id, handleSaveChanges, updateRequirementStatus]);

  // Add these segment handler functions
  const handleSegmentSelect = (value: string) => {
    if (!value) return;
    
    // Check if segment is already added
    const isAlreadyAdded = editForm.segments.includes(value);
    if (isAlreadyAdded) {
      toast.error("Segment already added to this requirement");
      setSelectedSegmentId("");
      return;
    }
    
    // Find the segment name
    const segment = segments.find(seg => seg.id === value);
    if (!segment) {
      toast.error("Selected segment not found");
      setSelectedSegmentId("");
      return;
    }
    
    // Update the pending segments
    const pendingSegments = [
      ...editForm.segments.map(id => {
        const seg = segments.find(s => s.id === id);
        return { id, name: seg?.name || "Unknown" };
      }),
      { id: segment.id, name: segment.name }
    ];
    
    const segmentNames = pendingSegments.map(s => s.name);
    const segmentIds = pendingSegments.map(s => s.id);
    
    // Update the edit form
    setEditForm(prev => ({
      ...prev,
      segments: segmentIds,
      segmentNames: segmentNames
    }));
    
    // If this segment was previously removed, remove it from removedSegmentIds
    if (pendingSegmentChanges?.removedSegmentIds.includes(value)) {
      setPendingSegmentChanges(prev => ({
        ...prev!,
        removedSegmentIds: prev!.removedSegmentIds.filter(id => id !== value)
      }));
    }
    
    // Create event for segment changes
    const event = new CustomEvent('requirement:segment-changes', {
      detail: {
        pendingSegments,
        removedSegmentIds: pendingSegmentChanges?.removedSegmentIds || [],
        requirementId: requirement?.id
      }
    });
    window.dispatchEvent(event);
    
    // Reset selected segment
    setSelectedSegmentId("");
  };
  
  const handleRemoveSegment = (segmentId: string) => {
    // Check if the segment was originally from the requirement
    const isOriginalSegment = requirement?.segments.includes(segmentId);
    
    // Create a copy of current pending segment changes or initialize new one
    const currentChanges = pendingSegmentChanges || {
      pendingSegments: editForm.segments.map(id => {
        const seg = segments.find(s => s.id === id);
        return { id, name: seg?.name || "Unknown" };
      }),
      removedSegmentIds: []
    };
    
    // If it was original, add to removedSegmentIds
    if (isOriginalSegment) {
      currentChanges.removedSegmentIds = [...currentChanges.removedSegmentIds, segmentId];
    }
    
    // Remove from pendingSegments in editForm
    const updatedSegments = editForm.segments.filter(id => id !== segmentId);
    const updatedSegmentNames = editForm.segmentNames.filter((_, i) => editForm.segments[i] !== segmentId);
    
    setEditForm(prev => ({
      ...prev,
      segments: updatedSegments,
      segmentNames: updatedSegmentNames
    }));
    
    // Update pendingSegmentChanges
    setPendingSegmentChanges({
      pendingSegments: currentChanges.pendingSegments.filter(s => s.id !== segmentId),
      removedSegmentIds: currentChanges.removedSegmentIds
    });
    
    // Create event for segment changes
    const event = new CustomEvent('requirement:segment-changes', {
      detail: {
        pendingSegments: currentChanges.pendingSegments.filter(s => s.id !== segmentId),
        removedSegmentIds: currentChanges.removedSegmentIds,
        requirementId: requirement?.id
      }
    });
    window.dispatchEvent(event);
    
    setUnsavedChanges(true);
  };

  // Add event listeners for resizing
  useEffect(() => {
    if (!isResizing) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      // Limit the height to prevent it from taking the entire screen or disappearing
      // The header is ~64px and the toolbar is ~71px, total ~135px
      const minHeight = 150; // Minimum editor height
      const maxHeight = window.innerHeight - 135 - 150; // Keep at least 150px for the workflow builder
      
      const newHeight = Math.max(minHeight, Math.min(maxHeight, e.clientY - 135));
      setEditorHeight(newHeight);
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = ''; // Reset cursor
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Add a class to body to prevent text selection while resizing
    document.body.style.cursor = 'row-resize';
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
    };
  }, [isResizing]);

  // Handle adding requirement secret
  const handleAddRequirementSecret = async (id: string, name: string) => {
    try {
      const supabase = createClient();
      
      // Update local state first for responsiveness
      const updatedMetadata = {
        ...(requirement?.metadata || {}),
        secret_id: id,
        secret_name: name
      };
      
      // Also update database
      if (requirement) {
        const { error } = await supabase
          .from('requirements')
          .update({ metadata: updatedMetadata })
          .eq('id', requirement.id);
          
        if (error) throw error;
      }
      
      setRequirement(prev => prev ? {
        ...prev,
        metadata: updatedMetadata
      } : null);
      
      toast.success(`Secret ${name} linked to requirement`);
      
      // Auto-add secret node to workflow if it doesn't exist
      // First, find if we already have a secret node
      const existingSecretNodeIndex = nodes.findIndex(n => n.type === 'secret');
      
      if (existingSecretNodeIndex >= 0) {
        // Update existing secret node
        setNodes(currentNodes => currentNodes.map((n, idx) => 
          idx === existingSecretNodeIndex 
            ? { ...n, data: { ...n.data, secret_id: id, secret_name: name } }
            : n
        ));
      } else {
        // Find trigger node to position relative to it
        const triggerNode = nodes.find(n => n.type === 'trigger');
        
        const secretNodeId = `node-secret-${Date.now()}`;
        const newSecretNode = {
          id: secretNodeId,
          type: 'secret',
          position: { 
            // Place it to the left of the trigger node, or default position
            x: triggerNode ? Math.max(0, triggerNode.position.x - 350) : 50, 
            y: triggerNode ? triggerNode.position.y : 50 
          },
          data: { 
            secret_id: id, 
            secret_name: name 
          }
        };
        
        setNodes([...nodes, newSecretNode]);
        
        // Connect secret to trigger if trigger exists
        if (triggerNode) {
          setConnections([...connections, {
            id: `conn-secret-${Date.now()}`,
            from: secretNodeId,
            to: triggerNode.id,
            sourceHandle: 'success'
          }]);
        }
      }
      
      setUnsavedChanges(true);
      
    } catch (error: any) {
      console.error("Error linking secret to requirement:", error);
      toast.error(error.message || "Failed to link secret");
    }
  };

  // Handlers for workflow builder
  const handleAddNode = (type: string) => {
    // Determine position based on the last node, or use default if it's the first node
    let newX = 50;
    let newY = 150;
    
    let sourceHandleToConnect = 'success';
    let nodeToConnectFrom: any = null;

    if (nodes.length > 0) {
      if (type === 'trigger') {
        // Find last available secret node
        nodeToConnectFrom = [...nodes].reverse().find(n => n.type === 'secret' && !connections.some(c => c.from === n.id && c.sourceHandle === 'success'));
        
        if (nodeToConnectFrom) {
          const maxX = Math.max(...nodes.map(n => n.position.x));
          newX = maxX + 350;
          newY = nodeToConnectFrom.position.y;
          sourceHandleToConnect = 'success';
        } else {
          // Place new triggers below existing nodes, aligned to the left
          const maxY = Math.max(...nodes.map(n => n.position.y));
          newX = 50;
          newY = maxY + 200;
        }
      } else {
        // Place action or condition to the last available positive node
        nodeToConnectFrom = [...nodes].reverse().find(n => {
           // check which handle this node provides
           const positiveHandle = n.type === 'condition' ? 'true' : 'success';
           // check if it's connected
           const isConnected = connections.some(c => c.from === n.id && c.sourceHandle === positiveHandle);
           return !isConnected;
        });
        
        if (nodeToConnectFrom) {
          const maxX = Math.max(...nodes.map(n => n.position.x));
          newX = maxX + 350;
          newY = nodeToConnectFrom.position.y;
          sourceHandleToConnect = nodeToConnectFrom.type === 'condition' ? 'true' : 'success';
        } else {
          // Fallback
          const lastNode = nodes[nodes.length - 1];
          newX = lastNode.position.x + 350;
          newY = lastNode.position.y;
        }
      }
    }

    const newNode = {
      id: `node-${Date.now()}`,
      type,
      position: { x: newX, y: newY },
      data: { 
        label: `New ${type} node`,
        ...(type === 'trigger' ? { triggerType: 'schedule', cron: 'Run once' } : {}),
        ...(type === 'action' ? { retries: 0 } : {}),
        ...(type === 'condition' ? { logicalOperator: 'AND' } : {})
      }
    };
    setNodes([...nodes, newNode]);
    
    // Auto-connect to identified node
    if (nodeToConnectFrom) {
      setConnections([...connections, { 
        id: `conn-${Date.now()}`, 
        from: nodeToConnectFrom.id, 
        to: newNode.id,
        sourceHandle: sourceHandleToConnect
      }]);
    } else if (nodes.length > 0 && type !== 'trigger') {
      // Fallback: connect to the last node
      const lastNode = nodes[nodes.length - 1];
      setConnections([...connections, { 
        id: `conn-${Date.now()}`, 
        from: lastNode.id, 
        to: newNode.id,
        sourceHandle: lastNode.type === 'condition' ? 'true' : 'success'
      }]);
    }
    
    setUnsavedChanges(true);
  };

  // Function to render the details content that can be reused in both tabs or no-tabs mode
  const renderDetailsContent = () => {
    return (
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-5 space-y-6">
            {/* Requirement Information */}
            <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
              <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                Requirement Information
              </h3>
              
              <div className="space-y-5">
                <div className="space-y-2.5">
                  <Label className="flex items-center gap-2">
                    <Type className="h-4 w-4 text-muted-foreground" />
                    Title
                  </Label>
                  <Input
                    value={editForm.title}
                    onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                    className="h-11"
                    placeholder="Requirement title"
                  />
                </div>
                
                <div className="space-y-2.5">
                  <Label className="flex items-center gap-2">
                    <TextIcon className="h-4 w-4 text-muted-foreground" />
                    Description
                  </Label>
                  <Textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                    className="min-h-[100px] resize-none"
                    placeholder="Enter a brief description"
                  />
                </div>
                
                <div className="space-y-2.5">
                  <Label className="flex items-center gap-2">
                    <BarChart className="h-4 w-4 text-muted-foreground" />
                    Budget
                  </Label>
                  {(requirement?.metadata?.payment_status?.outsourced && requirement?.metadata?.payment_status?.status === 'paid') || 
                   requirement?.campaignOutsourced ? (
                    <div className="h-11 flex items-center px-3 border border-border rounded-md bg-green-50 dark:bg-green-900/20">
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">
                        Paid - Campaign Outsourced
                      </span>
                    </div>
                  ) : (
                    <Input
                      type="number"
                      value={editForm.budget || ''}
                      onChange={(e) => setEditForm({...editForm, budget: e.target.value ? parseFloat(e.target.value) : null})}
                      className="h-11"
                      placeholder="Enter budget amount"
                    />
                  )}
                </div>
                
                <div className="space-y-2.5">
                  <Label className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    Type
                  </Label>
                  <Select
                    value={editForm.type}
                    onValueChange={(value: "content" | "design" | "research" | "follow_up" | "task" | "develop" | "analytics" | "testing" | "approval" | "coordination" | "strategy" | "optimization" | "automation" | "integration" | "planning" | "payment") => {
                      setEditForm({...editForm, type: value})
                    }}
                  >
                    <SelectTrigger className="h-11 w-full">
                      <SelectValue placeholder="Select type">
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4" />
                          {editForm.type === 'follow_up' ? 'Follow Up' : editForm.type.charAt(0).toUpperCase() + editForm.type.slice(1)}
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="content">Content</SelectItem>
                      <SelectItem value="design">Design</SelectItem>
                      <SelectItem value="research">Research</SelectItem>
                      <SelectItem value="follow_up">Follow Up</SelectItem>
                      <SelectItem value="task">Task</SelectItem>
                      <SelectItem value="develop">Develop</SelectItem>
                      <SelectItem value="analytics">Analytics</SelectItem>
                      <SelectItem value="testing">Testing</SelectItem>
                      <SelectItem value="approval">Approval</SelectItem>
                      <SelectItem value="coordination">Coordination</SelectItem>
                      <SelectItem value="strategy">Strategy</SelectItem>
                      <SelectItem value="optimization">Optimization</SelectItem>
                      <SelectItem value="automation">Automation</SelectItem>
                      <SelectItem value="integration">Integration</SelectItem>
                      <SelectItem value="planning">Planning</SelectItem>
                      <SelectItem value="payment">Payment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2.5">
                  <Label className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    Status
                  </Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(value: RequirementStatusType) => {
                      handleUpdateStatus(value)
                    }}
                    disabled={isSaving}
                  >
                    <SelectTrigger className={`h-11 w-full ${getStatusColor(editForm.status)}`}>
                      <SelectValue placeholder="Select status">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          {getStatusLabel(editForm.status)}
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={REQUIREMENT_STATUS.BACKLOG}>Backlog</SelectItem>
                      <SelectItem value={REQUIREMENT_STATUS.IN_PROGRESS}>In Progress</SelectItem>
                      <SelectItem value={REQUIREMENT_STATUS.ON_REVIEW}>On Review</SelectItem>
                      <SelectItem value={REQUIREMENT_STATUS.DONE}>Done</SelectItem>
                      <SelectItem value={REQUIREMENT_STATUS.VALIDATED}>Validated</SelectItem>
                      <SelectItem value={REQUIREMENT_STATUS.CANCELED}>Canceled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2.5">
                  <Label className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    Completion Status
                  </Label>
                  <Select
                    value={editForm.completionStatus}
                    onValueChange={(value: CompletionStatusType) => {
                      handleUpdateCompletionStatus(value)
                    }}
                    disabled={isSaving}
                  >
                    <SelectTrigger className={`h-11 w-full ${getCompletionStatusColor(editForm.completionStatus)}`}>
                      <SelectValue placeholder="Select completion status">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4" />
                          {getCompletionStatusLabel(editForm.completionStatus)}
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={COMPLETION_STATUS.PENDING}>Pending</SelectItem>
                      <SelectItem value={COMPLETION_STATUS.COMPLETED}>Completed</SelectItem>
                      <SelectItem value={COMPLETION_STATUS.REJECTED}>Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2.5">
                  <Label className="flex items-center gap-2">
                    <BarChart className="h-4 w-4 text-muted-foreground" />
                    Priority
                  </Label>
                  <Select
                    value={editForm.priority}
                    onValueChange={(value: "high" | "medium" | "low") => {
                      handleUpdatePriority(value)
                    }}
                    disabled={isSaving}
                  >
                    <SelectTrigger className={`h-11 w-full ${getPriorityColor(editForm.priority)}`}>
                      <SelectValue placeholder="Select priority">
                        <div className="flex items-center gap-2">
                          <BarChart className="h-4 w-4" />
                          {editForm.priority.charAt(0).toUpperCase() + editForm.priority.slice(1)}
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High Priority</SelectItem>
                      <SelectItem value="medium">Medium Priority</SelectItem>
                      <SelectItem value="low">Low Priority</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            
            {/* Segments and Campaigns */}
            <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
              <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider flex justify-between items-center">
                <span>Segments & Campaigns</span>
                {pendingSegmentChanges && (
                  <span className="text-xs text-muted-foreground font-normal">Unsaved changes *</span>
                )}
              </h3>
              
              <div className="space-y-5">
                  <div className="space-y-2.5">
                    <Label className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      Segments
                    </Label>
                  <div className="flex flex-wrap gap-2">
                    {editForm.segmentNames?.length > 0 ? (
                      editForm.segmentNames.map((segment, i) => (
                        <Badge
                          key={i}
                          variant="secondary"
                          className="px-3 py-1 text-xs font-medium bg-gray-100/20 text-gray-700 dark:text-gray-300 hover:bg-gray-200/20 transition-colors border border-gray-300/30 group relative hover:pr-7 max-w-full"
                        >
                          <span className="truncate block max-w-[150px]">{segment}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute right-1 opacity-0 group-hover:opacity-100 h-4 w-4 p-0 hover:bg-transparent hover:text-destructive transition-opacity"
                            onClick={() => handleRemoveSegment(editForm.segments[i])}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-sm">No segments assigned</span>
                    )}
                  </div>

                  {/* Add segment section */}
                  <div className="pt-2 border-t border-border/30 mt-4">
                    <p className="text-xs text-muted-foreground mb-2">Add segment to requirement</p>
                    
                    {!showSegmentDropdown ? (
                      // Only show Add Segment button if there are segments available to add
                      segments.filter(segment => !editForm.segments.includes(segment.id)).length > 0 ? (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full flex items-center justify-center"
                          onClick={() => setShowSegmentDropdown(true)}
                        >
                          <Plus className="h-4 w-4 mr-2" /> Add Segment
                        </Button>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No more segments available to add</p>
                      )
                    ) : (
                      <div className="space-y-2">
                        {segments.filter(segment => !editForm.segments.includes(segment.id)).length > 0 ? (
                          <>
                            <Select 
                              value={selectedSegmentId} 
                              onValueChange={(value) => {
                                handleSegmentSelect(value);
                                // Keep the dropdown open after selection
                              }}
                            >
                              <SelectTrigger className="w-full max-w-full">
                                <SelectValue placeholder="Select segment">
                                  <span className="truncate block max-w-[180px]">
                                    {selectedSegmentId ? segments.find(s => s.id === selectedSegmentId)?.name || "Selected segment" : "Select segment"}
                                  </span>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {segments
                                  .filter(segment => !editForm.segments.includes(segment.id))
                                  .map(segment => (
                                    <SelectItem key={segment.id} value={segment.id}>
                                      <span className="truncate block w-full overflow-hidden">
                                        {segment.name}
                                      </span>
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                            
                            {/* Only show Done button if there are segments available */}
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="w-full flex items-center justify-center"
                              onClick={() => setShowSegmentDropdown(false)}
                            >
                              Done
                            </Button>
                          </>
                        ) : (
                          <>
                            <p className="text-xs text-muted-foreground italic">No more segments available to add</p>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="w-full flex items-center justify-center"
                              onClick={() => setShowSegmentDropdown(false)}
                            >
                              Close
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2.5">
                  <Label className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    Campaigns
                  </Label>
                  <Select
                    value={editForm.campaign_id || "none"}
                    onValueChange={(value) => {
                      if (value !== "none") {
                        const selectedCampaign = campaigns.find(c => c.id === value);
                        if (selectedCampaign) {
                          // Load the selected campaign segments
                          const loadCampaignSegments = async () => {
                            try {
                              const supabase = createClient();
                              
                              // Get campaign segments
                              const { data: campaignSegments, error } = await supabase
                                .from("campaign_segments")
                                .select("segment_id")
                                .eq("campaign_id", value);
                                
                              if (error) {
                                console.error("Error loading campaign segments:", error);
                                return;
                              }
                              
                              // Extract segment IDs
                              const segmentIds = campaignSegments.map((cs: { segment_id: string }) => cs.segment_id);
                              
                              // Get segment names
                              const segmentNames = segmentIds.map((id: string) => {
                                const segment = segments.find(s => s.id === id);
                                return segment ? segment.name : "Unknown";
                              });
                              
                              // Update the form with the new campaign and its segments
                              setEditForm(prev => ({ 
                                ...prev, 
                                campaign_id: value,
                                campaigns: [value], // Set campaigns as array with only the selected ID
                                campaignNames: [selectedCampaign.title],
                                segments: segmentIds,
                                segmentNames: segmentNames
                              }));
                              
                              toast.success(`Campaign "${selectedCampaign.title}" assigned. Segments updated to match campaign.`);
                            } catch (err) {
                              console.error("Error in loadCampaignSegments:", err);
                              toast.error("Failed to load campaign segments");
                            }
                          };
                          
                          loadCampaignSegments();
                        }
                      } else {
                        // If "none" is selected, clear campaign data
                        setEditForm(prev => ({ 
                          ...prev, 
                          campaign_id: "",
                          campaigns: [],
                          campaignNames: [],
                          // Also clear segments
                          segments: [],
                          segmentNames: []
                        }));
                        
                        toast.info("Campaign unassigned");
                      }
                    }}
                  >
                    <SelectTrigger className={`h-11 ${editForm.campaign_id ? 'bg-blue-100/20 text-blue-700 dark:text-blue-300 border-blue-300/30' : ''}`}>
                      <SelectValue placeholder="Select a campaign">
                        <span className="truncate block max-w-[180px]">
                          {editForm.campaign_id ? campaigns.find(c => c.id === editForm.campaign_id)?.title || "Selected campaign" : "Select a campaign"}
                        </span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No campaign</SelectItem>
                      {campaigns.map(campaign => (
                        <SelectItem key={campaign.id} value={campaign.id}>
                          <span className="truncate block w-full overflow-hidden">
                            {campaign.title}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            
            {/* Dates */}
            <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
              <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                Dates
              </h3>
              
              <div className="space-y-5">
                <div className="space-y-2.5">
                  <Label className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    Created
                  </Label>
                  <div className="text-sm font-medium">
                    {requirement?.createdAt ? new Date(requirement.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    }) : "Unknown"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  };

  // Show loading skeleton while data is being fetched
  if (isLoading) {
    return <RequirementSkeleton />
  }

  // Show error state
  if (error) {
    return (
      <div className="flex h-[calc(100dvh-64px)] items-center justify-center flex-col gap-4">
        <div className="text-destructive">
          <X className="h-16 w-16 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-center">Error Loading Requirement</h2>
          <p className="text-muted-foreground text-center mt-2">{error}</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => router.push("/requirements")}
          className="mt-4"
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back to Requirements
        </Button>
      </div>
    )
  }

  // Show error if no requirement data
  if (!requirement) {
    return (
      <div className="flex h-[calc(100dvh-64px)] items-center justify-center flex-col gap-4">
        <div className="text-destructive">
          <X className="h-16 w-16 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-center">Requirement Not Found</h2>
          <p className="text-muted-foreground text-center mt-2">
            The requirement you are looking for could not be found.
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => router.push("/requirements")}
          className="mt-4"
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back to Requirements
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100dvh-64px)]">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <div className="flex-none z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <MenuBar 
            editor={editor} 
            onSave={handleSaveChanges} 
            isSaving={isSaving} 
            onDelete={handleDeleteRequirement}
            hasUnsavedChanges={unsavedChanges}
            hasRequirementStatus={hasRequirementStatus}
            handleAddNode={handleAddNode}
            showRightPanel={showRightPanel}
            setShowRightPanel={setShowRightPanel}
            canUndoWorkflow={workflowHistory.past.length > 1}
            canRedoWorkflow={workflowHistory.future.length > 0}
          onUndoWorkflow={handleUndoWorkflow}
          onRedoWorkflow={handleRedoWorkflow}
          onAddSecret={handleAddRequirementSecret}
        />
        </div>
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <div 
            className="p-0 flex flex-col mx-auto w-full overflow-y-auto" 
            style={{ flexBasis: `${editorHeight}px`, flexShrink: 0 }}
          >
            <div className="max-w-4xl mx-auto w-full h-full">
            <EditorContent 
              editor={editor} 
                className={`prose prose-sm dark:prose-invert max-w-none flex-1 [&>.tiptap]:outline-none [&>.tiptap]:px-4 [&>.tiptap]:lg:px-8 [&>.tiptap]:py-8 [&>.tiptap]:min-h-full`} 
            />
          </div>
        </div>
          <div className="w-full flex flex-col flex-1 border-t relative overflow-hidden">
            <div 
              className="absolute top-0 left-0 right-0 h-2 -mt-1 z-20 cursor-row-resize hover:bg-primary/20 transition-colors flex items-center justify-center group"
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent text selection
                setIsResizing(true);
              }}
            >
              <div className="w-12 h-1 rounded-full bg-border group-hover:bg-primary/50 transition-colors"></div>
      </div>
            <div className="flex-1 overflow-hidden relative">
              <ZoomableCanvas 
                className="w-full h-full" 
                recenterDependency={showRightPanel}
                dotColorLight="rgba(0, 0, 0, 0.15)"
                dotColorDark="rgba(255, 255, 255, 0.15)"
                dotSize="20px"
                dotRadius="1.5px"
              >
                <div className="w-full h-full relative min-h-[1000px] min-w-[1000px]">
                  {isConnecting && currentMousePos && (
                    <div className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" style={{ zIndex: 10 }}>
                      <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                        <path 
                          d={`M ${isConnecting.startX} ${isConnecting.startY} C ${isConnecting.startX + Math.max(50, Math.abs(currentMousePos.x - isConnecting.startX) / 2)} ${isConnecting.startY}, ${currentMousePos.x - Math.max(50, Math.abs(currentMousePos.x - isConnecting.startX) / 2)} ${currentMousePos.y}, ${currentMousePos.x} ${currentMousePos.y}`}
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2"
                          strokeDasharray="4 4"
                          className="text-primary/60"
                        />
                      </svg>
            </div>
                  )}

                  {connections.map(conn => {
                    const fromNode = nodes.find(n => n.id === conn.from);
                    const toNode = nodes.find(n => n.id === conn.to);
                    
                    if (!fromNode || !toNode) return null;
                    
                    // Determine starting Y based on sourceHandle
                    let startYOffset = 46; // default top-[40px]
                    if (conn.sourceHandle === 'false' || conn.sourceHandle === 'fail' || conn.sourceHandle === 'fail_intent') {
                      startYOffset = 86; // top-[80px]
                    }
                    if (conn.sourceHandle === 'fail_all') {
                      startYOffset = 126; // top-[120px]
                    }
                    
                    // Fixed node width and dot offset
                    const startX = fromNode.position.x + 280; 
                    const startY = fromNode.position.y + startYOffset;
                    const endX = toNode.position.x;
                    const endY = toNode.position.y + 46;
                    
                    // Bezier curve
                    const controlPointX1 = startX + Math.max(50, Math.abs(endX - startX) / 2);
                    const controlPointX2 = endX - Math.max(50, Math.abs(endX - startX) / 2);
                    
                    const isSelected = selectedConnectionId === conn.id;
                    const isHovered = hoveredNodeId === conn.id;
                    const midX = startX + (endX - startX) / 2;
                    const midY = startY + (endY - startY) / 2;
                    
                    return (
                      <div 
                        key={conn.id} 
                        className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" 
                        style={{ zIndex: isSelected || isHovered ? 5 : 0 }}
                        onMouseEnter={() => setHoveredNodeId(conn.id)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                      >
                        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                          <path 
                            d={`M ${startX} ${startY} C ${controlPointX1} ${startY}, ${controlPointX2} ${endY}, ${endX} ${endY}`}
                            fill="none" 
                            stroke="transparent" 
                            strokeWidth="24"
                            className="cursor-pointer pointer-events-auto"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedConnectionId(conn.id);
                            }}
                            onMouseEnter={() => setHoveredNodeId(conn.id)}
                            onMouseLeave={() => setHoveredNodeId(null)}
                          />
                          <path 
                            d={`M ${startX} ${startY} C ${controlPointX1} ${startY}, ${controlPointX2} ${endY}, ${endX} ${endY}`}
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth={isSelected || isHovered ? "3" : "2"}
                            className={cn(
                              "pointer-events-none transition-all duration-200",
                              (isSelected || isHovered) ? "text-primary" : "text-muted-foreground/30"
                            )}
                          />
                          <polygon 
                            points={`${endX-6},${endY-4} ${endX},${endY} ${endX-6},${endY+4}`} 
                            fill="currentColor"
                            className={cn(
                              "pointer-events-none transition-all duration-200",
                              (isSelected || isHovered) ? "text-primary" : "text-muted-foreground/30"
                            )}
                          />
                        </svg>
                        
                        <div 
                          className={cn(
                            "absolute pointer-events-auto transition-opacity duration-200",
                            (isSelected || isHovered) ? "opacity-100" : "opacity-0"
                          )}
                          style={{ 
                            left: midX, 
                            top: midY,
                            transform: 'translate(-50%, -50%)'
                          }}
                          onMouseEnter={() => setHoveredNodeId(conn.id)}
                          onMouseLeave={() => setHoveredNodeId(null)}
                        >
                          <Button
                            variant="destructive"
                            size="icon"
                            className="h-6 w-6 rounded-full shadow-md bg-destructive hover:bg-destructive/90 text-destructive-foreground z-20 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConnections(connections.filter(c => c.id !== conn.id));
                              setSelectedConnectionId(null);
                              setHoveredNodeId(null);
                              setUnsavedChanges(true);
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                          </div>
                      </div>
                    );
                  })}
                  
                  {nodes.map(node => {
                    const isSelected = selectedConnectionId === null && hoveredNodeId === node.id;
                    const isCurrentlyHovered = hoveredNodeId === node.id && !isConnecting;
                    return (
                    <div 
                      key={node.id}
                      className={cn(
                        "absolute rounded-3xl border-2 bg-card/95 backdrop-blur-sm cursor-grab active:cursor-grabbing w-[280px] flex flex-col overflow-visible transition-shadow duration-300 select-none shadow-[0_0_10px_rgba(0,0,0,0.05)] hover:shadow-[0_0_20px_rgba(0,0,0,0.15)]",
                        node.type === 'trigger' ? "border-primary/50" : "border-black/5 dark:border-white/10"
                      )}
                      style={{
                        left: node.position.x,
                        top: node.position.y
                      }}
                      onMouseEnter={() => {
                        if (!isConnecting) setHoveredNodeId(node.id);
                      }}
                      onMouseLeave={() => setHoveredNodeId(null)}
                      onMouseDown={(e) => {
                        e.stopPropagation(); // Stop propagation to canvas
                        setSelectedConnectionId(null);
                        
                        const canvasEl = e.currentTarget.closest('.min-w-\\[1000px\\]') as HTMLElement;
                        const scale = canvasEl ? canvasEl.getBoundingClientRect().width / canvasEl.offsetWidth : 1;
                        
                        const startX = e.clientX;
                        const startY = e.clientY;
                        const startPosX = node.position.x;
                        const startPosY = node.position.y;
                        
                        const handleMouseMove = (moveEvent: MouseEvent) => {
                          const dx = (moveEvent.clientX - startX) / scale;
                          const dy = (moveEvent.clientY - startY) / scale;
                          
                          setNodes(currentNodes => currentNodes.map(n => 
                            n.id === node.id 
                              ? { ...n, position: { x: startPosX + dx, y: startPosY + dy } }
                              : n
                          ));
                          setUnsavedChanges(true);
                        };
                        
                        const handleMouseUp = () => {
                          window.removeEventListener('mousemove', handleMouseMove);
                          window.removeEventListener('mouseup', handleMouseUp);
                                  window.removeEventListener('click', handleMouseUp as any, { capture: true });
                        };
                        
                        window.addEventListener('mousemove', handleMouseMove);
                        window.addEventListener('mouseup', handleMouseUp);
                                window.addEventListener('click', handleMouseUp as any, { capture: true, once: true });
                      }}
                    >
                      {/* Node Header */}
                      <div className={cn(
                        "px-3 py-2.5 border-b flex items-center justify-between rounded-t-xl gap-2 relative",
                        node.type === 'trigger' ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-border/40"
                      )}>
                        {/* Drag Handle Overlay */}
                        <div 
                          className={cn(
                            "absolute inset-x-0 -top-6 h-6 bg-transparent flex items-center justify-center opacity-0 transition-all duration-200 cursor-grab active:cursor-grabbing",
                            hoveredNodeId === node.id ? "opacity-100 -translate-y-1" : ""
                          )}
                        >
                          <div className="bg-background/90 px-3 py-1 rounded-t-lg border-x border-t border-border/50 shadow-sm backdrop-blur-sm flex items-center justify-center pointer-events-none">
                            <GripHorizontal className="h-4 w-4 text-muted-foreground/60" />
                          </div>
                        </div>
                              
                        <span className="absolute -top-[18px] left-1 text-[10px] font-bold text-muted-foreground/60 pointer-events-none uppercase tracking-widest z-10 select-none">{node.type}</span>
                        {node.type === 'trigger' ? (
                          <div className="flex items-center gap-2 flex-1 mt-1 z-10" onMouseDown={e => e.stopPropagation()}>
                            <Tabs 
                              value={node.data.triggerType || 'schedule'} 
                              onValueChange={(value) => {
                                setNodes(nodes.map(n => 
                                  n.id === node.id ? { ...n, data: { ...n.data, triggerType: value } } : n
                                ));
                                setUnsavedChanges(true);
                              }}
                              className="w-full"
                            >
                              <TabsList className="grid w-full grid-cols-3 h-8 p-1 bg-muted/50">
                                <TabsTrigger value="schedule" className="text-[10px] py-1 px-2 h-6" title="Schedule">
                                  <CalendarIcon className="h-3 w-3 mr-1.5 hidden sm:inline-block" />
                                  Time
                                </TabsTrigger>
                                <TabsTrigger value="webhook" className="text-[10px] py-1 px-2 h-6" title="Webhook">
                                  <Globe className="h-3 w-3 mr-1.5 hidden sm:inline-block" />
                                  Hook
                                </TabsTrigger>
                                <TabsTrigger value="db_event" className="text-[10px] py-1 px-2 h-6" title="Database Event">
                                  <Database className="h-3 w-3 mr-1.5 hidden sm:inline-block" />
                                  DB Event
                                </TabsTrigger>
                              </TabsList>
                            </Tabs>
                          </div>
                        ) : node.type === 'action' ? (
                          <div className="flex items-center gap-2 flex-1 mt-1 z-10" onMouseDown={e => e.stopPropagation()}>
                            <Tabs 
                              value={node.data.actionType || 'agent'} 
                              onValueChange={(value) => {
                                setNodes(nodes.map(n => 
                                  n.id === node.id ? { ...n, data: { ...n.data, actionType: value } } : n
                                ));
                                setUnsavedChanges(true);
                              }}
                              className="w-full"
                            >
                              <TabsList className="grid w-full grid-cols-3 h-8 p-1 bg-muted/50">
                                <TabsTrigger value="agent" className="text-[10px] py-1 px-2 h-6" title="Agent">
                                  <Bot className="h-3 w-3 mr-1.5 hidden sm:inline-block" />
                                  Agent
                                </TabsTrigger>
                                <TabsTrigger value="code" className="text-[10px] py-1 px-2 h-6" title="Code">
                                  <Code className="h-3 w-3 mr-1.5 hidden sm:inline-block" />
                                  Code
                                </TabsTrigger>
                                <TabsTrigger value="api" className="text-[10px] py-1 px-2 h-6" title="API">
                                  <Globe className="h-3 w-3 mr-1.5 hidden sm:inline-block" />
                                  API
                                </TabsTrigger>
                              </TabsList>
                            </Tabs>
                          </div>
                        ) : node.type === 'condition' ? (
                          <div className="flex items-center gap-2 flex-1 mt-1 z-10" onMouseDown={e => e.stopPropagation()}>
                            <Tabs 
                              value={node.data.logicalOperator || 'AND'} 
                              onValueChange={(value) => {
                                setNodes(nodes.map(n => 
                                  n.id === node.id ? { ...n, data: { ...n.data, logicalOperator: value } } : n
                                ));
                                setUnsavedChanges(true);
                              }}
                              className="w-full"
                            >
                              <TabsList className="grid w-full grid-cols-2 h-8 p-1 bg-muted/50">
                                <TabsTrigger value="AND" className="text-[10px] py-1 px-2 h-6" title="AND (All conditions met)">
                                  AND
                                </TabsTrigger>
                                <TabsTrigger value="OR" className="text-[10px] py-1 px-2 h-6" title="OR (Any condition met)">
                                  OR
                                </TabsTrigger>
                              </TabsList>
                            </Tabs>
                          </div>
                        ) : null}
                      </div>

                      {/* Node Body */}
                      <div className="p-4 flex-1" onMouseDown={e => e.stopPropagation()}>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={cn(
                            "h-5 w-5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-opacity absolute -right-6 -top-2 cursor-pointer z-10",
                            hoveredNodeId === node.id ? "opacity-100" : "opacity-0"
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            setNodes(nodes.filter(n => n.id !== node.id));
                            setConnections(connections.filter(c => c.from !== node.id && c.to !== node.id));
                            setUnsavedChanges(true);
                          }}
                          onMouseDown={(e) => {
                            // Prevenir que el click en el botón inicie el drag del nodo
                            e.stopPropagation();
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                        {node.type !== 'trigger' && (
                          <div className="relative">
                                <Textarea 
                              value={node.data.label || ''}
                              placeholder={`New ${node.type} description...`}
                              className={cn(
                                "min-h-[60px] resize-none text-sm font-medium border-transparent hover:border-border focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/30 p-1.5 -ml-1.5 transition-all bg-transparent w-[calc(100%+12px)] overflow-hidden",
                                node.type === 'trigger' ? "focus-visible:bg-background/50" : "focus-visible:bg-background",
                                "selection:bg-primary/20"
                              )}
                                  onChange={(e) => {
                                // Adjust height automatically
                                e.target.style.height = 'auto';
                                e.target.style.height = e.target.scrollHeight + 'px';
                                
                                setNodes(nodes.map(n => 
                                  n.id === node.id ? { ...n, data: { ...n.data, label: e.target.value } } : n
                                ));
                                    setUnsavedChanges(true);
                                  }}
                              onKeyDown={(e) => {
                                // Stop dragging when typing
                                e.stopPropagation();
                              }}
                              onMouseDown={(e) => {
                                // Focus on textarea without triggering node drag
                                e.stopPropagation();
                              }}
                            />
                              </div>
                        )}
                        
                        {node.type === 'secret' && (
                          <div className="relative flex flex-col gap-2" onMouseDown={e => e.stopPropagation()}>
                            <div className="text-xs text-muted-foreground">Secret Name</div>
                            <div className="font-mono text-sm font-medium">{node.data.secret_name || 'Unnamed Secret'}</div>
                            
                            <div className="text-[10px] text-muted-foreground mt-2">Secret ID</div>
                            <div className="text-xs font-mono text-muted-foreground truncate">{node.data.secret_id}</div>
                            
                            {!node.data.secret_id && (
                              <div className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                No secret linked. Delete and recreate.
                              </div>
                            )}
                          </div>
                        )}
                        
                        {node.type === 'trigger' && (
                          <div className="relative flex flex-col gap-2" onMouseDown={e => e.stopPropagation()}>
                            {(node.data.triggerType === 'schedule' || !node.data.triggerType) && (
                              <div>
                                <Select 
                                  value={node.data.cron || 'Run once'} 
                                  onValueChange={(value) => {
                                    setNodes(nodes.map(n => 
                                      n.id === node.id ? { ...n, data: { ...n.data, cron: value } } : n
                                    ));
                                    setUnsavedChanges(true);
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-xs bg-background/50 font-mono">
                                    <div className="flex items-center gap-1.5">
                                      <CalendarIcon className="h-3 w-3" />
                                      <SelectValue placeholder="Schedule..." />
                                </div>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Run once">Run once</SelectItem>
                                    <SelectItem value="Every minute">Every minute</SelectItem>
                                    <SelectItem value="Every 5 minutes">Every 5 minutes</SelectItem>
                                    <SelectItem value="Hourly">Hourly</SelectItem>
                                    <SelectItem value="Daily">Daily</SelectItem>
                                    <SelectItem value="Weekly">Weekly</SelectItem>
                                    <SelectItem value="Monthly">Monthly</SelectItem>
                                    <SelectItem value="Custom CRON">Custom CRON...</SelectItem>
                                  </SelectContent>
                                </Select>
                                
                                {node.data.cron === 'Custom CRON' && (
                                  <div className="mt-2">
                                    <Input 
                                      placeholder="* * * * *" 
                                      className="h-8 font-mono text-xs bg-background/50"
                                      value={node.data.customCron || ''}
                                      onChange={(e) => {
                                        setNodes(nodes.map(n => 
                                          n.id === node.id ? { ...n, data: { ...n.data, customCron: e.target.value } } : n
                                        ));
                                        setUnsavedChanges(true);
                                      }}
                                      onMouseDown={e => e.stopPropagation()}
                                      onKeyDown={e => e.stopPropagation()}
                                    />
                                    <p className="text-[9px] text-muted-foreground mt-1 ml-1">Format: min hour dom month dow</p>
                                </div>
                                )}
                              </div>
                            )}

                            {node.data.triggerType === 'webhook' && (
                              <div className="flex flex-col gap-1.5">
                                <Input 
                                  placeholder="/api/webhooks/..." 
                                  className="h-8 text-xs bg-background/50 font-mono"
                                  value={node.data.webhookPath || ''}
                                  onChange={(e) => {
                                    setNodes(nodes.map(n => 
                                      n.id === node.id ? { ...n, data: { ...n.data, webhookPath: e.target.value } } : n
                                    ));
                                    setUnsavedChanges(true);
                                  }}
                                  onMouseDown={e => e.stopPropagation()}
                                  onKeyDown={e => e.stopPropagation()}
                                />
                                <p className="text-[9px] text-muted-foreground ml-1">Webhook Endpoint Path</p>
                                </div>
                            )}

                            {node.data.triggerType === 'db_event' && (
                              <div className="flex flex-col gap-1.5">
                                <Select 
                                  value={node.data.dbTable || 'tasks'} 
                                  onValueChange={(value) => {
                                    setNodes(nodes.map(n => 
                                      n.id === node.id ? { ...n, data: { ...n.data, dbTable: value } } : n
                                    ));
                                    setUnsavedChanges(true);
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-xs bg-background/50 font-mono">
                                    <SelectValue placeholder="Table" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="tasks">tasks</SelectItem>
                                    <SelectItem value="messages">messages</SelectItem>
                                    <SelectItem value="leads">leads</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Select 
                                  value={node.data.dbEvent || 'insert'} 
                                  onValueChange={(value) => {
                                    setNodes(nodes.map(n => 
                                      n.id === node.id ? { ...n, data: { ...n.data, dbEvent: value } } : n
                                    ));
                                    setUnsavedChanges(true);
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-xs bg-background/50">
                                    <SelectValue placeholder="Event Type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="insert">INSERT</SelectItem>
                                    <SelectItem value="update">UPDATE</SelectItem>
                                    <SelectItem value="delete">DELETE</SelectItem>
                                    <SelectItem value="all">ALL EVENTS</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                            </div>
                        )}

                        {node.type === 'action' && (
                          <div className="mt-3 flex flex-col gap-2 px-1" onMouseDown={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground font-medium">Retries</span>
                              <Input 
                                type="number" 
                                min="0"
                                max="10"
                                className="h-7 w-16 text-xs bg-background/50 text-center focus-visible:ring-1 focus-visible:ring-primary/30"
                                value={node.data.retries ?? 0}
                                onChange={(e) => {
                                  setNodes(nodes.map(n => 
                                    n.id === node.id ? { ...n, data: { ...n.data, retries: parseInt(e.target.value) || 0 } } : n
                                  ));
                                  setUnsavedChanges(true);
                                }}
                                onMouseDown={e => e.stopPropagation()}
                                onKeyDown={e => e.stopPropagation()}
                              />
                            </div>
                            <div className="h-px bg-border/50 w-full my-1"></div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground font-medium">Secret</span>
                              <div className="flex gap-1 items-center">
                                {node.data.secret_id ? (
                                  <span className="text-[10px] text-primary truncate max-w-[80px]" title={node.data.secret_name || 'Secret attached'}>
                                    {node.data.secret_name || 'Attached'}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground italic">None</span>
                                )}
                                <AddSecretDialog 
                                  onSecretCreated={(id, name) => {
                                    setNodes(nodes.map(n => 
                                      n.id === node.id ? { ...n, data: { ...n.data, secret_id: id, secret_name: name } } : n
                                    ));
                                    setUnsavedChanges(true);
                                  }}
                                  trigger={
                                    <Button variant="outline" size="sm" className="h-7 text-xs px-2 whitespace-nowrap" title={node.data.secret_id ? "Change Secret" : "Add Secret"}>
                                      <Key className="h-3 w-3 mr-1" />
                                      {node.data.secret_id ? "Change" : "Add Secret"}
                                    </Button>
                                  }
                                />
                                {node.data.secret_id && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0" 
                                    title="Remove Secret"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setNodes(nodes.map(n => {
                                        if (n.id === node.id) {
                                          const newData = { ...n.data };
                                          delete newData.secret_id;
                                          delete newData.secret_name;
                                          return { ...n, data: newData };
                                        }
                                        return n;
                                      }));
                                      setUnsavedChanges(true);
                                    }}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                        </div>
                      )}
                </div>
                
                      {/* Connection dots */}
                      {node.type !== 'trigger' && (
                        <div 
                          className={cn(
                            "absolute top-[40px] -left-1.5 h-3 w-3 bg-background border-2 border-muted-foreground/40 rounded-full z-10 cursor-crosshair hover:bg-muted-foreground/20 transition-all duration-200",
                            (hoveredNodeId === node.id || (isConnecting && isConnecting.fromNodeId !== node.id)) ? "opacity-100 scale-125 border-primary/60 shadow-sm" : "opacity-0 scale-50"
                          )}
                          onMouseUp={(e) => {
                            e.stopPropagation();
                            if (isConnecting && isConnecting.fromNodeId !== node.id) {
                              setConnections([...connections, {
                                id: `conn-${Date.now()}`,
                                from: isConnecting.fromNodeId,
                                to: node.id,
                                sourceHandle: isConnecting.sourceHandle
                              }]);
                              setIsConnecting(null);
                              setCurrentMousePos(null);
                              setUnsavedChanges(true);
                            }
                          }}
                        ></div>
                      )}

                      {node.type === 'trigger' && (
                        <div 
                          className={cn(
                            "absolute top-[40px] -right-1.5 h-3 w-3 bg-background border-2 border-muted-foreground/40 rounded-full z-10 cursor-crosshair hover:bg-muted-foreground/20 transition-all duration-200",
                            (hoveredNodeId === node.id || (isConnecting && isConnecting.fromNodeId === node.id)) ? "opacity-100 scale-125 border-primary/60 shadow-sm" : "opacity-0 scale-50"
                          )}
                          onMouseDown={(e) => {
                          e.stopPropagation();
                          const canvasEl = e.currentTarget.closest('.min-w-\\[1000px\\]') as HTMLElement;
                          const canvasRect = canvasEl?.getBoundingClientRect();
                          if (canvasRect && canvasEl) {
                            const scale = canvasRect.width / canvasEl.offsetWidth;
                            const startX = node.position.x + 280;
                            const startY = node.position.y + 46;
                            setIsConnecting({ fromNodeId: node.id, startX, startY });
                            setCurrentMousePos({
                              x: (e.clientX - canvasRect.left) / scale,
                              y: (e.clientY - canvasRect.top) / scale
                            });

                            const handleMouseMove = (moveEvent: MouseEvent) => {
                              const currentRect = canvasEl.getBoundingClientRect();
                              setCurrentMousePos({
                                x: (moveEvent.clientX - currentRect.left) / scale,
                                y: (moveEvent.clientY - currentRect.top) / scale
                              });
                            };
                            
                            const handleMouseUp = () => {
                              window.removeEventListener('mousemove', handleMouseMove);
                              window.removeEventListener('mouseup', handleMouseUp);
                                  window.removeEventListener('click', handleMouseUp as any, { capture: true });
                              setIsConnecting(null);
                              setCurrentMousePos(null);
                            };
                            
                            window.addEventListener('mousemove', handleMouseMove);
                            window.addEventListener('mouseup', handleMouseUp);
                                window.addEventListener('click', handleMouseUp as any, { capture: true, once: true });
                          }
                        }}
                        ></div>
                      )}

                      {node.type === 'action' && (
                        <>
                          <div 
                            className={cn(
                              "absolute top-[40px] -right-1.5 h-3 w-3 bg-background border-2 border-green-500/40 rounded-full z-10 cursor-crosshair hover:bg-green-500/20 transition-all duration-200",
                              (hoveredNodeId === node.id || (isConnecting && isConnecting.fromNodeId === node.id)) ? "opacity-100 scale-125 border-green-500 shadow-sm" : "opacity-0 scale-50"
                            )}
                            title="Success"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              const canvasEl = e.currentTarget.closest('.min-w-\\[1000px\\]') as HTMLElement;
                              const canvasRect = canvasEl?.getBoundingClientRect();
                              if (canvasRect && canvasEl) {
                                const scale = canvasRect.width / canvasEl.offsetWidth;
                                const startX = node.position.x + 280;
                                const startY = node.position.y + 46;
                                setIsConnecting({ fromNodeId: node.id, startX, startY, sourceHandle: 'success' });
                                setCurrentMousePos({
                                  x: (e.clientX - canvasRect.left) / scale,
                                  y: (e.clientY - canvasRect.top) / scale
                                });

                                const handleMouseMove = (moveEvent: MouseEvent) => {
                                  const currentRect = canvasEl.getBoundingClientRect();
                                  setCurrentMousePos({
                                    x: (moveEvent.clientX - currentRect.left) / scale,
                                    y: (moveEvent.clientY - currentRect.top) / scale
                                  });
                                };
                                
                                const handleMouseUp = () => {
                                  window.removeEventListener('mousemove', handleMouseMove);
                                  window.removeEventListener('mouseup', handleMouseUp);
                                  window.removeEventListener('click', handleMouseUp as any, { capture: true });
                                  setIsConnecting(null);
                                  setCurrentMousePos(null);
                                };
                                
                                window.addEventListener('mousemove', handleMouseMove);
                                window.addEventListener('mouseup', handleMouseUp);
                                window.addEventListener('click', handleMouseUp as any, { capture: true, once: true });
                              }
                            }}
                          >
                            <span className={cn(
                              "absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-green-500 pointer-events-none transition-opacity whitespace-nowrap bg-background/80 px-1 py-0.5 rounded",
                              hoveredNodeId === node.id ? "opacity-100" : "opacity-0"
                            )}>Success</span>
                          </div>
                          <div 
                            className={cn(
                              "absolute top-[80px] -right-1.5 h-3 w-3 bg-background border-2 border-yellow-500/40 rounded-full z-10 cursor-crosshair hover:bg-yellow-500/20 transition-all duration-200",
                              (hoveredNodeId === node.id || (isConnecting && isConnecting.fromNodeId === node.id)) ? "opacity-100 scale-125 border-yellow-500 shadow-sm" : "opacity-0 scale-50"
                            )}
                            title="Fail Intent"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              const canvasEl = e.currentTarget.closest('.min-w-\\[1000px\\]') as HTMLElement;
                              const canvasRect = canvasEl?.getBoundingClientRect();
                              if (canvasRect && canvasEl) {
                                const scale = canvasRect.width / canvasEl.offsetWidth;
                                const startX = node.position.x + 280;
                                const startY = node.position.y + 86;
                                setIsConnecting({ fromNodeId: node.id, startX, startY, sourceHandle: 'fail_intent' });
                                setCurrentMousePos({
                                  x: (e.clientX - canvasRect.left) / scale,
                                  y: (e.clientY - canvasRect.top) / scale
                                });

                                const handleMouseMove = (moveEvent: MouseEvent) => {
                                  const currentRect = canvasEl.getBoundingClientRect();
                                  setCurrentMousePos({
                                    x: (moveEvent.clientX - currentRect.left) / scale,
                                    y: (moveEvent.clientY - currentRect.top) / scale
                                  });
                                };
                                
                                const handleMouseUp = () => {
                                  window.removeEventListener('mousemove', handleMouseMove);
                                  window.removeEventListener('mouseup', handleMouseUp);
                                  window.removeEventListener('click', handleMouseUp as any, { capture: true });
                                  setIsConnecting(null);
                                  setCurrentMousePos(null);
                                };
                                
                                window.addEventListener('mousemove', handleMouseMove);
                                window.addEventListener('mouseup', handleMouseUp);
                                window.addEventListener('click', handleMouseUp as any, { capture: true, once: true });
                              }
                            }}
                          >
                            <span className={cn(
                              "absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-yellow-500 pointer-events-none transition-opacity whitespace-nowrap bg-background/80 px-1 py-0.5 rounded",
                              hoveredNodeId === node.id ? "opacity-100" : "opacity-0"
                            )}>Fail Intent</span>
                          </div>
                          <div 
                            className={cn(
                              "absolute top-[120px] -right-1.5 h-3 w-3 bg-background border-2 border-red-500/40 rounded-full z-10 cursor-crosshair hover:bg-red-500/20 transition-all duration-200",
                              (hoveredNodeId === node.id || (isConnecting && isConnecting.fromNodeId === node.id)) ? "opacity-100 scale-125 border-red-500 shadow-sm" : "opacity-0 scale-50"
                            )}
                            title="Fails All Intents"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              const canvasEl = e.currentTarget.closest('.min-w-\\[1000px\\]') as HTMLElement;
                              const canvasRect = canvasEl?.getBoundingClientRect();
                              if (canvasRect && canvasEl) {
                                const scale = canvasRect.width / canvasEl.offsetWidth;
                                const startX = node.position.x + 280;
                                const startY = node.position.y + 126;
                                setIsConnecting({ fromNodeId: node.id, startX, startY, sourceHandle: 'fail_all' });
                                setCurrentMousePos({
                                  x: (e.clientX - canvasRect.left) / scale,
                                  y: (e.clientY - canvasRect.top) / scale
                                });

                                const handleMouseMove = (moveEvent: MouseEvent) => {
                                  const currentRect = canvasEl.getBoundingClientRect();
                                  setCurrentMousePos({
                                    x: (moveEvent.clientX - currentRect.left) / scale,
                                    y: (moveEvent.clientY - currentRect.top) / scale
                                  });
                                };
                                
                                const handleMouseUp = () => {
                                  window.removeEventListener('mousemove', handleMouseMove);
                                  window.removeEventListener('mouseup', handleMouseUp);
                                  window.removeEventListener('click', handleMouseUp as any, { capture: true });
                                  setIsConnecting(null);
                                  setCurrentMousePos(null);
                                };
                                
                                window.addEventListener('mousemove', handleMouseMove);
                                window.addEventListener('mouseup', handleMouseUp);
                                window.addEventListener('click', handleMouseUp as any, { capture: true, once: true });
                              }
                            }}
                          >
                            <span className={cn(
                              "absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-red-500 pointer-events-none transition-opacity whitespace-nowrap bg-background/80 px-1 py-0.5 rounded",
                              hoveredNodeId === node.id ? "opacity-100" : "opacity-0"
                            )}>Fails All Intents</span>
                          </div>
                        </>
                      )}

                      {node.type === 'condition' && (
                        <>
                          <div 
                            className={cn(
                              "absolute top-[40px] -right-1.5 h-3 w-3 bg-background border-2 border-blue-500/40 rounded-full z-10 cursor-crosshair hover:bg-blue-500/20 transition-all duration-200",
                              (hoveredNodeId === node.id || (isConnecting && isConnecting.fromNodeId === node.id)) ? "opacity-100 scale-125 border-blue-500 shadow-sm" : "opacity-0 scale-50"
                            )}
                            title="If (True)"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              const canvasEl = e.currentTarget.closest('.min-w-\\[1000px\\]') as HTMLElement;
                              const canvasRect = canvasEl?.getBoundingClientRect();
                              if (canvasRect && canvasEl) {
                                const scale = canvasRect.width / canvasEl.offsetWidth;
                                const startX = node.position.x + 280;
                                const startY = node.position.y + 46;
                                setIsConnecting({ fromNodeId: node.id, startX, startY, sourceHandle: 'true' });
                                setCurrentMousePos({
                                  x: (e.clientX - canvasRect.left) / scale,
                                  y: (e.clientY - canvasRect.top) / scale
                                });

                                const handleMouseMove = (moveEvent: MouseEvent) => {
                                  const currentRect = canvasEl.getBoundingClientRect();
                                  setCurrentMousePos({
                                    x: (moveEvent.clientX - currentRect.left) / scale,
                                    y: (moveEvent.clientY - currentRect.top) / scale
                                  });
                                };
                                
                                const handleMouseUp = () => {
                                  window.removeEventListener('mousemove', handleMouseMove);
                                  window.removeEventListener('mouseup', handleMouseUp);
                                  window.removeEventListener('click', handleMouseUp as any, { capture: true });
                                  setIsConnecting(null);
                                  setCurrentMousePos(null);
                                };
                                
                                window.addEventListener('mousemove', handleMouseMove);
                                window.addEventListener('mouseup', handleMouseUp);
                                window.addEventListener('click', handleMouseUp as any, { capture: true, once: true });
                              }
                            }}
                          >
                            <span className={cn(
                              "absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-blue-500 pointer-events-none transition-opacity bg-background/80 px-1 py-0.5 rounded",
                              hoveredNodeId === node.id ? "opacity-100" : "opacity-0"
                            )}>If</span>
                  </div>
                              <div 
                                className={cn(
                                  "absolute top-[80px] -right-1.5 h-3 w-3 bg-background border-2 border-orange-500/40 rounded-full z-10 cursor-crosshair hover:bg-orange-500/20 transition-all duration-200",
                                  (hoveredNodeId === node.id || (isConnecting && isConnecting.fromNodeId === node.id)) ? "opacity-100 scale-125 border-orange-500 shadow-sm" : "opacity-0 scale-50"
                                )}
                                title="Else (False)"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  const canvasEl = e.currentTarget.closest('.min-w-\\[1000px\\]') as HTMLElement;
                                  const canvasRect = canvasEl?.getBoundingClientRect();
                                  if (canvasRect && canvasEl) {
                                    const scale = canvasRect.width / canvasEl.offsetWidth;
                                    const startX = node.position.x + 280;
                                    const startY = node.position.y + 86;
                                    setIsConnecting({ fromNodeId: node.id, startX, startY, sourceHandle: 'false' });
                                    setCurrentMousePos({
                                      x: (e.clientX - canvasRect.left) / scale,
                                      y: (e.clientY - canvasRect.top) / scale
                                    });

                                    const handleMouseMove = (moveEvent: MouseEvent) => {
                                      const currentRect = canvasEl.getBoundingClientRect();
                                      setCurrentMousePos({
                                        x: (moveEvent.clientX - currentRect.left) / scale,
                                        y: (moveEvent.clientY - currentRect.top) / scale
                                      });
                                    };
                                    
                                    const handleMouseUp = () => {
                                      window.removeEventListener('mousemove', handleMouseMove);
                                      window.removeEventListener('mouseup', handleMouseUp);
                                  window.removeEventListener('click', handleMouseUp as any, { capture: true });
                                      setIsConnecting(null);
                                      setCurrentMousePos(null);
                                    };
                                    
                                    window.addEventListener('mousemove', handleMouseMove);
                                    window.addEventListener('mouseup', handleMouseUp);
                                window.addEventListener('click', handleMouseUp as any, { capture: true, once: true });
                                  }
                                }}
                              >
                                <span className={cn(
                                  "absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-orange-500 pointer-events-none transition-opacity bg-background/80 px-1 py-0.5 rounded",
                                  hoveredNodeId === node.id ? "opacity-100" : "opacity-0"
                                )}>Else</span>
                              </div>
                            </>
                          )}
                          
                          {node.type === 'secret' && (
                            <div 
                              className={cn(
                                "absolute top-[40px] -right-1.5 h-3 w-3 bg-background border-2 border-yellow-500/40 rounded-full z-10 cursor-crosshair hover:bg-yellow-500/20 transition-all duration-200",
                                (hoveredNodeId === node.id || (isConnecting && isConnecting.fromNodeId === node.id)) ? "opacity-100 scale-125 border-yellow-500 shadow-sm" : "opacity-0 scale-50"
                              )}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                const canvasEl = e.currentTarget.closest('.min-w-\\[1000px\\]') as HTMLElement;
                                const canvasRect = canvasEl?.getBoundingClientRect();
                                if (canvasRect && canvasEl) {
                                  const scale = canvasRect.width / canvasEl.offsetWidth;
                                  const startX = node.position.x + 280;
                                  const startY = node.position.y + 46;
                                  setIsConnecting({ fromNodeId: node.id, startX, startY, sourceHandle: 'success' });
                                  setCurrentMousePos({
                                    x: (e.clientX - canvasRect.left) / scale,
                                    y: (e.clientY - canvasRect.top) / scale
                                  });

                                  const handleMouseMove = (moveEvent: MouseEvent) => {
                                    const currentRect = canvasEl.getBoundingClientRect();
                                    setCurrentMousePos({
                                      x: (moveEvent.clientX - currentRect.left) / scale,
                                      y: (moveEvent.clientY - currentRect.top) / scale
                                    });
                                  };
                                  
                                  const handleMouseUp = () => {
                                    window.removeEventListener('mousemove', handleMouseMove);
                                    window.removeEventListener('mouseup', handleMouseUp);
                                  window.removeEventListener('click', handleMouseUp as any, { capture: true });
                                    setIsConnecting(null);
                                    setCurrentMousePos(null);
                                  };
                                  
                                  window.addEventListener('mousemove', handleMouseMove);
                                  window.addEventListener('mouseup', handleMouseUp);
                                window.addEventListener('click', handleMouseUp as any, { capture: true, once: true });
                                }
                              }}
                            >
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </ZoomableCanvas>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      {showRightPanel && (
        <div className="w-80 border-l bg-muted/30 flex flex-col h-full shrink-0 overflow-hidden relative">
          <Tabs defaultValue="info" className="flex flex-col h-full">
            <div className="flex-none h-[71px] border-b flex items-center justify-center px-4 z-10 bg-muted/95 backdrop-blur-sm">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="info">Details</TabsTrigger>
                <TabsTrigger value="outsource">Agents</TabsTrigger>
              </TabsList>
            </div>
            
            <div className="flex-1 flex flex-col overflow-hidden">
              <TabsContent value="info" className="mt-0 flex flex-col h-full data-[state=active]:flex data-[state=inactive]:hidden">
              {renderDetailsContent()}
              </TabsContent>
              
              <TabsContent value="outsource" className="mt-0 flex flex-col h-full data-[state=active]:flex data-[state=inactive]:hidden">
                <div className="flex-1 overflow-hidden">
                  {requirement?.id && (
                    <RequirementStatusList requirementId={requirement.id} hasContent={!!editor?.getText()} />
                  )}
            </div>
              </TabsContent>
            </div>
          </Tabs>
          </div>
        )}
    </div>
  )
}

const MenuBar = ({ 
  editor, 
  onSave, 
  isSaving, 
  onDelete, 
  hasUnsavedChanges,
  hasRequirementStatus,
  handleAddNode,
  showRightPanel,
  setShowRightPanel,
  canUndoWorkflow,
  canRedoWorkflow,
  onUndoWorkflow,
  onRedoWorkflow,
  onAddSecret
}: { 
  editor: any, 
  onSave: () => void, 
  isSaving: boolean,
  onDelete: () => void,
  hasUnsavedChanges?: boolean,
  hasRequirementStatus?: boolean,
  handleAddNode: (type: string) => void,
  showRightPanel: boolean,
  setShowRightPanel: (show: boolean) => void,
  canUndoWorkflow: boolean,
  canRedoWorkflow: boolean,
  onUndoWorkflow: () => void,
  onRedoWorkflow: () => void,
  onAddSecret?: (id: string, name: string) => void
}) => {
  if (!editor) {
    return null
  }

  return (
    <div className="border-b pl-[20px] pr-4 py-2 flex flex-wrap gap-1 h-[71px] items-center justify-between">
      <div className="flex items-center gap-1">
        <Button
          variant="secondary" 
          size="default"
          onClick={onSave}
          disabled={isSaving || !hasUnsavedChanges}
          className={cn(
            "h-9 flex items-center gap-2 hover:bg-primary/10 transition-all duration-200",
            !hasUnsavedChanges && "opacity-50"
          )}
        >
          {isSaving ? (
            <>
              <div className="h-4 w-4 animate-pulse bg-muted rounded" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save
            </>
          )}
        </Button>
        <div className="w-px h-6 bg-border mx-1" />

        <Button variant="ghost" size="sm" onClick={() => handleAddNode('trigger')} className="h-9 px-3 text-muted-foreground hover:text-foreground hover:bg-muted font-normal text-sm">
          <Zap className="h-4 w-4 mr-1.5 text-primary" /> Trigger
        </Button>
        <Button variant="ghost" size="sm" onClick={() => handleAddNode('action')} className="h-9 px-3 text-muted-foreground hover:text-foreground hover:bg-muted font-normal text-sm">
          <Code className="h-4 w-4 mr-1.5 text-primary" /> Action
        </Button>
        <Button variant="ghost" size="sm" onClick={() => handleAddNode('condition')} className="h-9 px-3 text-muted-foreground hover:text-foreground hover:bg-muted font-normal text-sm">
          <GitFork className="h-4 w-4 mr-1.5 text-primary" /> Condition
        </Button>
        
        <div className="w-px h-6 bg-border mx-1" />
        
        <AddSecretDialog 
          onSecretCreated={onAddSecret || (() => {})}
          trigger={
            <Button variant="ghost" size="sm" className="h-9 px-3 text-muted-foreground hover:text-foreground hover:bg-muted font-normal text-sm">
              <Key className="h-4 w-4 mr-1.5 text-primary" /> Add Secret
            </Button>
          }
        />
        
        <div className="w-px h-6 bg-border mx-1" />

        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (editor.can().undo()) editor.chain().focus().undo().run();
            if (canUndoWorkflow) onUndoWorkflow();
          }}
          disabled={!editor.can().undo() && !canUndoWorkflow}
          className="h-9 px-2 text-muted-foreground hover:text-foreground hover:bg-muted"
          title="Undo"
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (editor.can().redo()) editor.chain().focus().redo().run();
            if (canRedoWorkflow) onRedoWorkflow();
          }}
          disabled={!editor.can().redo() && !canRedoWorkflow}
          className="h-9 px-2 text-muted-foreground hover:text-foreground hover:bg-muted"
          title="Redo"
        >
          <Redo className="h-4 w-4" />
        </Button>
        
        {/* Delete section divider and button */}
        <div className="w-px h-6 bg-border mx-1" />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
              title="Delete Requirement"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Requirement</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this requirement? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction className="!bg-destructive hover:!bg-destructive/90 !text-destructive-foreground" onClick={onDelete}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowRightPanel(!showRightPanel)}
          className={cn(
            "h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-foreground",
            showRightPanel && "text-foreground"
          )}
          title={showRightPanel ? "Hide panel" : "Show panel"}
        >
          {showRightPanel ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
} 