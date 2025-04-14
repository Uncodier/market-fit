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
import { updateContent, updateContentStatus, deleteContent, getContentById } from "../actions"
import { getContentTypeName, processMarkdownText, markdownToHTML } from "../utils"
import { StarRating } from "@/app/components/ui/rating"
import { createClient } from "@/lib/supabase/client"
import { 
  ChevronLeft,
  Wand2, 
  Save, 
  X, 
  Pencil,
  Eye,
  Sparkles,
  PlusCircle,
  RotateCcw,
  FileText,
  MessageSquare,
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Code,
  Heading1,
  Heading2,
  Heading3,
  LinkIcon,
  ImageIcon,
  Undo,
  Redo,
  Settings,
  ChevronDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  ParagraphIcon,
  Megaphone,
  Target,
  Type,
  Tag,
  FileText as TextIcon,
  Users,
  BarChart,
  Trash2
} from "@/app/components/ui/icons"
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import HardBreak from '@tiptap/extension-hard-break'
import '../styles/editor.css'
import { Slider } from "@/app/components/ui/slider"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/app/components/ui/collapsible"
import { Card, CardContent } from "@/app/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
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

const MenuBar = ({ editor, onSave, isSaving, onDelete }: { 
  editor: any, 
  onSave: () => void, 
  isSaving: boolean,
  onDelete: () => void 
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
          disabled={isSaving}
          className="flex items-center gap-2 hover:bg-primary/10 transition-all duration-200"
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
              <AlertDialogTitle>Delete Content</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this content? This action cannot be undone.
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

const ContentSkeleton = () => {
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

      {/* AI Assistant Panel Skeleton */}
      <div className="w-80 border-l bg-muted/30 flex flex-col h-full">
        <div className="h-[71px] border-b flex items-center justify-center">
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

// Add Cpu icon for AI representation
const Cpu = ({ className = "", size = 20, ...props }: { className?: string, size?: number, [key: string]: any }) => (
  <div 
    className={`inline-flex items-center justify-center safari-icon-fix ${className}`}
    style={{ 
      width: size, 
      height: size, 
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      ...props.style 
    }}
    onClick={props.onClick}
    aria-hidden={props["aria-hidden"] ?? true}
  >
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
      <rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" />
      <line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" />
      <line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" />
      <line x1="20" y1="14" x2="23" y2="14" />
      <line x1="1" y1="9" x2="4" y2="9" />
      <line x1="1" y1="14" x2="4" y2="14" />
    </svg>
  </div>
)

// Activity icon for status
const ActivityIcon = ({ className = "", size = 20, ...props }: { className?: string, size?: number, [key: string]: any }) => (
  <div 
    className={`inline-flex items-center justify-center safari-icon-fix ${className}`}
    style={{ 
      width: size, 
      height: size, 
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      ...props.style 
    }}
    onClick={props.onClick}
    aria-hidden={props["aria-hidden"] ?? true}
  >
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  </div>
)

export default function ContentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [content, setContent] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    content: '',
    text: '',
    type: '',
    segment_id: '',
    campaign_id: '',
    tags: [] as string[],
    word_count: 0,
    char_count: 0,
    performance_rating: null as number | null,
    status: 'draft' // Default status
  })
  const [aiPrompt, setAiPrompt] = useState('')
  const [isAiProcessing, setIsAiProcessing] = useState(false)
  const [contentStyle, setContentStyle] = useState({
    tone: 50, // Formal (0) to Casual (100)
    complexity: 50, // Simple (0) to Complex (100)
    creativity: 50, // Conservative (0) to Creative (100)
    persuasiveness: 50, // Informative (0) to Persuasive (100)
    targetAudience: 50, // General (0) to Specific (100)
    engagement: 50, // Professional (0) to Engaging (100)
    size: 50, // Short (0) to Long (100)
  })
  const [expertise, setExpertise] = useState('')
  const [interests, setInterests] = useState('')
  const [topicsToAvoid, setTopicsToAvoid] = useState('')
  const [campaigns, setCampaigns] = useState<Array<{id: string, title: string, description?: string}>>([])
  const [segments, setSegments] = useState<Array<{id: string, name: string}>>([])

  // Functions to determine slider labels
  const getToneLabel = (value: number) => {
    if (value === 100) return "Extremely Casual";
    if (value < 20) return "Very Formal";
    if (value < 40) return "Formal";
    if (value < 60) return "Neutral";
    if (value < 80) return "Casual";
    return "Very Casual";
  }

  const getComplexityLabel = (value: number) => {
    if (value === 100) return "Extremely Complex";
    if (value < 20) return "Very Simple";
    if (value < 40) return "Simple";
    if (value < 60) return "Moderate";
    if (value < 80) return "Complex";
    return "Very Complex";
  }

  const getCreativityLabel = (value: number) => {
    if (value === 100) return "Extremely Creative";
    if (value < 20) return "Very Conservative";
    if (value < 40) return "Conservative";
    if (value < 60) return "Balanced";
    if (value < 80) return "Creative";
    return "Very Creative";
  }

  const getPersuasivenessLabel = (value: number) => {
    if (value === 100) return "Extremely Persuasive";
    if (value < 20) return "Purely Informative";
    if (value < 40) return "Mostly Informative";
    if (value < 60) return "Balanced";
    if (value < 80) return "Persuasive";
    return "Highly Persuasive";
  }

  const getTargetAudienceLabel = (value: number) => {
    if (value === 100) return "Extremely Specific";
    if (value < 20) return "Very General";
    if (value < 40) return "General";
    if (value < 60) return "Mixed";
    if (value < 80) return "Specific";
    return "Very Specific";
  }

  const getEngagementLabel = (value: number) => {
    if (value === 100) return "Extremely Engaging";
    if (value < 20) return "Highly Professional";
    if (value < 40) return "Professional";
    if (value < 60) return "Balanced";
    if (value < 80) return "Engaging";
    return "Highly Engaging";
  }

  const getSizeLabel = (value: number) => {
    if (value === 100) return "Extremely Long";
    if (value < 20) return "Very Short";
    if (value < 40) return "Short";
    if (value < 60) return "Medium";
    if (value < 80) return "Long";
    return "Very Long";
  }

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
        content: editor.getHTML(),
        text: editor.getText()
      }))
    },
    editorProps: {
      attributes: {
        class: 'prose-lg prose-headings:my-4 prose-p:my-3 prose-ul:my-3',
      },
    },
  })

  // Define handleDeleteContent here, before it's used in the return statement
  const handleDeleteContent = async () => {
    try {
      const result = await deleteContent(content.id)
      
      if (result.error) {
        throw new Error(result.error)
      }
      
      toast.success("Content deleted successfully")
      router.push('/content') // Redirect to content list page
    } catch (error) {
      console.error("Error deleting content:", error)
      toast.error(error instanceof Error ? error.message : "Failed to delete content")
    }
  }

  useEffect(() => {
    loadContent()
  }, [params.id])

  // Add effect to update the title in the topbar when content is loaded
  useEffect(() => {
    if (content) {
      // Update the page title for the browser tab
      document.title = `${content.title} | Content`
      
      // Emit a custom event to update the breadcrumb with content title
      const event = new CustomEvent('breadcrumb:update', {
        detail: {
          title: content.title,
          path: `/content/${content.id}`,
          section: 'content'
        }
      })
      
      // Ensure event is dispatched after DOM is updated
      setTimeout(() => {
        window.dispatchEvent(event)
        console.log('Breadcrumb update event dispatched:', content.title)
      }, 0)
    }
    
    // Cleanup when component unmounts
    return () => {
      document.title = 'Content | Market Fit'
    }
  }, [content])

  const loadContent = async () => {
    setIsLoading(true)
    try {
      console.log("Loading content with ID:", params.id)
      
      // Import and use server action directly
      const { content: contentData, error } = await getContentById(params.id as string)
      
      if (error) {
        console.error("Error from getContentById:", error)
        toast.error(error)
        return
      }

      if (!contentData) {
        console.error("Content not found for ID:", params.id)
        toast.error("Content not found")
        return
      }

      console.log("Content loaded successfully:", contentData.id)
      console.log("Content campaign_id:", contentData.campaign_id)
      setContent(contentData)
      
      // Convert markdown to HTML for the editor
      const editorContent = markdownToHTML(contentData.text || contentData.content || '');
      
      // Calcular conteos iniciales
      const initialText = contentData.text || contentData.content || '';
      const wordCount = initialText.trim().split(/\s+/).filter((word: string) => word.length > 0).length
      const charCount = initialText.length

      setEditForm({
        title: contentData.title,
        description: contentData.description || '',
        content: contentData.content || '',
        text: contentData.text || '',
        type: contentData.type,
        segment_id: contentData.segment_id || '',
        campaign_id: contentData.campaign_id || '',
        tags: contentData.tags || [],
        word_count: wordCount,
        char_count: charCount,
        performance_rating: contentData.performance_rating,
        status: contentData.status || 'draft' // Load status from content or default to draft
      })
      
      if (editor) {
        // Set content with HTML for proper formatting
        editor.commands.setContent(editorContent);
      }
      
      // Load campaigns after setting the content
      if (contentData.site_id) {
        try {
          console.log("Loading campaigns for site:", contentData.site_id)
          
          // Usar el cliente de Supabase del lado del cliente
          const supabase = createClient()
          const { data: campaignsData, error: campaignsError } = await supabase
            .from("campaigns")
            .select("id, title, description")
            .eq("site_id", contentData.site_id)
            .order("created_at", { ascending: false })
          
          if (campaignsError) {
            console.error("Failed to load campaigns:", campaignsError.message)
          } else if (campaignsData) {
            console.log("Campaigns loaded:", campaignsData.length)
            console.log("First campaign:", campaignsData[0]?.title || "No campaigns found")
            setCampaigns(campaignsData)
          }
        } catch (campaignError) {
          console.error("Error loading campaigns:", campaignError)
        }
        
        // Load segments for the site
        try {
          console.log("Loading segments for site:", contentData.site_id)
          
          // Usar el cliente de Supabase del lado del cliente
          const supabase = createClient()
          const { data: segmentsData, error: segmentsError } = await supabase
            .from("segments")
            .select("id, name")
            .eq("site_id", contentData.site_id)
          
          if (segmentsError) {
            console.error("Failed to load segments:", segmentsError.message)
          } else if (segmentsData) {
            console.log("Segments loaded:", segmentsData.length)
            setSegments(segmentsData)
          }
        } catch (segmentError) {
          console.error("Error loading segments:", segmentError)
        }
      }
    } catch (error) {
      console.error("Unexpected error in loadContent:", error)
      toast.error("Failed to load content")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (editor && content?.text) {
      // Convert markdown to HTML for proper display
      const formattedHTML = markdownToHTML(content.text);
      editor.commands.setContent(formattedHTML);
    }
  }, [content, editor])

  useEffect(() => {
    if (editor) {
      const updateCounts = () => {
        const text = editor.getText()
        const wordCount = text.trim().split(/\s+/).filter((word: string) => word.length > 0).length
        const charCount = text.length
        
        setEditForm(prev => ({
          ...prev,
          word_count: wordCount,
          char_count: charCount,
          content: editor.getHTML(), // Store the HTML representation
          text: editor.getText() // Store the plain text for word counting
        }))
      }

      // Actualizar conteos inicialmente
      updateCounts()

      // Suscribirse a cambios en el editor
      editor.on('update', updateCounts)
      
      // Limpiar suscripción al desmontar
      return () => {
        editor.off('update', updateCounts)
      }
    }
  }, [editor])

  useEffect(() => {
    if (content?.text) {
      const text = content.text
      const wordCount = text.trim().split(/\s+/).filter((word: string) => word.length > 0).length
      const charCount = text.length
      
      setEditForm(prev => ({
        ...prev,
        word_count: wordCount,
        char_count: charCount
      }))
    }
  }, [content])

  const handleSaveChanges = async () => {
    if (!content) return
    
    console.log("Saving with campaign_id:", editForm.campaign_id)
    
    setIsSaving(true)
    try {
      // First update the content
      const result = await updateContent({
        contentId: content.id,
        title: editForm.title,
        description: editForm.description || undefined,
        type: content.type,
        segment_id: editForm.segment_id === '' ? null : editForm.segment_id,
        campaign_id: editForm.campaign_id === '' ? null : editForm.campaign_id,
        tags: editForm.tags.length > 0 ? editForm.tags : null,
        content: editForm.content || undefined,
        text: editForm.text || undefined,
        performance_rating: editForm.performance_rating
      })
      
      if (result.error) {
        toast.error(result.error)
        return
      }
      
      // Then update the status if it has changed
      if (content.status !== editForm.status) {
        const statusResult = await updateContentStatus({
          contentId: content.id,
          status: editForm.status as any
        })
        
        if (statusResult.error) {
          toast.error(statusResult.error)
          return
        }
      }
      
      console.log("Content saved successfully with campaign_id:", result.content?.campaign_id)
      setIsEditing(false)
      toast.success("Content updated successfully")
      loadContent()
    } catch (error) {
      console.error("Error updating content:", error)
      toast.error("Failed to update content")
    } finally {
      setIsSaving(false)
    }
  }

  const handleAiAction = async (action: string) => {
    setIsAiProcessing(true)
    try {
      // Prepare the content for AI processing
      const prepareContentForAi = (content: string) => {
        // Convert HTML breaks back to newlines for the AI to process
        return content.replace(/<br\s*\/?>/gi, '\n').replace(/<p>/gi, '').replace(/<\/p>/gi, '\n\n');
      };
      
      const aiContent = prepareContentForAi(editor?.getHTML() || '');
      
      // Here we would integrate with the AI service
      // For now, we'll just simulate a delay
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      switch (action) {
        case 'improve':
          if (editor) {
            editor.commands.insertContent('\n\n---\n\n*Content improved by AI*')
          }
          break
        case 'expand':
          if (editor) {
            editor.commands.insertContent('\n\n---\n\n*Content expanded by AI*')
          }
          break
        case 'style':
          if (editor) {
            editor.commands.insertContent('\n\n---\n\n*Style improved by AI*')
          }
          break
        case 'summarize':
          if (editor) {
            editor.commands.insertContent('\n\n---\n\n*Content summarized by AI*')
          }
          break
        default:
          break
      }
      
      toast.success("AI action completed successfully")
    } catch (error) {
      console.error("Error processing AI action:", error)
      toast.error("Failed to process AI action")
    } finally {
      setIsAiProcessing(false)
    }
  }

  const generatePromptFromStyle = () => {
    const prompts = []
    
    // Tone
    if (contentStyle.tone < 20) prompts.push("very formal and professional tone")
    else if (contentStyle.tone > 80) prompts.push("very casual and conversational tone")
    else prompts.push("balanced and approachable tone")

    // Complexity
    if (contentStyle.complexity < 20) prompts.push("very simple and clear language")
    else if (contentStyle.complexity > 80) prompts.push("very detailed and technical language")
    else prompts.push("moderate complexity")

    // Creativity
    if (contentStyle.creativity < 20) prompts.push("very traditional and conventional approach")
    else if (contentStyle.creativity > 80) prompts.push("very innovative and creative approach")
    else prompts.push("balanced creativity")

    // Persuasiveness
    if (contentStyle.persuasiveness < 20) prompts.push("purely informative and educational focus")
    else if (contentStyle.persuasiveness > 80) prompts.push("highly persuasive and compelling focus")
    else prompts.push("balanced informative and persuasive approach")

    // Target Audience
    if (contentStyle.targetAudience < 20) prompts.push("very general audience")
    else if (contentStyle.targetAudience > 80) prompts.push("very specific target audience")
    else prompts.push("balanced audience focus")

    // Engagement
    if (contentStyle.engagement < 20) prompts.push("highly professional and straightforward")
    else if (contentStyle.engagement > 80) prompts.push("highly engaging and interactive")
    else prompts.push("moderately engaging")

    // Size
    if (contentStyle.size < 20) prompts.push("very concise and brief")
    else if (contentStyle.size > 80) prompts.push("very comprehensive and detailed")
    else prompts.push("moderate length")

    return `Write content with ${prompts.join(", ")}.`
  }

  if (isLoading) {
    return <ContentSkeleton />
  }

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-none">
          <MenuBar editor={editor} onSave={handleSaveChanges} isSaving={isSaving} onDelete={handleDeleteContent} />
        </div>
        <div className="flex-1 overflow-auto">
          <div className="p-4 h-full flex flex-col">
            <EditorContent editor={editor} className="prose prose-sm dark:prose-invert max-w-none flex-1" />
          </div>
        </div>
      </div>

      {/* AI Assistant Panel */}
      <div className="w-80 border-l bg-muted/30 flex flex-col h-full">
        <Tabs defaultValue="ai" className="flex flex-col h-full">
          {/* Tabs Header */}
          <div className="h-[71px] border-b flex items-center justify-center px-4">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="ai">
                <Cpu className="h-4 w-4 mr-2" />
                AI Assistant
              </TabsTrigger>
              <TabsTrigger value="details">
                <FileText className="h-4 w-4 mr-2" />
                Details
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tabs Content */}
          <div className="flex-1 overflow-hidden">
            <TabsContent value="ai" className="h-full mt-0">
              <div className="flex flex-col h-full">
                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-6">
                    {/* Quick Actions Section */}
                    <div className="space-y-2">
                      <Label className="text-base font-semibold">Quick Actions</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setAiPrompt(generatePromptFromStyle())
                            handleAiAction('improve')
                          }}
                          disabled={isAiProcessing}
                        >
                          <Sparkles className="h-4 w-4 mr-2" />
                          Improve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setAiPrompt(generatePromptFromStyle())
                            handleAiAction('expand')
                          }}
                          disabled={isAiProcessing}
                        >
                          <PlusCircle className="h-4 w-4 mr-2" />
                          Expand
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setAiPrompt(generatePromptFromStyle())
                            handleAiAction('style')
                          }}
                          disabled={isAiProcessing}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Style
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setAiPrompt(generatePromptFromStyle())
                            handleAiAction('summarize')
                          }}
                          disabled={isAiProcessing}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Summarize
                        </Button>
                      </div>
                    </div>

                    {/* Content Style Controls */}
                    <Card className="border-none bg-muted/30">
                      <CardContent className="p-0">
                        <Collapsible defaultOpen>
                          <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                              Style Controls
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="px-4 pb-4">
                            <div className="space-y-6">
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <Label className="text-sm font-medium">Tone</Label>
                                  <Badge variant="secondary" className="text-xs">
                                    {getToneLabel(contentStyle.tone)}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-base text-muted-foreground">🧐</span>
                                  <Slider
                                    value={[contentStyle.tone]}
                                    onValueChange={([value]) => setContentStyle(prev => ({ ...prev, tone: value }))}
                                    max={100}
                                    step={1}
                                    className="w-full"
                                  />
                                  <span className="text-base text-muted-foreground">😊</span>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <Label className="text-sm font-medium">Complexity</Label>
                                  <Badge variant="secondary" className="text-xs">
                                    {getComplexityLabel(contentStyle.complexity)}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-base text-muted-foreground">📝</span>
                                  <Slider
                                    value={[contentStyle.complexity]}
                                    onValueChange={([value]) => setContentStyle(prev => ({ ...prev, complexity: value }))}
                                    max={100}
                                    step={1}
                                    className="w-full"
                                  />
                                  <span className="text-base text-muted-foreground">📚</span>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <Label className="text-sm font-medium">Creativity</Label>
                                  <Badge variant="secondary" className="text-xs">
                                    {getCreativityLabel(contentStyle.creativity)}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-base text-muted-foreground">📋</span>
                                  <Slider
                                    value={[contentStyle.creativity]}
                                    onValueChange={([value]) => setContentStyle(prev => ({ ...prev, creativity: value }))}
                                    max={100}
                                    step={1}
                                    className="w-full"
                                  />
                                  <span className="text-base text-muted-foreground">🎨</span>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <Label className="text-sm font-medium">Persuasiveness</Label>
                                  <Badge variant="secondary" className="text-xs">
                                    {getPersuasivenessLabel(contentStyle.persuasiveness)}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-base text-muted-foreground">ℹ️</span>
                                  <Slider
                                    value={[contentStyle.persuasiveness]}
                                    onValueChange={([value]) => setContentStyle(prev => ({ ...prev, persuasiveness: value }))}
                                    max={100}
                                    step={1}
                                    className="w-full"
                                  />
                                  <span className="text-base text-muted-foreground">🔥</span>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <Label className="text-sm font-medium">Target Audience</Label>
                                  <Badge variant="secondary" className="text-xs">
                                    {getTargetAudienceLabel(contentStyle.targetAudience)}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-base text-muted-foreground">👥</span>
                                  <Slider
                                    value={[contentStyle.targetAudience]}
                                    onValueChange={([value]) => setContentStyle(prev => ({ ...prev, targetAudience: value }))}
                                    max={100}
                                    step={1}
                                    className="w-full"
                                  />
                                  <span className="text-base text-muted-foreground">👤</span>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <Label className="text-sm font-medium">Engagement</Label>
                                  <Badge variant="secondary" className="text-xs">
                                    {getEngagementLabel(contentStyle.engagement)}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-base text-muted-foreground">👔</span>
                                  <Slider
                                    value={[contentStyle.engagement]}
                                    onValueChange={([value]) => setContentStyle(prev => ({ ...prev, engagement: value }))}
                                    max={100}
                                    step={1}
                                    className="w-full"
                                  />
                                  <span className="text-base text-muted-foreground">🤩</span>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <Label className="text-sm font-medium">Size</Label>
                                  <Badge variant="secondary" className="text-xs">
                                    {getSizeLabel(contentStyle.size)}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-base text-muted-foreground">📄</span>
                                  <Slider
                                    value={[contentStyle.size]}
                                    onValueChange={([value]) => setContentStyle(prev => ({ ...prev, size: value }))}
                                    max={100}
                                    step={1}
                                    className="w-full"
                                  />
                                  <span className="text-base text-muted-foreground">📜</span>
                                </div>
                              </div>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </CardContent>
                    </Card>

                    {/* Prompts Section */}
                    <Card className="border-none bg-muted/30">
                      <CardContent className="p-0">
                        <Collapsible defaultOpen>
                          <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                              Prompts
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="px-4 pb-4">
                            <div className="space-y-6">
                              {/* What I'm Good At */}
                              <div className="space-y-2">
                                <Label className="text-sm font-medium">What I'm Good At</Label>
                                <Textarea
                                  placeholder="List your key strengths, expertise areas, and what you're known for..."
                                  className="min-h-[100px]"
                                  value={expertise}
                                  onChange={(e) => setExpertise(e.target.value)}
                                />
                              </div>

                              {/* Topics I'm Interested In */}
                              <div className="space-y-2">
                                <Label className="text-sm font-medium">Topics I'm Interested In</Label>
                                <Textarea
                                  placeholder="List topics, industries, or areas you're passionate about..."
                                  className="min-h-[100px]"
                                  value={interests}
                                  onChange={(e) => setInterests(e.target.value)}
                                />
                              </div>

                              {/* Topics to Avoid */}
                              <div className="space-y-2">
                                <Label className="text-sm font-medium">Topics to Avoid</Label>
                                <Textarea
                                  placeholder="List topics, industries, or areas you want to avoid..."
                                  className="min-h-[100px]"
                                  value={topicsToAvoid}
                                  onChange={(e) => setTopicsToAvoid(e.target.value)}
                                />
                              </div>

                              {/* AI Prompt */}
                              <div className="space-y-2">
                                <Label className="text-sm font-medium">AI Prompt</Label>
                                <Textarea
                                  value={aiPrompt}
                                  onChange={(e) => setAiPrompt(e.target.value)}
                                  placeholder="Describe what you want the AI to do..."
                                  className="min-h-[100px]"
                                />
                              </div>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </CardContent>
                    </Card>
                  </div>
                </ScrollArea>
                
                {/* Fixed Footer with Generate Content button */}
                <div className="border-t p-4 bg-background">
                  <Button 
                    className="w-full" 
                    size="lg" 
                    disabled={isAiProcessing}
                    onClick={() => {
                      setAiPrompt(generatePromptFromStyle())
                      handleAiAction('generate')
                    }}
                  >
                    <Cpu className="h-5 w-5 mr-2" />
                    Generate Content
                  </Button>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="details" className="h-full mt-0">
              <div className="flex flex-col h-full">
                <ScrollArea className="h-full">
                  <div className="p-5 space-y-6">
                    {/* Status and Performance Card */}
                    <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
                      <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                        Status and Performance
                      </h3>
                      
                      <div className="space-y-5">
                        <div className="space-y-2.5">
                          <Label className="flex items-center gap-2">
                            <BarChart className="h-4 w-4 text-muted-foreground" />
                            Performance Rating
                          </Label>
                          <div className="h-12 py-2">
                            <StarRating 
                              rating={editForm.performance_rating} 
                              onRatingChange={(rating) => {
                                setEditForm(prev => ({ ...prev, performance_rating: rating }));
                                // Save immediately when rating changes
                                updateContent({
                                  contentId: content.id,
                                  title: editForm.title,
                                  description: editForm.description || undefined,
                                  type: content.type,
                                  segment_id: editForm.segment_id === '' ? null : editForm.segment_id,
                                  campaign_id: editForm.campaign_id === '' ? null : editForm.campaign_id,
                                  tags: editForm.tags.length > 0 ? editForm.tags : null,
                                  text: editForm.text || undefined,
                                  performance_rating: rating
                                }).then(() => {
                                  toast.success("Performance rating updated");
                                }).catch(error => {
                                  console.error("Error updating rating:", error);
                                  toast.error("Failed to update rating");
                                });
                              }}
                              readonly={false}
                              size="lg"
                              className="w-full justify-around"
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-2.5">
                          <Label className="flex items-center gap-2">
                            <ActivityIcon className="h-4 w-4 text-muted-foreground" />
                            Status
                          </Label>
                          <Select
                            value={editForm.status}
                            onValueChange={(value) => setEditForm(prev => ({ 
                              ...prev, 
                              status: value
                            }))}
                          >
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="review">In Review</SelectItem>
                              <SelectItem value="approved">Approved</SelectItem>
                              <SelectItem value="published">Published</SelectItem>
                              <SelectItem value="archived">Archived</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    
                    {/* Basic Information Card */}
                    <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
                      <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                        Basic Information
                      </h3>
                      
                      <div className="space-y-5">
                        <div className="space-y-2.5">
                          <Label className="flex items-center gap-2">
                            <Type className="h-4 w-4 text-muted-foreground" />
                            Title
                          </Label>
                          <Input
                            value={editForm.title}
                            onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="Enter title"
                            className="h-11"
                          />
                        </div>
                        <div className="space-y-2.5">
                          <Label className="flex items-center gap-2">
                            <TextIcon className="h-4 w-4 text-muted-foreground" />
                            Description
                          </Label>
                          <Textarea
                            value={editForm.description}
                            onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Enter description"
                            className="min-h-[100px] resize-none"
                          />
                        </div>
                        <div className="space-y-2.5">
                          <Label className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            Content Type
                          </Label>
                          <Input
                            value={getContentTypeName(editForm.type)}
                            disabled
                            className="bg-muted h-11"
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Association Card */}
                    <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
                      <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                        Associations
                      </h3>
                      
                      <div className="space-y-5">
                        <div className="space-y-2.5">
                          <Label className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            Segment
                          </Label>
                          <Select
                            value={editForm.segment_id || "none"}
                            onValueChange={(value) => setEditForm(prev => ({ 
                              ...prev, 
                              segment_id: value === "none" ? "" : value 
                            }))}
                          >
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder="Select a segment" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No segment</SelectItem>
                              {segments.map(segment => (
                                <SelectItem key={segment.id} value={segment.id}>
                                  {segment.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2.5">
                          <Label className="flex items-center gap-2">
                            <Target className="h-4 w-4 text-muted-foreground" />
                            Campaign
                          </Label>
                          <Select
                            value={editForm.campaign_id || "none"}
                            onValueChange={(value) => setEditForm(prev => ({ 
                              ...prev, 
                              campaign_id: value === "none" ? "" : value 
                            }))}
                          >
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder="Select a campaign" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No campaign</SelectItem>
                              {campaigns.map(campaign => (
                                <SelectItem key={campaign.id} value={campaign.id}>
                                  {campaign.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2.5">
                          <Label className="flex items-center gap-2">
                            <Tag className="h-4 w-4 text-muted-foreground" />
                            Tags
                          </Label>
                          <div className="flex flex-wrap gap-2">
                            {editForm.tags.map((tag, index) => (
                              <Badge key={index} variant="secondary" className="px-3 py-1 text-xs font-medium bg-gray-100/20 text-gray-700 dark:text-gray-300 hover:bg-gray-200/20 transition-colors border border-gray-300/30">
                                {tag}
                                <button
                                  onClick={() => setEditForm(prev => ({
                                    ...prev,
                                    tags: prev.tags.filter((_, i) => i !== index)
                                  }))}
                                  className="ml-1 hover:text-destructive"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                            {editForm.tags.length === 0 && (
                              <span className="text-muted-foreground text-sm">No tags assigned</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <Input
                              placeholder="Enter tag"
                              className="flex-1 h-11"
                              id="new-tag-input"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const input = e.currentTarget;
                                  const newTag = input.value.trim();
                                  if (newTag) {
                                    setEditForm(prev => ({
                                      ...prev,
                                      tags: [...prev.tags, newTag]
                                    }));
                                    input.value = '';
                                  }
                                  e.preventDefault();
                                }
                              }}
                            />
                            <Button
                              variant="outline"
                              className="h-11 whitespace-nowrap"
                              onClick={() => {
                                const input = document.getElementById('new-tag-input') as HTMLInputElement;
                                const newTag = input.value.trim();
                                if (newTag) {
                                  setEditForm(prev => ({
                                    ...prev,
                                    tags: [...prev.tags, newTag]
                                  }));
                                  input.value = '';
                                }
                              }}
                            >
                              <PlusCircle className="h-4 w-4 mr-2" />
                              Add Tag
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Content Statistics Card */}
                    <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
                      <div className="space-y-5">
                        <div className="space-y-2.5">
                          <Label className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            Content Statistics
                          </Label>
                          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-md">
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-muted-foreground">Characters</span>
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">{editForm.char_count.toLocaleString() || 0}</span>
                              </div>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-muted-foreground">Words</span>
                              <div className="flex items-center gap-2">
                                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">{editForm.word_count.toLocaleString() || 0}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
} 