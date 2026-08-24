"use client"

import React, { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { getRecordById, updateRecord, deleteRecord, RecordItem } from "../actions"
import { toast } from "sonner"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { ToggleGroup, ToggleGroupItem } from "@/app/components/ui/toggle-group"
import { 
  Loader, 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Quote, 
  Code, 
  Heading1, 
  Save,
  Link as LinkIcon,
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Undo,
  Redo,
  ChevronDown,
  Trash2,
  Maximize,
  Type as ParagraphIcon,
  PanelRightClose,
  PanelRightOpen
} from "@/app/components/ui/icons"
import { Skeleton } from "@/app/components/ui/skeleton"
import { RecordDynamicForm } from "./components/RecordDynamicForm"
import { InsightsTab } from "./components/InsightsTab"
import { RelationsTab } from "./components/RelationsTab"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
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

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import HardBreak from '@tiptap/extension-hard-break'
import LinkExtension from '@tiptap/extension-link'
import ImageExtension from '@tiptap/extension-image'
import "@/app/content/styles/editor.css"
import { markdownToHTML } from "@/app/content/utils"

const htmlToMarkdown = (html: string): string => {
  if (!html) return '';
  try {
    const tempElement = document.createElement('div');
    tempElement.innerHTML = html;
    const nodeToMarkdown = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        const children = Array.from(element.childNodes).map(nodeToMarkdown).join('');
        switch (element.tagName.toLowerCase()) {
          case 'h1': return `# ${children}\n\n`;
          case 'h2': return `## ${children}\n\n`;
          case 'h3': return `### ${children}\n\n`;
          case 'p': return `${children}\n\n`;
          case 'strong': case 'b': return `**${children}**`;
          case 'em': case 'i': return `*${children}*`;
          case 'ul': return `${children}\n`;
          case 'ol': return `${children}\n`;
          case 'li': return `- ${children}\n`;
          case 'blockquote': return `> ${children}\n\n`;
          case 'code': return `\`${children}\``;
          case 'pre': return `\`\`\`\n${children}\n\`\`\`\n\n`;
          case 'br': return '\n';
          default: return children;
        }
      }
      return '';
    };
    return nodeToMarkdown(tempElement).replace(/\n{3,}/g, '\n\n').trim();
  } catch (e) {
    return html;
  }
}

const RecordDetailSkeleton = () => {
  return (
    <div className="flex h-[calc(100vh-64px)] min-h-0 bg-background">
      {/* Left side: Main Content / Form */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-border bg-muted/10 relative">
        {/* Formatting Toolbar Skeleton */}
        <div className="border-b pl-[20px] pr-4 py-2 flex items-center h-[71px] bg-background gap-2 overflow-x-auto">
          <Skeleton className="h-9 w-24 rounded-md" />
          <div className="w-px h-6 bg-border mx-1" />
          <div className="flex items-center gap-1">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-16 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="p-4 md:p-8 max-w-4xl mx-auto h-full space-y-8">
            <div className="space-y-4">
              <Skeleton className="h-12 w-3/4 mb-4" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
            
            <div className="space-y-6 mt-12">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-24 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side: Insights & Relations Skeleton */}
      <div className="w-[400px] flex-none flex flex-col bg-background">
        <div className="flex-1 flex flex-col min-h-0">
          <div className="border-b px-4 h-[71px] flex items-center justify-center gap-2">
            <Skeleton className="h-10 w-full rounded-md" />
          </div>

          <div className="flex-1 p-4 space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function RecordDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { t } = useLocalization()
  
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id

  const [record, setRecord] = useState<RecordItem | null>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [relationsData, setRelationsData] = useState<Record<string, any>>({})
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState("draft")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const [activeRightTab, setActiveRightTab] = useState<"insights" | "relations">("insights")

  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true)

  const [isEditorFocused, setIsEditorFocused] = useState(false)
  const [isToolbarHovered, setIsToolbarHovered] = useState(false)
  const [isHeadingDropdownOpen, setIsHeadingDropdownOpen] = useState(false)
  const blurTimeoutRef = React.useRef<NodeJS.Timeout>()

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        hardBreak: false,
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      HardBreak.configure({
        keepMarks: true,
        HTMLAttributes: {
          class: 'markdown-line-break',
        },
      }),
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline cursor-pointer',
        },
      }),
      ImageExtension.configure({
        inline: true,
        allowBase64: true,
      }),
    ],
    content: '',
    onFocus: () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current)
      setIsEditorFocused(true)
    },
    onBlur: () => {
      blurTimeoutRef.current = setTimeout(() => {
        setIsEditorFocused(false)
      }, 150)
    },
    onUpdate: ({ editor }) => {
      setDescription(htmlToMarkdown(editor.getHTML()))
      setHasChanges(true)
    },
    editorProps: {
      attributes: {
        class: 'prose-lg prose-headings:my-4 prose-p:my-3 prose-ul:my-3 outline-none !min-h-0 flex-1',
      },
    },
  })

  // Dispatch breadcrumb update and listen for save
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("breadcrumb:update", {
        detail: {
          title: title || (isLoading ? (t("common.loading") || "Loading...") : "Record"),
          parentTitle: "Records",
          parentPath: "/records",
        },
      })
    )
  }, [title, isLoading])

  useEffect(() => {
    const handleSaveEvent = () => {
      handleSave()
    }
    window.addEventListener("records:save", handleSaveEvent)
    return () => window.removeEventListener("records:save", handleSaveEvent)
  }, [title, description, formData, relationsData, record])

  useEffect(() => {
    if (id) {
      loadRecord(id)
    }
  }, [id])

  const loadRecord = async (recordId: string) => {
    setIsLoading(true)
    const { record, error } = await getRecordById(recordId)
    if (error) {
      toast.error(error)
      router.push("/records")
    } else if (record) {
      setRecord(record)
      setTitle(record.title || "")
      setDescription(record.description || "")
      setStatus(record.status || "draft")
      if (editor) {
        editor.commands.setContent(markdownToHTML(record.description || ""))
      }
      setFormData(record.data || {})
      setRelationsData(record.relations || {})
    }
    setIsLoading(false)
  }

  // Effect to update editor content when it initializes if description was loaded before
  useEffect(() => {
    if (editor && record && !editor.isFocused && editor.isEmpty) {
      editor.commands.setContent(markdownToHTML(record.description || ""))
    }
  }, [editor, record])

  const handleSave = async () => {
    if (!record) return
    setIsSaving(true)
    const updates = {
      title,
      description,
      status,
      data: formData,
      relations: relationsData
    }
    const { error } = await updateRecord(record.id, updates)
    if (error) {
      toast.error(error)
    } else {
      toast.success("Record saved")
      setHasChanges(false)
      // trigger embedding generation asynchronously
      fetch("/api/records/embed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ record_id: record.id })
      }).catch(err => console.error("Failed to generate embedding", err))
    }
    setIsSaving(false)
  }

  const handleDelete = async () => {
    if (!record) return
    const { error } = await deleteRecord(record.id)
    if (error) {
      toast.error(error)
    } else {
      toast.success("Record deleted")
      router.push("/records")
    }
  }

  const handleChange = (field: string, value: any, type: "field" | "relation") => {
    if (type === "field") {
      setFormData(prev => ({ ...prev, [field]: value }))
    } else {
      setRelationsData(prev => ({ ...prev, [field]: value }))
    }
    setHasChanges(true)
  }

  if (isLoading) {
    return <RecordDetailSkeleton />
  }

  if (!record) return null

  const templateFields = record.category?.template_fields || []

  return (
    <div className="flex h-[calc(100vh-64px)] min-h-0 bg-background">
      {/* Left side: Main Content / Form */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-border bg-muted/10 relative">
        {/* Formatting Toolbar */}
        <div className="border-b pl-[20px] pr-4 py-2 flex items-center h-[71px] bg-background gap-1 overflow-x-auto">
          <Button
            variant="secondary"
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="flex items-center gap-2 mr-2"
          >
            {isSaving ? <Loader className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t("common.save") || "Save"}
          </Button>
          <div className="w-px h-6 bg-border mx-1" />
          {editor ? (
            <>
              <div 
                className={`flex items-center transition-all duration-300 overflow-hidden ${
                  isEditorFocused || isToolbarHovered || isHeadingDropdownOpen ? 'max-w-[1000px] opacity-100' : 'max-w-0 opacity-0'
                }`}
                onMouseEnter={() => setIsToolbarHovered(true)}
                onMouseLeave={() => setIsToolbarHovered(false)}
              >
                <div className="flex items-center gap-1 flex-nowrap pr-2">
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

              <DropdownMenu onOpenChange={setIsHeadingDropdownOpen}>
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
                </DropdownMenuContent>
              </DropdownMenu>

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
              
              <div className="w-px h-6 bg-border mx-1" />

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
              </div>

              <div className={`w-px h-6 bg-border mx-1 transition-all duration-300 ${
                isEditorFocused || isToolbarHovered || isHeadingDropdownOpen ? 'opacity-100' : 'opacity-0 w-0 mx-0'
              }`} />
              
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
                    <AlertDialogTitle>Delete Record</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this record? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction className="!bg-destructive hover:!bg-destructive/90 !text-destructive-foreground" onClick={handleDelete}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : (
            <div className="text-muted-foreground text-sm">Editor loading...</div>
          )}

          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
            className="ml-2 text-muted-foreground hover:text-foreground"
          >
            {isRightPanelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </Button>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="p-4 md:p-8 max-w-4xl mx-auto h-full">
            {/* If no template fields, just show a simple markdown-like area */}
            {templateFields.length === 0 ? (
              <div className="flex flex-col h-full space-y-4">
                <Input 
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); setHasChanges(true); }}
                  placeholder="Record Title"
                  className="text-4xl font-bold border-none px-0 shadow-none focus-visible:ring-0 h-auto flex-none"
                />
                <EditorContent editor={editor} className="flex-1 flex flex-col min-h-0" />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                   <Input 
                    value={title}
                    onChange={(e) => { setTitle(e.target.value); setHasChanges(true); }}
                    placeholder="Record Title"
                    className="text-4xl font-bold border-none px-0 shadow-none focus-visible:ring-0 h-auto"
                  />
                </div>
                
                <RecordDynamicForm 
                  fields={templateFields} 
                  formData={formData} 
                  relationsData={relationsData} 
                  status={status}
                  record={record}
                  onChange={handleChange} 
                  onStatusChange={(val) => { setStatus(val); setHasChanges(true); }}
                />

                <div className="text-lg text-muted-foreground border-none px-0 shadow-none focus-visible:ring-0 h-auto pt-4">
                  <EditorContent editor={editor} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right side: Insights & Relations */}
      {isRightPanelOpen && (
        <div className="w-[400px] flex-none flex flex-col bg-background border-l border-border">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="border-b px-4 h-[71px] flex items-center justify-center">
              <ToggleGroup 
                type="single" 
                value={activeRightTab} 
                onValueChange={(val: string) => val && setActiveRightTab(val as "insights" | "relations")}
                className="w-full"
              >
                <ToggleGroupItem value="insights" className="flex-1" aria-label="Insights">
                  Insights
                </ToggleGroupItem>
                <ToggleGroupItem value="relations" className="flex-1" aria-label="Relations">
                  Relations
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4">
                {activeRightTab === "insights" && (
                  <InsightsTab 
                    fields={templateFields} 
                    formData={formData} 
                    description={description}
                    record={record}
                    relationsData={relationsData}
                  />
                )}
                {activeRightTab === "relations" && (
                  <RelationsTab 
                    fields={templateFields.filter(f => f.type === 'relation')}
                    relationsData={relationsData}
                    recordId={record.id}
                  />
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  )
}