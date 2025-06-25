"use client"

import { useEffect, useState, Suspense } from "react"
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
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Code,
  ParagraphIcon,
  LinkIcon,
  ImageIcon,
  Undo,
  Redo,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  CalendarIcon,
  Globe,
  Wand2,
  AlertCircle,
  Trash2,
  Plus
} from "@/app/components/ui/icons"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
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
    <div className="flex h-[calc(100vh-64px)]">
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
  const [error, setError] = useState<string | null>(null)
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
      setEditForm(prev => ({ 
        ...prev, 
        instructions: editor.getHTML()
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
        campaign_id: campaign_id, // Usar el primer campaign_id (si existe)
        outsourceInstructions: "", // Inicializar vacío, ya que no existe en la tabla requirements
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
      // Y agregamos la información de segmentos a cada campaña
      const formattedCampaigns = campaigns?.map((campaign: {
        id: string;
        title: string;
        description?: string;
      }) => {
        // Para cada campaña, buscaremos los segmentos relacionados
        const campaignWithSegments = {
        id: campaign.id,
        title: campaign.title,
          description: campaign.description || "",
          segments: [] as string[],
          segmentNames: [] as string[]
        }
        
        // Podríamos cargar los segmentos de la campaña aquí si es necesario
        
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
        outsourceInstructions: formattedRequirement.outsourceInstructions,
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
  const handleSaveChanges = async () => {
    if (!requirement) return
    
    setIsSaving(true)
    try {
      // Convert HTML instructions back to markdown for storage
      const markdownInstructions = htmlToMarkdown(editForm.instructions);
      
      // Update the requirement with instructions first
      const instructionsResult = await updateRequirementInstructions(requirement.id, markdownInstructions)
      
      if (instructionsResult.error) {
        throw new Error(instructionsResult.error)
      }
      
      // Update the requirement with other fields
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
        outsourceInstructions: "" // Pasamos string vacío ya que no se usará
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
    } catch (error) {
      console.error("Error updating requirement:", error)
      toast.error("Failed to update requirement")
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
                    disabled={editForm.completionStatus !== COMPLETION_STATUS.PENDING || isSaving}
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
                    disabled={editForm.completionStatus !== COMPLETION_STATUS.PENDING || isSaving}
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
                      // Solo mostrar el botón Add Segment si hay segmentos disponibles para agregar
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
                            
                            {/* Solo mostrar el botón Done si hay segmentos disponibles */}
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
                          // Cargar los segmentos de la campaña seleccionada
                          const loadCampaignSegments = async () => {
                            try {
                              const supabase = createClient();
                              
                              // Obtener segmentos de la campaña
                              const { data: campaignSegments, error } = await supabase
                                .from("campaign_segments")
                                .select("segment_id")
                                .eq("campaign_id", value);
                                
                              if (error) {
                                console.error("Error loading campaign segments:", error);
                                return;
                              }
                              
                              // Extraer IDs de segmentos
                              const segmentIds = campaignSegments.map((cs: { segment_id: string }) => cs.segment_id);
                              
                              // Obtener nombres de segmentos
                              const segmentNames = segmentIds.map((id: string) => {
                                const segment = segments.find(s => s.id === id);
                                return segment ? segment.name : "Unknown";
                              });
                              
                              // Actualizar el formulario con la nueva campaña y sus segmentos
                              setEditForm(prev => ({ 
                                ...prev, 
                                campaign_id: value,
                                campaigns: [value], // Establecer campaigns como array con solo el ID seleccionado
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
                        // Si "none" es seleccionado, limpiar datos de campaña
                        setEditForm(prev => ({ 
                          ...prev, 
                          campaign_id: "",
                          campaigns: [],
                          campaignNames: [],
                          // También limpiar segmentos
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
      <div className="flex h-[calc(100vh-64px)] items-center justify-center flex-col gap-4">
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
      <div className="flex h-[calc(100vh-64px)] items-center justify-center flex-col gap-4">
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
    <div className="flex h-[calc(100vh-64px)]">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-none">
          <MenuBar 
            editor={editor} 
            onSave={handleSaveChanges} 
            isSaving={isSaving} 
            onDelete={handleDeleteRequirement}
            hasUnsavedChanges={unsavedChanges}
          />
        </div>
        <div className="flex-1 overflow-auto">
          <div className="p-4 h-full flex flex-col">
            <EditorContent editor={editor} className="prose prose-sm dark:prose-invert max-w-none flex-1" />
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-80 border-l bg-muted/30 flex flex-col h-full">
        {editForm.budget && editForm.budget > 0 ? (
          <Tabs defaultValue="outsource" className="flex flex-col h-full">
            <div className="flex-none h-[71px] border-b flex items-center justify-center px-4">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="outsource">Outsource</TabsTrigger>
                <TabsTrigger value="info">Details</TabsTrigger>
              </TabsList>
            </div>
            
            <div className="flex-1 flex flex-col overflow-hidden">
              <TabsContent value="outsource" className="mt-0 flex flex-col h-full data-[state=active]:flex data-[state=inactive]:hidden">
                <div className="flex-1 overflow-hidden">
                  <ScrollArea className="h-full">
                    <div className="p-5 space-y-6">
                      {/* Outsourcing Status Display */}
                      {requirement?.metadata?.payment_status?.outsourced && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-900/30 mb-6">
                          <div className="flex items-center gap-2 mb-3">
                            <Globe className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wider">
                              Task Outsourced
                            </h3>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Provider:</span>
                              <span className="text-sm text-blue-600 dark:text-blue-400">
                                {requirement.metadata.payment_status.outsource_provider || 'External Provider'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Payment Status:</span>
                              <Badge className={cn(
                                "text-xs",
                                requirement.metadata.payment_status.status === 'paid'
                                  ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-900"
                                  : requirement.metadata.payment_status.status === 'failed'
                                  ? "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900"
                                  : "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-900"
                              )}>
                                {requirement.metadata.payment_status.status === 'paid' ? 'Paid' : 
                                 requirement.metadata.payment_status.status === 'failed' ? 'Failed' : 'Pending'}
                              </Badge>
                            </div>
                            {requirement.metadata.payment_status.amount_paid && (
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Amount Paid:</span>
                                <span className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                                  ${requirement.metadata.payment_status.amount_paid.toLocaleString()} {requirement.metadata.payment_status.currency || 'USD'}
                                </span>
                              </div>
                            )}
                            {requirement.metadata.payment_status.payment_date && (
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Payment Date:</span>
                                <span className="text-sm text-blue-600 dark:text-blue-400">
                                  {new Date(requirement.metadata.payment_status.payment_date).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Only show outsource instructions and button if not already outsourced */}
                      {!requirement?.metadata?.payment_status?.outsourced && !requirement?.campaignOutsourced && (
                        <>
                          {/* Outsource Instructions */}
                          <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
                            <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                              Outsource Instructions
                            </h3>
                            
                            <div className="space-y-4 max-w-full">
                              {/* Budget highlighted section */}
                              <div className="bg-primary/10 p-3 rounded-md border border-primary/20">
                                <Label className="text-sm font-semibold text-primary flex items-center gap-2 mb-2">
                                  <BarChart className="h-4 w-4" />
                                  Budget
                                </Label>
                                <div className="text-lg font-bold text-center py-1">
                                  {editForm.budget ? `$${editForm.budget.toLocaleString()}` : "No budget specified"}
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <Label className="text-sm font-medium">Instructions for Outsourcing</Label>
                                <Textarea 
                                  placeholder="Provide detailed instructions for outsourcing this requirement..." 
                                  className="min-h-[150px] w-full resize-none text-sm"
                                  value={editForm.outsourceInstructions}
                                  onChange={(e) => setEditForm({...editForm, outsourceInstructions: e.target.value})}
                                />
                                <p className="text-xs text-muted-foreground">
                                  Note: This information is for your reference only and is not saved to the database.
                                </p>
                              </div>
                              
                              <div className="space-y-2">
                                <Label className="text-sm font-medium">Timeline</Label>
                                <div className="text-muted-foreground text-sm break-words bg-muted/40 p-2 rounded">
                                  Please complete this task within the next 2 weeks.
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <Label className="text-sm font-medium">Deliverables</Label>
                                <div className="text-muted-foreground text-sm bg-muted/40 p-2 rounded">
                                  <ul className="list-disc pl-4 space-y-1 break-words">
                                    <li>Complete implementation of the requirement</li>
                                    <li>Documentation of the changes made</li>
                                    <li>Testing report</li>
                                  </ul>
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <Label className="text-sm font-medium">Communication</Label>
                                <div className="text-muted-foreground text-sm break-words bg-muted/40 p-2 rounded">
                                  Please provide regular updates on progress and any questions via the project management system.
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      )}

                      {/* Show status message if already outsourced and paid */}
                      {((requirement?.metadata?.payment_status?.outsourced && requirement.metadata?.payment_status?.status === 'paid') || 
                        requirement?.campaignOutsourced) && (
                        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-900/30">
                          <div className="flex items-center gap-2 text-green-800 dark:text-green-300">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-sm font-medium">
                              {requirement?.campaignOutsourced 
                                ? "This task's campaign has been outsourced and payment has been completed."
                                : "This task has already been outsourced and payment has been completed."}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
                
                {/* Only show outsource button if not already outsourced */}
                {!requirement?.metadata?.payment_status?.outsourced && !requirement?.campaignOutsourced && (
                  <div className="border-t p-4 bg-background mt-auto">
                    <Button className="w-full" onClick={() => router.push(`/outsource/checkout?taskId=${params.id}`)}>
                      <Globe className="h-4 w-4 mr-2" />
                      Outsource Task
                    </Button>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="info" className="mt-0 flex flex-col h-full data-[state=active]:flex data-[state=inactive]:hidden">
                {renderDetailsContent()}
              </TabsContent>
            </div>
          </Tabs>
        ) : (
          <div className="flex flex-col h-full">
            <div className="flex-none h-[71px] border-b flex items-center justify-center px-4">
              <h3 className="text-sm font-medium">Requirement Details</h3>
            </div>
            
            <div className="flex-1 flex flex-col overflow-hidden">
              {renderDetailsContent()}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const MenuBar = ({ editor, onSave, isSaving, onDelete, hasUnsavedChanges }: { 
  editor: any, 
  onSave: () => void, 
  isSaving: boolean,
  onDelete: () => void,
  hasUnsavedChanges?: boolean
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
            "flex items-center gap-2 hover:bg-primary/10 transition-all duration-200",
            !hasUnsavedChanges && "opacity-50"
          )}
        >
          {isSaving ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></span>
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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'bg-muted' : ''}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'bg-muted' : ''}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive('bulletList') ? 'bg-muted' : ''}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive('orderedList') ? 'bg-muted' : ''}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={editor.isActive('blockquote') ? 'bg-muted' : ''}
        >
          <Quote className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={editor.isActive('codeBlock') ? 'bg-muted' : ''}
        >
          <Code className="h-4 w-4" />
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm"
              className={editor.isActive('heading') ? 'bg-muted' : ''}
            >
              {editor.isActive('heading', { level: 1 }) && <span className="w-4 h-4 inline-flex items-center justify-center font-bold">H1</span>}
              {editor.isActive('heading', { level: 2 }) && <span className="w-4 h-4 inline-flex items-center justify-center font-bold">H2</span>}
              {editor.isActive('heading', { level: 3 }) && <span className="w-4 h-4 inline-flex items-center justify-center font-bold">H3</span>}
              {editor.isActive('heading', { level: 4 }) && <span className="w-4 h-4 inline-flex items-center justify-center text-xs font-bold">H4</span>}
              {editor.isActive('heading', { level: 5 }) && <span className="w-4 h-4 inline-flex items-center justify-center text-xs font-bold">H5</span>}
              {editor.isActive('heading', { level: 6 }) && <span className="w-4 h-4 inline-flex items-center justify-center text-xs font-bold">H6</span>}
              {!editor.isActive('heading') && <ParagraphIcon className="h-4 w-4 text-sm" />}
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => editor.chain().focus().setParagraph().run()}>
              <ParagraphIcon className="h-4 w-4 mr-2" />
              Paragraph
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
              <span className="w-4 h-4 inline-flex items-center justify-center mr-2 font-bold">H1</span>
              Heading 1
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
              <span className="w-4 h-4 inline-flex items-center justify-center mr-2 font-bold">H2</span>
              Heading 2
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
              <span className="w-4 h-4 inline-flex items-center justify-center mr-2 font-bold">H3</span>
              Heading 3
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}>
              <span className="w-4 h-4 inline-flex items-center justify-center mr-2 text-xs font-bold">H4</span>
              Heading 4
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()}>
              <span className="w-4 h-4 inline-flex items-center justify-center mr-2 text-xs font-bold">H5</span>
              Heading 5
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 6 }).run()}>
              <span className="w-4 h-4 inline-flex items-center justify-center mr-2 text-xs font-bold">H6</span>
              Heading 6
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const url = window.prompt('Enter the URL')
            if (url) {
              editor.chain().focus().setLink({ href: url }).run()
            }
          }}
          className={editor.isActive('link') ? 'bg-muted' : ''}
        >
          <LinkIcon className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const url = window.prompt('Enter the image URL')
            if (url) {
              editor.chain().focus().setImage({ src: url }).run()
            }
          }}
        >
          <ImageIcon className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={editor.isActive({ textAlign: 'left' }) ? 'bg-muted' : ''}
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={editor.isActive({ textAlign: 'center' }) ? 'bg-muted' : ''}
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={editor.isActive({ textAlign: 'right' }) ? 'bg-muted' : ''}
        >
          <AlignRight className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          className={editor.isActive({ textAlign: 'justify' }) ? 'bg-muted' : ''}
        >
          <AlignJustify className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
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
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
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
              <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={onDelete}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
} 