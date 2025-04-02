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
import { updateContent } from "../actions"
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
  ParagraphIcon
} from "@/app/components/ui/icons"
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
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

const MenuBar = ({ editor, onSave, isSaving }: { editor: any, onSave: () => void, isSaving: boolean }) => {
  if (!editor) {
    return null
  }

  return (
    <div className="border-b p-2 flex flex-wrap gap-1 h-[71px] items-center justify-between">
      <div className="flex items-center gap-1">
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
      </div>
      <Button 
        variant="default" 
        size="sm"
        onClick={onSave}
        disabled={isSaving}
        className="min-w-[180px]"
      >
        {isSaving ? (
          <>Saving...</>
        ) : (
          <>
            <Save className="h-4 w-4 mr-2" />
            Save
          </>
        )}
      </Button>
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
            <div className="h-8 bg-muted animate-pulse rounded w-full"></div>
          </div>
          <div className="space-y-3">
            <div className="h-4 bg-muted animate-pulse rounded w-1/2"></div>
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
    content_type: '',
    segment_id: '',
    tags: [] as string[],
    word_count: 0,
    char_count: 0
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
      StarterKit,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
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
  })

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
      const result = await fetch(`/api/content/${params.id}`)
      const data = await result.json()
      
      if (data.error) {
        toast.error(data.error)
        return
      }

      setContent(data)
      
      // Calcular conteos iniciales
      const initialText = data.text || data.content || ''
      const wordCount = initialText.trim().split(/\s+/).filter((word: string) => word.length > 0).length
      const charCount = initialText.length

      setEditForm({
        title: data.title,
        description: data.description || '',
        content: data.content || '',
        text: data.text || '',
        content_type: data.content_type,
        segment_id: data.segment_id || '',
        tags: data.tags || [],
        word_count: wordCount,
        char_count: charCount
      })
      
      if (editor) {
        editor.commands.setContent(data.text || data.content || '')
      }
    } catch (error) {
      console.error("Error loading content:", error)
      toast.error("Failed to load content")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (editor && content?.text) {
      editor.commands.setContent(content.text)
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
          char_count: charCount
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
    
    setIsSaving(true)
    try {
      const result = await updateContent({
        contentId: content.id,
        title: editForm.title,
        description: editForm.description || undefined,
        content_type: content.content_type,
        segment_id: editForm.segment_id === '' ? null : editForm.segment_id,
        tags: editForm.tags.length > 0 ? editForm.tags : null,
        content: editForm.content || undefined,
        text: editForm.text || undefined
      })
      
      if (result.error) {
        toast.error(result.error)
        return
      }
      
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
          <MenuBar editor={editor} onSave={handleSaveChanges} isSaving={isSaving} />
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
          <div className="h-[71px] flex items-center justify-center border-b">
            <TabsList className="inline-flex rounded-none border-b-0">
              <TabsTrigger value="ai" className="rounded-none">
                <Wand2 className="h-4 w-4 mr-2" />
                AI Assistant
              </TabsTrigger>
              <TabsTrigger value="details" className="rounded-none">
                <FileText className="h-4 w-4 mr-2" />
                Details
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tabs Content */}
          <div className="flex-1 overflow-hidden">
            <TabsContent value="ai" className="h-full mt-0">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-6">
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
                </div>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="details" className="h-full mt-0">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        value={editForm.title}
                        onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Enter title"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        value={editForm.description}
                        onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Enter description"
                        className="min-h-[100px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Content Type</Label>
                      <Input
                        value={editForm.content_type}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Segment</Label>
                      <Input
                        value={editForm.segment_id}
                        onChange={(e) => setEditForm(prev => ({ ...prev, segment_id: e.target.value }))}
                        placeholder="Enter segment ID"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tags</Label>
                      <div className="flex flex-wrap gap-2">
                        {editForm.tags.map((tag, index) => (
                          <Badge key={index} variant="secondary">
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newTag = window.prompt('Enter new tag')
                            if (newTag) {
                              setEditForm(prev => ({
                                ...prev,
                                tags: [...prev.tags, newTag]
                              }))
                            }
                          }}
                        >
                          <PlusCircle className="h-4 w-4 mr-2" />
                          Add Tag
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-base font-semibold">Content Information</Label>
                      <div className="grid grid-cols-2 gap-4 p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{editForm.char_count || 0} characters</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{editForm.word_count || 0} words</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
} 