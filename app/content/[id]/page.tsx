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
  Trash2,
  Mail,
  FileVideo,
  PlayCircle,
  Globe,
  LayoutGrid,
  Maximize // Add Maximize icon for teleprompter
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

const MenuBar = ({ 
  editor, 
  instructionsEditor, 
  onSave, 
  isSaving, 
  onDelete, 
  activeTab,
  hasChanges,
  contentType,
  onTeleprompter
}: { 
  editor: any, 
  instructionsEditor: any,
  onSave: () => void, 
  isSaving: boolean,
  onDelete: () => void,
  activeTab: 'copy' | 'instructions',
  hasChanges: boolean,
  contentType?: string,
  onTeleprompter?: () => void
}) => {
  const currentEditor = activeTab === 'copy' ? editor : instructionsEditor
  
  if (!currentEditor) {
    return null
  }

  return (
    <div className="border-b pl-[20px] pr-4 py-2 flex flex-wrap gap-1 h-[71px] items-center justify-between">
      <div className="flex items-center gap-1">
        <Button
          variant="secondary" 
          size="default"
          onClick={onSave}
          disabled={isSaving || !hasChanges}
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
        
        {/* Add Teleprompter button for video content */}
        {contentType === 'video' && (
          <Button
            variant="secondary"
            size="default"
            onClick={onTeleprompter}
            className="flex items-center gap-2 hover:bg-primary/10 transition-all duration-200"
          >
            <Maximize className="h-4 w-4" />
            Teleprompter
          </Button>
        )}
        
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => currentEditor.chain().focus().toggleBold().run()}
          className={currentEditor.isActive('bold') ? 'bg-muted' : ''}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => currentEditor.chain().focus().toggleItalic().run()}
          className={currentEditor.isActive('italic') ? 'bg-muted' : ''}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => currentEditor.chain().focus().toggleBulletList().run()}
          className={currentEditor.isActive('bulletList') ? 'bg-muted' : ''}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => currentEditor.chain().focus().toggleOrderedList().run()}
          className={currentEditor.isActive('orderedList') ? 'bg-muted' : ''}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => currentEditor.chain().focus().toggleBlockquote().run()}
          className={currentEditor.isActive('blockquote') ? 'bg-muted' : ''}
        >
          <Quote className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => currentEditor.chain().focus().toggleCodeBlock().run()}
          className={currentEditor.isActive('codeBlock') ? 'bg-muted' : ''}
        >
          <Code className="h-4 w-4" />
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm"
              className={currentEditor.isActive('heading') ? 'bg-muted' : ''}
            >
              {currentEditor.isActive('heading', { level: 1 }) && <span className="w-4 h-4 inline-flex items-center justify-center font-bold">H1</span>}
              {currentEditor.isActive('heading', { level: 2 }) && <span className="w-4 h-4 inline-flex items-center justify-center font-bold">H2</span>}
              {currentEditor.isActive('heading', { level: 3 }) && <span className="w-4 h-4 inline-flex items-center justify-center font-bold">H3</span>}
              {currentEditor.isActive('heading', { level: 4 }) && <span className="w-4 h-4 inline-flex items-center justify-center text-xs font-bold">H4</span>}
              {currentEditor.isActive('heading', { level: 5 }) && <span className="w-4 h-4 inline-flex items-center justify-center text-xs font-bold">H5</span>}
              {currentEditor.isActive('heading', { level: 6 }) && <span className="w-4 h-4 inline-flex items-center justify-center text-xs font-bold">H6</span>}
              {!currentEditor.isActive('heading') && <ParagraphIcon className="h-4 w-4 text-sm" />}
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => currentEditor.chain().focus().setParagraph().run()}>
              <ParagraphIcon className="h-4 w-4 mr-2" />
              Paragraph
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => currentEditor.chain().focus().toggleHeading({ level: 1 }).run()}>
              <span className="w-4 h-4 inline-flex items-center justify-center mr-2 font-bold">H1</span>
              Heading 1
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => currentEditor.chain().focus().toggleHeading({ level: 2 }).run()}>
              <span className="w-4 h-4 inline-flex items-center justify-center mr-2 font-bold">H2</span>
              Heading 2
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => currentEditor.chain().focus().toggleHeading({ level: 3 }).run()}>
              <span className="w-4 h-4 inline-flex items-center justify-center mr-2 font-bold">H3</span>
              Heading 3
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => currentEditor.chain().focus().toggleHeading({ level: 4 }).run()}>
              <span className="w-4 h-4 inline-flex items-center justify-center mr-2 text-xs font-bold">H4</span>
              Heading 4
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => currentEditor.chain().focus().toggleHeading({ level: 5 }).run()}>
              <span className="w-4 h-4 inline-flex items-center justify-center mr-2 text-xs font-bold">H5</span>
              Heading 5
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => currentEditor.chain().focus().toggleHeading({ level: 6 }).run()}>
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
              currentEditor.chain().focus().setLink({ href: url }).run()
            }
          }}
          className={currentEditor.isActive('link') ? 'bg-muted' : ''}
        >
          <LinkIcon className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const url = window.prompt('Enter the image URL')
            if (url) {
              currentEditor.chain().focus().setImage({ src: url }).run()
            }
          }}
        >
          <ImageIcon className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => currentEditor.chain().focus().setTextAlign('left').run()}
          className={currentEditor.isActive({ textAlign: 'left' }) ? 'bg-muted' : ''}
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => currentEditor.chain().focus().setTextAlign('center').run()}
          className={currentEditor.isActive({ textAlign: 'center' }) ? 'bg-muted' : ''}
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => currentEditor.chain().focus().setTextAlign('right').run()}
          className={currentEditor.isActive({ textAlign: 'right' }) ? 'bg-muted' : ''}
        >
          <AlignRight className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => currentEditor.chain().focus().setTextAlign('justify').run()}
          className={currentEditor.isActive({ textAlign: 'justify' }) ? 'bg-muted' : ''}
        >
          <AlignJustify className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => currentEditor.chain().focus().undo().run()}
          disabled={!currentEditor.can().undo()}
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => currentEditor.chain().focus().redo().run()}
          disabled={!currentEditor.can().redo()}
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

// Modificar el componente AiGenerationSkeleton
const AiGenerationSkeleton = () => {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 space-y-6 flex-1">
        <div className="flex items-center space-x-3">
          <div className="h-8 w-8 bg-muted animate-pulse rounded-full"></div>
          <div className="h-6 bg-muted animate-pulse rounded w-40"></div>
        </div>
        
        <div className="space-y-3">
          <div className="h-4 bg-muted animate-pulse rounded w-3/4"></div>
          <div className="h-4 bg-muted animate-pulse rounded w-1/2"></div>
          <div className="h-4 bg-muted animate-pulse rounded w-5/6"></div>
          <div className="h-4 bg-muted animate-pulse rounded w-4/5"></div>
        </div>
        
        <div className="space-y-3">
          <div className="h-4 bg-muted animate-pulse rounded w-2/3"></div>
          <div className="h-4 bg-muted animate-pulse rounded w-3/4"></div>
          <div className="h-4 bg-muted animate-pulse rounded w-1/2"></div>
          <div className="h-4 bg-muted animate-pulse rounded w-4/5"></div>
        </div>
        
        <div className="h-32 bg-muted animate-pulse rounded w-full"></div>
      </div>
      
      {/* Botón esqueleto en el footer */}
      <div className="border-t p-4 bg-background">
        <div className="h-11 bg-primary/20 animate-pulse rounded-md w-full flex items-center justify-center">
          <div className="h-4 w-36 bg-muted animate-pulse rounded"></div>
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

// Full URL with protocol - using same pattern as in chat-service.ts
const API_SERVER_URL = process.env.NEXT_PUBLIC_API_SERVER_URL || process.env.API_SERVER_URL || '';

// Ensure URL has proper protocol and use correct host
const getFullApiUrl = (baseUrl: string) => {
  if (!baseUrl || typeof baseUrl !== 'string') return '';
  
  // Trim any whitespace
  baseUrl = baseUrl.trim();
  
  // If empty after trim, return empty string
  if (!baseUrl) return '';
  
  // Check for invalid IP format (like http://192.168.87.49.64:3001)
  // Common error - when IPs have more than 4 parts
  const ipRegex = /^https?:\/\/(\d+\.\d+\.\d+\.\d+)\.(\d+)/;
  const ipMatch = baseUrl.match(ipRegex);
  if (ipMatch) {
    // Fix the IP format by removing the extra part
    const correctIp = ipMatch[1];
    // Extract the port if present in the original URL
    const portMatch = baseUrl.match(/:(\d+)(\/.*)?$/);
    const port = portMatch ? portMatch[1] : '';
    
    // Reconstruct the URL with the correct IP
    const protocol = baseUrl.startsWith('https://') ? 'https' : 'http';
    console.warn(`Fixed invalid IP format from ${baseUrl} to ${protocol}://${correctIp}${port ? ':' + port : ''}`);
    return `${protocol}://${correctIp}${port ? ':' + port : ''}`;
  }
  
  try {
    // Define apiUrl here
    let apiUrl = baseUrl;
    
    if (baseUrl.startsWith('http://') || baseUrl.startsWith('https://')) {
      // Extract the protocol, host, and port
      const url = new URL(baseUrl);
      const protocol = url.protocol;
      const port = url.port;
      
      // If we're in a browser environment and the baseUrl is using localhost
      if (typeof window !== 'undefined' && url.hostname === 'localhost') {
        // Get the current origin
        const origin = window.location.origin;
        const originUrl = new URL(origin);
        
        // If we're accessing from an IP address instead of localhost
        if (originUrl.hostname !== 'localhost' && /^\d+\.\d+\.\d+\.\d+$/.test(originUrl.hostname)) {
          // Replace localhost with the same IP as the origin
          apiUrl = `${protocol}//${originUrl.hostname}:${port}`;
          console.log(`Replaced localhost with origin IP: ${apiUrl}`);
        }
      }
      
      return apiUrl;
    }
    
    // If it's just a host:port without protocol, add http://
    // Make sure it's a valid host:port format
    if (/^[a-zA-Z0-9][-a-zA-Z0-9.]*\.[a-zA-Z]{2,}(:[0-9]+)?$/.test(baseUrl) || 
        /^localhost(:[0-9]+)?$/.test(baseUrl) ||
        /^\d+\.\d+\.\d+\.\d+(:[0-9]+)?$/.test(baseUrl)) {
      return `http://${baseUrl}`;
    }
    
    // Invalid URL format, return empty string
    console.error(`Invalid URL format: ${baseUrl}`);
    return '';
  } catch (error) {
    console.error(`Error parsing URL ${baseUrl}:`, error);
    return '';
  }
};

// Full URL with protocol
const FULL_API_SERVER_URL = getFullApiUrl(API_SERVER_URL);

// Add new content type icons for more descriptive mapping
const Podcast = ({ className = "", size = 20, ...props }: { className?: string, size?: number, [key: string]: any }) => (
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
      <circle cx="12" cy="12" r="2" />
      <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
    </svg>
  </div>
)

const Newsletter = ({ className = "", size = 20, ...props }: { className?: string, size?: number, [key: string]: any }) => (
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
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22 6 12 13 2 6" />
    </svg>
  </div>
)

const CaseStudy = ({ className = "", size = 20, ...props }: { className?: string, size?: number, [key: string]: any }) => (
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
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  </div>
)

const Whitepaper = ({ className = "", size = 20, ...props }: { className?: string, size?: number, [key: string]: any }) => (
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
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="12" y1="9" x2="8" y2="9" />
    </svg>
  </div>
)

const Infographic = ({ className = "", size = 20, ...props }: { className?: string, size?: number, [key: string]: any }) => (
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
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  </div>
)

const Webinar = ({ className = "", size = 20, ...props }: { className?: string, size?: number, [key: string]: any }) => (
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
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      <circle cx="12" cy="8" r="2" />
    </svg>
  </div>
)

const Ebook = ({ className = "", size = 20, ...props }: { className?: string, size?: number, [key: string]: any }) => (
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
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  </div>
)

const Advertisement = ({ className = "", size = 20, ...props }: { className?: string, size?: number, [key: string]: any }) => (
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
      <path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2z" />
      <path d="M11 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2z" />
      <path d="M19 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2z" />
    </svg>
  </div>
)

const LandingPage = ({ className = "", size = 20, ...props }: { className?: string, size?: number, [key: string]: any }) => (
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
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <rect x="7" y="7" width="3" height="9" />
      <rect x="14" y="7" width="3" height="5" />
    </svg>
  </div>
)

// Function to get content type icon
const getContentTypeIcon = (type: string) => {
  const iconProps = { className: "h-4 w-4" }
  
  switch (type) {
    case "blog_post":
      return <FileText {...iconProps} />
    case "video":
      return <FileVideo {...iconProps} />
    case "podcast":
      return <Podcast {...iconProps} />
    case "social_post":
      return <Globe {...iconProps} />
    case "newsletter":
      return <Newsletter {...iconProps} />
    case "case_study":
      return <CaseStudy {...iconProps} />
    case "whitepaper":
      return <Whitepaper {...iconProps} />
    case "infographic":
      return <Infographic {...iconProps} />
    case "webinar":
      return <Webinar {...iconProps} />
    case "ebook":
      return <Ebook {...iconProps} />
    case "ad":
      return <Advertisement {...iconProps} />
    case "landing_page":
      return <LandingPage {...iconProps} />
    default:
      return <FileText {...iconProps} />
  }
}

export default function ContentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [content, setContent] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    content: '',
    text: '',
    instructions: '',
    type: '',
    segment_id: '',
    campaign_id: '',
    tags: [] as string[],
    word_count: 0,
    char_count: 0,
    performance_rating: null as number | null,
    status: 'draft' // Default status
  })
  const [activeTab, setActiveTab] = useState<'copy' | 'instructions'>('copy')
  const [aiPrompt, setAiPrompt] = useState('')
  const [isAiProcessing, setIsAiProcessing] = useState(false)
  const [editorsReady, setEditorsReady] = useState(false)
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
      if (activeTab === 'copy') {
        setEditForm(prev => ({ 
          ...prev, 
          content: editor.getHTML(),
          text: editor.getText()
        }))
        // Mark that user has made changes only if editors are ready (to avoid initial loading triggering this)
        if (editorsReady) {
          setHasUserMadeChanges(true)
        }
      }
    },
    editorProps: {
      attributes: {
        class: 'prose-lg prose-headings:my-4 prose-p:my-3 prose-ul:my-3',
      },
    },
  })

  const instructionsEditor = useEditor({
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
    onUpdate: ({ editor }) => {
      if (activeTab === 'instructions') {
        setEditForm(prev => ({ 
          ...prev, 
          instructions: editor.getHTML()
        }))
        // Mark that user has made changes only if editors are ready (to avoid initial loading triggering this)
        if (editorsReady) {
          setHasUserMadeChanges(true)
        }
      }
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
      
      // Get content type name for breadcrumb
      const contentTypeName = getContentTypeName(content.type)
      
      // Emit a custom event to update the breadcrumb with content title and type
      const event = new CustomEvent('breadcrumb:update', {
        detail: {
          title: `${content.title} | ${contentTypeName}`,
          path: `/content/${content.id}`,
          section: 'content'
        }
      })
      
      // Ensure event is dispatched after DOM is updated
      setTimeout(() => {
        window.dispatchEvent(event)
        console.log('Breadcrumb update event dispatched:', content.title, 'Type:', contentTypeName)
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
        instructions: contentData.instructions || '',
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

      if (instructionsEditor) {
        // Set instructions content
        const instructionsContent = markdownToHTML(contentData.instructions || '');
        instructionsEditor.commands.setContent(instructionsContent);
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
    if (editor && content && !editor.isFocused) {
      // Convert markdown to HTML for proper display
      const contentText = content.text || content.content || '';
      if (contentText) {
        const formattedHTML = markdownToHTML(contentText);
        editor.commands.setContent(formattedHTML);
      }
    }
    if (instructionsEditor && content && !instructionsEditor.isFocused) {
      // Convert markdown to HTML for proper display
      const instructionsText = content.instructions || '';
      if (instructionsText) {
        const formattedHTML = markdownToHTML(instructionsText);
        instructionsEditor.commands.setContent(formattedHTML);
      }
    }
    
    // Mark editors as ready after a short delay to allow content to settle
    if (editor && instructionsEditor && content && !editorsReady) {
      setTimeout(() => {
        setEditorsReady(true);
      }, 500);
    }
  }, [content, editor, instructionsEditor, editorsReady])

  useEffect(() => {
    if (editor) {
      const updateCounts = () => {
        if (activeTab === 'copy') {
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
  }, [editor, activeTab])

  useEffect(() => {
    if (instructionsEditor) {
      const updateInstructions = () => {
        if (activeTab === 'instructions') {
          setEditForm(prev => ({
            ...prev,
            instructions: instructionsEditor.getHTML()
          }))
        }
      }

      // Suscribirse a cambios en el editor de instructions
      instructionsEditor.on('update', updateInstructions)
      
      // Limpiar suscripción al desmontar
      return () => {
        instructionsEditor.off('update', updateInstructions)
      }
    }
  }, [instructionsEditor, activeTab])

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
      // Convert HTML content back to markdown for storage
      const markdownContent = htmlToMarkdown(editForm.content);
      const markdownInstructions = htmlToMarkdown(editForm.instructions);
      
      // First update the content
      const result = await updateContent({
        contentId: content.id,
        title: editForm.title,
        description: editForm.description || undefined,
        type: content.type,
        segment_id: editForm.segment_id === '' ? null : editForm.segment_id,
        campaign_id: editForm.campaign_id === '' ? null : editForm.campaign_id,
        tags: editForm.tags.length > 0 ? editForm.tags : null,
        content: markdownContent || undefined,
        text: markdownContent || undefined,
        instructions: markdownInstructions || undefined,
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
      // Reset the user changes flag after successful save
      setHasUserMadeChanges(false)
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
      
      const currentEditor = activeTab === 'copy' ? editor : instructionsEditor;
      const aiContent = prepareContentForAi(currentEditor?.getHTML() || '');
      
      // Here we would integrate with the AI service
      // For now, we'll just simulate a delay
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      switch (action) {
        case 'improve':
          if (currentEditor) {
            currentEditor.commands.insertContent('\n\n---\n\n*Content improved by AI*')
          }
          break
        case 'expand':
          if (currentEditor) {
            currentEditor.commands.insertContent('\n\n---\n\n*Content expanded by AI*')
          }
          break
        case 'style':
          if (currentEditor) {
            currentEditor.commands.insertContent('\n\n---\n\n*Style improved by AI*')
          }
          break
        case 'summarize':
          if (currentEditor) {
            currentEditor.commands.insertContent('\n\n---\n\n*Content summarized by AI*')
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

  // Function to convert slider values to API expected string values
  const mapStyleControlsToApi = () => {
    // Map tone value to expected string
    const getToneValue = (value: number) => {
      if (value < 40) return "formal"
      if (value > 60) return "friendly"
      return "neutral"
    }

    // Map complexity value to expected string
    const getComplexityValue = (value: number) => {
      if (value < 33) return "simple"
      if (value > 66) return "advanced"
      return "moderate"
    }

    // Map creativity value to expected string
    const getCreativityValue = (value: number) => {
      if (value < 33) return "factual"
      if (value > 66) return "creative"
      return "balanced"
    }

    // Map persuasiveness value to expected string
    const getPersuasivenessValue = (value: number) => {
      if (value < 33) return "informative"
      if (value > 66) return "persuasive"
      return "balanced"
    }

    // Map target audience value to expected string
    const getTargetAudienceValue = (value: number) => {
      if (value < 50) return "mixed"
      return "specific"
    }

    // Map engagement value to expected string
    const getEngagementValue = (value: number) => {
      if (value < 33) return "professional"
      if (value > 66) return "engaging"
      return "balanced"
    }

    // Map size value to expected string
    const getSizeValue = (value: number) => {
      if (value < 33) return "short"
      if (value > 66) return "long"
      return "medium"
    }

    return {
      tone: getToneValue(contentStyle.tone),
      complexity: getComplexityValue(contentStyle.complexity),
      creativity: getCreativityValue(contentStyle.creativity),
      persuasiveness: getPersuasivenessValue(contentStyle.persuasiveness),
      targetAudience: getTargetAudienceValue(contentStyle.targetAudience),
      engagement: getEngagementValue(contentStyle.engagement),
      size: getSizeValue(contentStyle.size)
    }
  }

  // Add state to track if user has made explicit changes
  const [hasUserMadeChanges, setHasUserMadeChanges] = useState(false)
  
  // Function to check if there are unsaved changes
  const hasUnsavedChanges = () => {
    if (!content || !editorsReady) {
      return false
    }
    
    // Only check for changes in form fields, not editor content
    // Editor content changes are tracked via hasUserMadeChanges
    const titleChanged = editForm.title !== content.title
    const descriptionChanged = editForm.description !== (content.description || '')
    const segmentChanged = editForm.segment_id !== (content.segment_id || '')
    const campaignChanged = editForm.campaign_id !== (content.campaign_id || '')
    const tagsChanged = JSON.stringify(editForm.tags?.sort() || []) !== JSON.stringify(content.tags?.sort() || [])
    const ratingChanged = editForm.performance_rating !== content.performance_rating
    const statusChanged = editForm.status !== (content.status || 'draft')
    
    // Check if user has made explicit changes to editor content
    const contentOrInstructionsChanged = hasUserMadeChanges
    
    return titleChanged || descriptionChanged || segmentChanged || campaignChanged || tagsChanged || contentOrInstructionsChanged || ratingChanged || statusChanged
  }

  const generateContent = async (quickAction?: string) => {
    if (!content?.id || !content?.site_id) {
      toast.error("Content ID or site ID not available")
      return
    }

    // Check if there are unsaved changes before generating
    const hasChanges = hasUnsavedChanges()
    
    if (hasChanges) {
      try {
        await handleSaveChanges()
        // Reset the user changes flag after successful save
        setHasUserMadeChanges(false)
      } catch (error) {
        console.error("Error saving before generation:", error)
        toast.error("Failed to save changes before generating content")
        return
      }
          }

    setIsGenerating(true)
    try {
      // Prepare request body
      const requestBody = {
        contentId: content.id,
        siteId: content.site_id,
        segmentId: editForm.segment_id || undefined,
        campaignId: editForm.campaign_id || undefined,
        userId: undefined, // Can be populated if needed from auth context
        quickAction: quickAction,
        styleControls: mapStyleControlsToApi(),
        whatImGoodAt: expertise || undefined,
        topicsImInterestedIn: interests || undefined,
        topicsToAvoid: topicsToAvoid || undefined,
        aiPrompt: aiPrompt || undefined
      }

      console.log("Generating content with request:", requestBody)
      console.log("API URL:", `${FULL_API_SERVER_URL}/api/agents/copywriter/content-editor`)

      // Direct API call to the copywriter service
      const response = await fetch(`${FULL_API_SERVER_URL}/api/agents/copywriter/content-editor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        mode: 'cors',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error generating content: ${response.status} ${response.statusText}. ${errorText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      if (data.content) {
        // Si recibimos contenido, actualizamos el editor correspondiente
        if (activeTab === 'copy' && editor) {
          editor.commands.setContent(data.content);
          
          // Update the form state with the new content
          setEditForm(prev => ({
            ...prev,
            content: data.content,
            text: editor.getText()
          }));
        } else if (activeTab === 'instructions' && instructionsEditor) {
          instructionsEditor.commands.setContent(data.content);
          
          // Update the form state with the new instructions
          setEditForm(prev => ({
            ...prev,
            instructions: data.content
          }));
        }
        
        toast.success("Content generated successfully");
      } else if (data.message) {
        toast.success(data.message);
      } else {
        // Si no hay contenido ni mensaje, asumimos que solo se procesó la solicitud
        toast.success("Content generation request processed");
        
        // Recargamos el contenido para obtener cualquier actualización
        setTimeout(() => loadContent(), 2000);
      }
    } catch (error) {
      console.error("Error generating content:", error)
      toast.error(error instanceof Error ? error.message : "Failed to generate content")
    } finally {
      setIsGenerating(false)
    }
  }

  if (isLoading) {
    return <ContentSkeleton />
  }

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-none">
          <MenuBar 
            editor={editor} 
            instructionsEditor={instructionsEditor}
            onSave={handleSaveChanges} 
            isSaving={isSaving} 
            onDelete={handleDeleteContent}
            activeTab={activeTab}
            hasChanges={hasUnsavedChanges()}
            contentType={content?.type}
            onTeleprompter={() => {
              // Navigate to teleprompter page
              router.push(`/teleprompter/${content.id}`)
            }}
          />
        </div>
        <div className="flex-1 overflow-auto">
          <div className="p-4 h-full flex flex-col">
            {/* Tab Selector - now scrolls with content */}
            <div className="flex justify-center mb-6">
              <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border rounded-lg">
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'copy' | 'instructions')}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="copy">Copy</TabsTrigger>
                    <TabsTrigger value="instructions">Instructions</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>

            {/* Editor Content */}
            <div className="flex-1 flex flex-col">
              {activeTab === 'copy' ? (
                <EditorContent 
                  editor={editor} 
                  className="prose prose-sm dark:prose-invert max-w-none flex-1 min-h-full overflow-auto" 
                  style={{ minHeight: 'calc(100vh - 280px)' }}
                />
              ) : (
                <EditorContent 
                  editor={instructionsEditor} 
                  className="prose prose-sm dark:prose-invert max-w-none flex-1 min-h-full overflow-auto" 
                  style={{ minHeight: 'calc(100vh - 280px)' }}
                />
              )}
            </div>
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
                AI Assistant
              </TabsTrigger>
              <TabsTrigger value="details">
                Details
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tabs Content */}
          <div className="flex-1 overflow-hidden">
            <TabsContent value="ai" className="h-full mt-0">
              {isGenerating ? (
                <AiGenerationSkeleton />
              ) : (
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
                            onClick={() => generateContent("improve")}
                            disabled={isGenerating}
                          >
                            <span className="text-base mr-2">✨</span>
                            Improve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => generateContent("expand")}
                            disabled={isGenerating}
                          >
                            <span className="text-base mr-2">➕</span>
                            Expand
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => generateContent("style")}
                            disabled={isGenerating}
                          >
                            <span className="text-base mr-2">🎨</span>
                            Style
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => generateContent("summarize")}
                            disabled={isGenerating}
                          >
                            <span className="text-base mr-2">📝</span>
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
                                      className="w-full style-slider-thumb"
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
                                      className="w-full style-slider-thumb"
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
                                      className="w-full style-slider-thumb"
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
                                      className="w-full style-slider-thumb"
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
                                      className="w-full style-slider-thumb"
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
                                      className="w-full style-slider-thumb"
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
                                      className="w-full style-slider-thumb"
                                    />
                                    <span className="text-base text-muted-foreground">📜</span>
                                  </div>
                                </div>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        </CardContent>
                      </Card>

                      {/* Personalization Section */}
                      <Card className="border-none bg-muted/30">
                        <CardContent className="p-0">
                          <Collapsible defaultOpen>
                            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors">
                              <div className="flex items-center gap-2 text-sm font-medium">
                                <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                                Personalization
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


                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        </CardContent>
                      </Card>
                    </div>
                  </ScrollArea>
                  
                  {/* Fixed Footer con AI Prompt y Generate Content button */}
                  <div className="border-t p-4 bg-background space-y-3">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">AI Prompt</Label>
                      <Textarea
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="Describe what you want the AI to do..."
                        className="min-h-[80px] resize-none"
                      />
                    </div>
                    <Button 
                      className="w-full" 
                      size="lg" 
                      disabled={isGenerating}
                      onClick={() => generateContent()}
                    >
                      <Cpu className="h-5 w-5 mr-2" />
                      Generate Content
                    </Button>
                  </div>
                </div>
              )}
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
                                  performance_rating: rating,
                                  skipRevalidation: true // Prevent automatic page refresh for rating updates
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
                            onChange={(e) => {
                              setEditForm(prev => ({ ...prev, title: e.target.value }))
                              if (editorsReady) setHasUserMadeChanges(true)
                            }}
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
                            onChange={(e) => {
                              setEditForm(prev => ({ ...prev, description: e.target.value }))
                              if (editorsReady) setHasUserMadeChanges(true)
                            }}
                            placeholder="Enter description"
                            className="min-h-[100px] resize-none"
                          />
                        </div>
                        <div className="space-y-2.5">
                          <Label className="flex items-center gap-2">
                            {getContentTypeIcon(editForm.type)}
                            <span className="text-muted-foreground">Content Type</span>
                          </Label>
                          <div className="flex items-center gap-3 p-3 bg-muted rounded-md">
                            <div className="text-primary">
                              {getContentTypeIcon(editForm.type)}
                            </div>
                            <span className="font-medium">{getContentTypeName(editForm.type)}</span>
                          </div>
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
                                  <div className="truncate max-w-[200px]" title={campaign.title}>
                                    {campaign.title}
                                  </div>
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