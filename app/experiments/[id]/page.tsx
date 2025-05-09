"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/app/components/ui/button"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { Badge } from "@/app/components/ui/badge"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Textarea } from "@/app/components/ui/textarea"
import { toast } from "sonner"
import { 
  ChevronLeft,
  Save, 
  X, 
  Pencil,
  Eye,
  PlusCircle,
  PlayCircle,
  StopCircle,
  XCircle,
  FileText,
  MessageSquare,
  CalendarIcon,
  Tag,
  Users,
  User,
  HelpCircle,
  Link,
  Beaker,
  ExternalLink,
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Code,
  ParagraphIcon,
  ChevronDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  LinkIcon,
  ImageIcon,
  Undo,
  Redo,
  Trash2
} from "@/app/components/ui/icons"
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import HardBreak from '@tiptap/extension-hard-break'
import { Card, CardContent } from "@/app/components/ui/card"
import { markdownToHTML, processMarkdownText } from "@/app/content/utils"
import { createClient } from "@/lib/supabase/client"
import { startExperiment, stopExperiment, setExperimentStatus } from "../actions"
import { Separator } from "@/app/components/ui/separator"
import { useSite } from "@/app/context/SiteContext"
import { cn } from "@/lib/utils"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"

import "../styles/editor.css"

import { Experiment } from "./types"
import { MenuBar, ExperimentDetails } from "./components"

const ExperimentStatusBar = ({ 
  currentStatus, 
  onStatusChange 
}: { 
  currentStatus: "active" | "completed" | "draft";
  onStatusChange: (newStatus: "active" | "completed" | "draft") => void;
}) => {
  return (
    <div className="flex items-center">
      <div className="flex space-x-2">
        {["draft", "active", "completed"].map((status) => (
          <Badge 
            key={status}
            className={cn(
              "px-3 py-1 text-sm cursor-pointer transition-colors duration-200",
              status === currentStatus 
                ? (status === "draft" 
                    ? "bg-secondary/20 text-secondary-foreground border-secondary/20"
                    : status === "active" 
                        ? "bg-success/20 text-success border-success/20"
                        : "bg-info/20 text-info border-info/20")
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground hover:border-border border border-transparent"
            )}
            onClick={() => onStatusChange(status as "active" | "completed" | "draft")}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        ))}
      </div>
    </div>
  );
}

const ExperimentSkeleton = () => {
  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Main Content Area Skeleton */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-none border-b p-2 h-[71px]">
          <div className="flex gap-1 h-full items-center">
            <div className="h-8 w-36 bg-muted animate-pulse rounded"></div>
            <div className="ml-auto h-8 w-32 bg-muted animate-pulse rounded"></div>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div className="space-y-4">
            <div className="h-8 bg-muted animate-pulse rounded w-3/4"></div>
            <div className="h-4 bg-muted animate-pulse rounded w-full"></div>
            <div className="h-4 bg-muted animate-pulse rounded w-5/6"></div>
            <div className="h-4 bg-muted animate-pulse rounded w-4/5"></div>
            <div className="h-4 bg-muted animate-pulse rounded w-full"></div>
            <div className="h-4 bg-muted animate-pulse rounded w-3/4"></div>
            <div className="h-8 bg-muted animate-pulse rounded w-1/2 mt-8"></div>
            <div className="h-4 bg-muted animate-pulse rounded w-full"></div>
            <div className="h-4 bg-muted animate-pulse rounded w-5/6"></div>
            <div className="h-4 bg-muted animate-pulse rounded w-4/5"></div>
          </div>
        </div>
      </div>

      {/* Details Panel Skeleton */}
      <div className="w-80 border-l bg-muted/30 flex flex-col h-full">
        <div className="h-[71px] border-b flex items-center px-4">
          <div className="w-60 h-8 bg-muted animate-pulse rounded"></div>
        </div>
        <div className="p-4 space-y-6">
          <div className="h-10 bg-muted animate-pulse rounded"></div>
          <div className="space-y-3">
            <div className="h-4 bg-muted animate-pulse rounded w-1/2"></div>
            <div className="h-8 bg-muted animate-pulse rounded w-full"></div>
          </div>
          <div className="space-y-3">
            <div className="h-4 bg-muted animate-pulse rounded w-2/3"></div>
            <div className="h-20 bg-muted animate-pulse rounded w-full"></div>
          </div>
          <div className="space-y-2 mt-6">
            <div className="h-6 bg-muted animate-pulse rounded w-1/3"></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="h-9 bg-muted animate-pulse rounded"></div>
              <div className="h-9 bg-muted animate-pulse rounded"></div>
              <div className="h-9 bg-muted animate-pulse rounded"></div>
              <div className="h-9 bg-muted animate-pulse rounded"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ExperimentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { currentSite } = useSite()
  const [experiment, setExperiment] = useState<Experiment | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isActionLoading, setIsActionLoading] = useState(false)
  const [editedInstructions, setEditedInstructions] = useState('')
  const [isEditingDetails, setIsEditingDetails] = useState(false)
  const [unsavedChanges, setUnsavedChanges] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    hypothesis: '',
    validations: ''
  })
  const [pendingSegmentChanges, setPendingSegmentChanges] = useState<{
    pendingSegments: Array<{id: string, name: string, participants: number}>,
    removedSegmentIds: string[]
  } | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        hardBreak: false,
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
    editable: true,
    editorProps: {
      attributes: {
        class: 'prose prose-lg prose-headings:my-2 prose-p:my-2 prose-ul:my-2 h-full outline-none p-6 pt-4',
      },
    },
    onUpdate: ({ editor }) => {
      const content = editor.getText()
      setEditedInstructions(content)
      setUnsavedChanges(true)
      console.log('Content updated:', content)
    }
  })

  useEffect(() => {
    if (currentSite?.id && params.id) {
      loadExperiment()
    }
  }, [currentSite?.id, params.id])

  // Update editor content when experiment is loaded
  useEffect(() => {
    if (experiment && editor) {
      try {
        const formattedHTML = markdownToHTML(experiment.instructions || '')
        editor.commands.setContent(formattedHTML)
        setEditedInstructions(experiment.instructions || '')
        
        // Asegurar que el editor tenga el foco
        setTimeout(() => {
          editor.commands.focus()
        }, 300)
      } catch (error) {
        console.error("Error setting editor content:", error)
      }
    }
  }, [experiment, editor])

  // Update page title when experiment is loaded
  useEffect(() => {
    if (experiment) {
      document.title = `${experiment.name} | Experiments`
      
      const event = new CustomEvent('breadcrumb:update', {
        detail: {
          title: experiment.name,
          path: `/experiments/${experiment.id}`,
          section: 'experiments'
        }
      })
      
      setTimeout(() => {
        window.dispatchEvent(event)
      }, 0)
    }
    
    return () => {
      document.title = 'Experiments | Market Fit'
    }
  }, [experiment])

  useEffect(() => {
    if (experiment) {
      setEditForm({
        name: experiment.name || '',
        description: experiment.description || '',
        hypothesis: experiment.hypothesis || '',
        validations: experiment.validations || ''
      })
    }
  }, [experiment])

  // Add event listener for experiment:refresh
  useEffect(() => {
    const handleExperimentRefresh = () => {
      if (currentSite && params.id) {
        loadExperiment();
      }
    };

    window.addEventListener('experiment:refresh', handleExperimentRefresh);
    
    return () => {
      window.removeEventListener('experiment:refresh', handleExperimentRefresh);
    };
  }, [currentSite, params.id]);

  // Add event listener for AI-generated content
  useEffect(() => {
    const handleAIGenerated = (event: CustomEvent) => {
      if (editor && event.detail && event.detail.content) {
        // First, update the editor content with the AI-generated content
        const formattedHTML = markdownToHTML(event.detail.content);
        editor.commands.setContent(formattedHTML);
        
        // Also update the editedInstructions state to track the new content
        setEditedInstructions(event.detail.content);
        
        // Save the changes to the database
        handleSaveChanges();
      }
    };

    window.addEventListener('experiment:ai-generated', handleAIGenerated as EventListener);
    
    return () => {
      window.removeEventListener('experiment:ai-generated', handleAIGenerated as EventListener);
    };
  }, [editor]);

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
    
    window.addEventListener('experiment:segment-changes', handleSegmentChanges as EventListener);
    
    return () => {
      window.removeEventListener('experiment:segment-changes', handleSegmentChanges as EventListener);
    };
  }, []);

  // Check for unsaved changes when form values change
  useEffect(() => {
    if (experiment) {
      const hasFormChanges = 
        editForm.name !== (experiment.name || '') ||
        editForm.description !== (experiment.description || '') ||
        editForm.hypothesis !== (experiment.hypothesis || '') ||
        editForm.validations !== (experiment.validations || '');
      
      const hasContentChanges = editedInstructions !== (experiment.instructions || '');
      
      setUnsavedChanges(hasFormChanges || hasContentChanges);
    }
  }, [editForm, editedInstructions, experiment]);

  // Reset unsaved changes after successful save
  useEffect(() => {
    const handleExperimentSaved = () => {
      setUnsavedChanges(false);
    };
    
    window.addEventListener('experiment:saved', handleExperimentSaved);
    
    return () => {
      window.removeEventListener('experiment:saved', handleExperimentSaved);
    };
  }, []);

  const loadExperiment = async () => {
    if (!currentSite || !params.id) return
    
    setIsLoading(true)
    try {
      const supabase = createClient()
      const { data: experimentData, error } = await supabase
        .from("experiments")
        .select(`
          id,
          name,
          description,
          instructions,
          status,
          start_date,
          end_date,
          conversion,
          roi,
          preview_url,
          hypothesis,
          campaign_id,
          site_id,
          experiment_segments (
            segment:segments (
              id,
              name
            ),
            participants
          ),
          validations
        `)
        .eq('id', params.id as string)
        .single()

      if (error) {
        console.error("Error fetching experiment:", error)
        toast.error("Failed to load experiment")
        router.push("/experiments")
        return
      }

      // Fetch associated campaign if exists
      let campaign = null
      if (experimentData.campaign_id) {
        const { data: campaignData, error: campaignError } = await supabase
          .from("campaigns")
          .select("id, title, description")
          .eq("id", experimentData.campaign_id)
          .single()
          
        if (!campaignError && campaignData) {
          campaign = campaignData
        }
      }

      // Transform data to match interface
      const transformedData: Experiment = {
        ...experimentData,
        campaign,
        segments: experimentData.experiment_segments.map((es: any) => ({
          id: es.segment.id,
          name: es.segment.name,
          participants: es.participants || 0
        }))
      }

      setExperiment(transformedData)
      
      // Set editor content
      if (editor && transformedData.instructions) {
        const formattedHTML = markdownToHTML(transformedData.instructions)
        editor.commands.setContent(formattedHTML)
      }
    } catch (error) {
      console.error("Error:", error)
      toast.error("An unexpected error occurred")
      router.push("/experiments")
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleEdit = () => {
    console.log("Toggle edit mode - but editor is always editable")
  }

  const handleSaveChanges = async () => {
    if (!experiment || !currentSite) return
    
    setIsSaving(true)
    try {
      console.log("Saving experiment changes...");

      // Get the edited content from the editor
      const plainText = editor?.getText() || ''

      // Get preview URL from the experiment state
      const preview_url = experiment.preview_url

      // Update experiment in Supabase
      const supabase = createClient()
      const { error } = await supabase
        .from('experiments')
        .update({
          instructions: plainText,
          name: editForm.name,
          description: editForm.description,
          hypothesis: editForm.hypothesis,
          validations: editForm.validations,
          preview_url
        })
        .eq('id', experiment.id)
        .eq('site_id', currentSite.id)

      if (error) {
        throw new Error(error.message)
      }

      // Process segment changes if any
      if (pendingSegmentChanges) {
        console.log("Processing segment changes:", pendingSegmentChanges);
        
        // 1. Remove segments that were deleted
        if (pendingSegmentChanges.removedSegmentIds.length > 0) {
          console.log("Removing segments:", pendingSegmentChanges.removedSegmentIds);
          
          const { error: removeError } = await supabase
            .from('experiment_segments')
            .delete()
            .eq('experiment_id', experiment.id)
            .in('segment_id', pendingSegmentChanges.removedSegmentIds);
            
          if (removeError) {
            console.error("Error removing segments:", removeError);
          }
        }
        
        // 2. Add new segments
        const existingSegmentIds = experiment.segments.map(s => s.id);
        const newSegments = pendingSegmentChanges.pendingSegments.filter(
          s => !existingSegmentIds.includes(s.id) && !pendingSegmentChanges.removedSegmentIds.includes(s.id)
        );
        
        if (newSegments.length > 0) {
          console.log("Adding new segments:", newSegments);
          
          const { error: addError } = await supabase
            .from('experiment_segments')
            .insert(
              newSegments.map(segment => ({
                experiment_id: experiment.id,
                segment_id: segment.id,
                participants: 0
              }))
            );
            
          if (addError) {
            console.error("Error adding segments:", addError);
          }
        }
        
        // Reset segment changes
        setPendingSegmentChanges(null);
      }

      // Update local state
      setExperiment(prev => 
        prev ? { 
          ...prev, 
          instructions: plainText,
          name: editForm.name,
          description: editForm.description,
          hypothesis: editForm.hypothesis,
          validations: editForm.validations,
          preview_url
        } : null
      )
      
      // Update document title and breadcrumb
      document.title = `${editForm.name} | Experiments`
      const event = new CustomEvent('breadcrumb:update', {
        detail: {
          title: editForm.name,
          path: `/experiments/${experiment.id}`,
          section: 'experiments'
        }
      })
      window.dispatchEvent(event)
      
      // Reset unsaved changes
      setUnsavedChanges(false)
      
      // Dispatch event to notify the experiment was saved successfully
      window.dispatchEvent(new CustomEvent('experiment:saved'));
      
      // Refresh experiment data
      await loadExperiment();
      
      toast.success("Experiment updated successfully")
    } catch (error) {
      console.error("Error updating experiment:", error)
      toast.error("Failed to update experiment")
    } finally {
      setIsSaving(false)
    }
  }

  const handleStartExperiment = async (experimentId: string) => {
    try {
      setIsActionLoading(true)
      const result = await startExperiment(experimentId)
      
      if (result.error) {
        toast.error(result.error)
        return
      }

      // Update local state
      setExperiment(prev => 
        prev ? { 
          ...prev, 
          status: "active", 
          start_date: new Date().toISOString() 
        } : null
      )

      toast.success("Experiment started successfully")
    } catch (error) {
      toast.error("An unexpected error occurred")
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleStopExperiment = async (experimentId: string) => {
    try {
      setIsActionLoading(true)
      const result = await stopExperiment(experimentId)
      
      if (result.error) {
        toast.error(result.error)
        return
      }

      // Update local state
      setExperiment(prev => 
        prev ? { 
          ...prev, 
          status: "completed", 
          end_date: new Date().toISOString() 
        } : null
      )

      toast.success("Experiment stopped successfully")
    } catch (error) {
      toast.error("An unexpected error occurred")
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleStatusChange = async (newStatus: "draft" | "active" | "completed") => {
    if (!experiment) return;
    
    // If current status is the same as new status, do nothing
    if (experiment.status === newStatus) return;
    
    setIsActionLoading(true);
    try {
      let result;
      
      // Use existing specialized functions for active and completed
      if (newStatus === "active") {
        result = await startExperiment(experiment.id);
      } else if (newStatus === "completed") {
        result = await stopExperiment(experiment.id);
      } else {
        // For draft status, use the new generic function
        result = await setExperimentStatus(experiment.id, newStatus);
      }
      
      if (result.error) {
        toast.error(result.error);
        return;
      }

      // Update local state
      setExperiment(prev => 
        prev ? { 
          ...prev, 
          status: newStatus,
          // Update dates accordingly
          start_date: newStatus === "active" ? new Date().toISOString() : prev.start_date,
          end_date: newStatus === "completed" ? new Date().toISOString() : prev.end_date
        } : null
      );

      toast.success(`Experiment ${newStatus === "draft" ? "set to draft" : newStatus === "active" ? "started" : "completed"} successfully`);
    } catch (error) {
      toast.error("An unexpected error occurred while updating experiment status");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeleteExperiment = async () => {
    if (!experiment || !currentSite) return
    
    try {
      // Delete experiment from Supabase
      const supabase = createClient()
      const { error } = await supabase
        .from('experiments')
        .delete()
        .eq('id', experiment.id)
        .eq('site_id', currentSite.id)

      if (error) {
        throw new Error(error.message)
      }
      
      toast.success("Experiment deleted successfully")
      router.push('/experiments')
    } catch (error) {
      console.error("Error deleting experiment:", error)
      toast.error("Failed to delete experiment")
    }
  }

  const handleToggleEditDetails = () => {
    if (isEditingDetails) {
      // Reset form if cancelling
      if (experiment) {
        setEditForm({
          name: experiment.name || '',
          description: experiment.description || '',
          hypothesis: experiment.hypothesis || '',
          validations: experiment.validations || ''
        })
      }
    }
    setIsEditingDetails(!isEditingDetails)
  }

  if (isLoading || !experiment) {
    return <ExperimentSkeleton />
  }

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-none">
          <MenuBar 
            editor={editor}
            experiment={experiment}
            onSave={handleSaveChanges}
            isSaving={isSaving}
            isEditing={true}
            isLoading={isActionLoading}
            onStart={handleStartExperiment}
            onStop={handleStopExperiment}
            onToggleEdit={handleToggleEdit}
            onDelete={handleDeleteExperiment}
            hasUnsavedChanges={unsavedChanges}
          />
        </div>
        <div className="flex-1 overflow-auto">
          <EditorContent 
            editor={editor} 
            className="h-full"
          />
        </div>
      </div>

      {/* Experiment Details Panel */}
      <div className="w-80 border-l bg-muted/30 flex flex-col h-full">
        <div className="flex flex-col h-full">
          {/* Panel Header */}
          <div className="h-[71px] border-b flex items-center justify-center px-4">
            {experiment && (
              <ExperimentStatusBar 
                currentStatus={experiment.status} 
                onStatusChange={(newStatus) => {
                  handleStatusChange(newStatus);
                }}
              />
            )}
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-6">
                <ExperimentDetails 
                  experiment={experiment}
                  editForm={editForm}
                  onFormChange={(field, value) => {
                    setEditForm(prev => ({ ...prev, [field]: value }));
                    setUnsavedChanges(true);
                  }}
                />
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  )
} 