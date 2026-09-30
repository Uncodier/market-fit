"use client"

import { useParams,useRouter } from "next/navigation"
import { useRef,useState } from "react"
import { type RequirementView } from "./components/RequirementViewSwitcher"

import { RelationSelectValue } from "@/app/components/ui/relation-select"
import { useAuth } from "@/app/hooks/use-auth"
import HardBreak from '@tiptap/extension-hard-break'
import TextAlign from '@tiptap/extension-text-align'
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

import { type CompletionStatusType,type Requirement,type RequirementStatusType,type WorkflowConnection,type WorkflowNode } from "./requirement-detail-types"
import { htmlToMarkdown } from "./requirement-markdown"
export function useRequirementState() {
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
  const [activeView, setActiveView] = useState<RequirementView>("document")
  
  // Custom nodes for the workflow builder
  const [nodes, setNodes] = useState<WorkflowNode[]>([
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
  const [connections, setConnections] = useState<WorkflowConnection[]>([])
  
  // State for workflow history (undo/redo)
  const [workflowHistory, setWorkflowHistory] = useState<{
    past: { nodes: WorkflowNode[], connections: WorkflowConnection[] }[],
    future: { nodes: WorkflowNode[], connections: WorkflowConnection[] }[]
  }>({ past: [], future: [] });
  const isHistoryActionRef = useRef(false);
  const isInitialLoadRef = useRef(true);

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
    type: 'task' as "app" | "automation" | "presentation" | "document" | "campaign" | "image" | "video" | "audio" | "report" | "message" | "segment" | "task" | "website",
    priority: 'medium' as 'high' | 'medium' | 'low',
    status: 'backlog' as RequirementStatusType,
    completionStatus: 'pending' as CompletionStatusType,
    source: '',
    budget: null as number | null,
    segments: [] as string[],
    campaigns: [] as string[],
    campaign_id: '',
    campaignValue: null as RelationSelectValue,
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

  return { params, router, user, isAuthLoading, requirement, setRequirement, isLoading, setIsLoading, isEditing, setIsEditing, isSaving, setIsSaving, isBuilding, setIsBuilding, error, setError, hasRequirementStatus, setHasRequirementStatus, showRightPanel, setShowRightPanel, activeView, setActiveView, nodes, setNodes, connections, setConnections, workflowHistory, setWorkflowHistory, isConnecting, setIsConnecting, currentMousePos, setCurrentMousePos, hoveredNodeId, setHoveredNodeId, selectedConnectionId, setSelectedConnectionId, unsavedChanges, setUnsavedChanges, pendingSegmentChanges, setPendingSegmentChanges, editForm, setEditForm, campaigns, setCampaigns, segments, setSegments, selectedSegmentId, setSelectedSegmentId, showSegmentDropdown, setShowSegmentDropdown, isHistoryActionRef, isInitialLoadRef, editor }
}
export type RequirementState = ReturnType<typeof useRequirementState>
