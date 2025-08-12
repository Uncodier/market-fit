"use client"

import { Button } from "@/app/components/ui/button"
import { Experiment } from "../types"
import {
  Save, 
  X, 
  Pencil,
  PlayCircle,
  StopCircle,
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

interface MenuBarProps {
  editor: any
  experiment: Experiment
  onSave: () => void
  isSaving: boolean
  isEditing: boolean
  isLoading: boolean
  onStart: (id: string) => void
  onStop: (id: string) => void
  onToggleEdit: () => void
  onDelete: () => void
  hasUnsavedChanges?: boolean
}

export function MenuBar({ 
  editor, 
  experiment, 
  onSave, 
  isSaving, 
  isEditing, 
  isLoading, 
  onStart, 
  onStop, 
  onToggleEdit, 
  onDelete,
  hasUnsavedChanges = false
}: MenuBarProps) {
  if (!editor) {
    return null
  }

  console.log("MenuBar render - isEditing:", isEditing, "editor editable:", editor.isEditable)

  return (
    <div className="border-b pl-[20px] pr-4 py-2 flex flex-wrap gap-1 h-[71px] items-center justify-between">
      <div className="flex items-center gap-1 overflow-x-auto">
        <Button
          variant="secondary" 
          size="default"
          onClick={onSave}
          disabled={isSaving || !hasUnsavedChanges}
          className={`flex items-center gap-2 transition-all duration-200 ${hasUnsavedChanges ? 'hover:bg-primary/10' : ''}`}
        >
          {isSaving ? (
            <>
              <div className="h-4 w-4 animate-pulse bg-muted rounded" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Experiment {hasUnsavedChanges ? "*" : ""}
            </>
          )}
        </Button>
        
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (editor) {
              editor.chain().focus().toggleBold().run()
            }
          }}
          className={editor.isActive('bold') ? 'bg-muted' : ''}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (editor) {
              editor.chain().focus().toggleItalic().run()
            }
          }}
          className={editor.isActive('italic') ? 'bg-muted' : ''}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (editor) {
              editor.chain().focus().toggleBulletList().run()
            }
          }}
          className={editor.isActive('bulletList') ? 'bg-muted' : ''}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (editor) {
              editor.chain().focus().toggleOrderedList().run()
            }
          }}
          className={editor.isActive('orderedList') ? 'bg-muted' : ''}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (editor) {
              editor.chain().focus().toggleBlockquote().run()
            }
          }}
          className={editor.isActive('blockquote') ? 'bg-muted' : ''}
        >
          <Quote className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (editor) {
              editor.chain().focus().toggleCodeBlock().run()
            }
          }}
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
            <DropdownMenuItem onClick={() => {
              if (editor) editor.chain().focus().setParagraph().run()
            }}>
              <ParagraphIcon className="h-4 w-4 mr-2" />
              Paragraph
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              if (editor) editor.chain().focus().toggleHeading({ level: 1 }).run()
            }}>
              <span className="w-4 h-4 inline-flex items-center justify-center mr-2 font-bold">H1</span>
              Heading 1
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              if (editor) editor.chain().focus().toggleHeading({ level: 2 }).run()
            }}>
              <span className="w-4 h-4 inline-flex items-center justify-center mr-2 font-bold">H2</span>
              Heading 2
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              if (editor) editor.chain().focus().toggleHeading({ level: 3 }).run()
            }}>
              <span className="w-4 h-4 inline-flex items-center justify-center mr-2 font-bold">H3</span>
              Heading 3
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              if (editor) editor.chain().focus().toggleHeading({ level: 4 }).run()
            }}>
              <span className="w-4 h-4 inline-flex items-center justify-center mr-2 text-xs font-bold">H4</span>
              Heading 4
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              if (editor) editor.chain().focus().toggleHeading({ level: 5 }).run()
            }}>
              <span className="w-4 h-4 inline-flex items-center justify-center mr-2 text-xs font-bold">H5</span>
              Heading 5
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              if (editor) editor.chain().focus().toggleHeading({ level: 6 }).run()
            }}>
              <span className="w-4 h-4 inline-flex items-center justify-center mr-2 text-xs font-bold">H6</span>
              Heading 6
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (editor) {
              const url = window.prompt('Enter the URL')
              if (url) {
                editor.chain().focus().setLink({ href: url }).run()
              }
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
            if (editor) {
              const url = window.prompt('Enter the image URL')
              if (url) {
                editor.chain().focus().setImage({ src: url }).run()
              }
            }
          }}
        >
          <ImageIcon className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (editor) editor.chain().focus().setTextAlign('left').run()
          }}
          className={editor.isActive({ textAlign: 'left' }) ? 'bg-muted' : ''}
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (editor) editor.chain().focus().setTextAlign('center').run()
          }}
          className={editor.isActive({ textAlign: 'center' }) ? 'bg-muted' : ''}
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (editor) editor.chain().focus().setTextAlign('right').run()
          }}
          className={editor.isActive({ textAlign: 'right' }) ? 'bg-muted' : ''}
        >
          <AlignRight className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (editor) editor.chain().focus().setTextAlign('justify').run()
          }}
          className={editor.isActive({ textAlign: 'justify' }) ? 'bg-muted' : ''}
        >
          <AlignJustify className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (editor) editor.chain().focus().undo().run()
          }}
          disabled={!editor.can().undo()}
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (editor) editor.chain().focus().redo().run()
          }}
          disabled={!editor.can().redo()}
        >
          <Redo className="h-4 w-4" />
        </Button>

        <div className="ml-auto">
          {/* Delete button */}
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
                <AlertDialogTitle>Delete Experiment</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this experiment? This action cannot be undone.
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
    </div>
  )
} 