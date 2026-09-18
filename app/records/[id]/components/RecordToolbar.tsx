"use client"

import { useState, type ReactNode } from "react"
import type { Editor } from "@tiptap/react"
import { Button } from "@/app/components/ui/button"
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Code,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Loader,
  PanelRightClose,
  PanelRightOpen,
  Quote,
  Redo,
  Save,
  Trash2,
  Type as ParagraphIcon,
  Undo,
} from "@/app/components/ui/icons"
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

interface RecordToolbarProps {
  editor: Editor | null
  activeView: "document" | "nodes"
  hasChanges: boolean
  isSaving: boolean
  saveStatus: "saved" | "unsaved" | "saving" | "error" | "conflict"
  isEditorFocused: boolean
  isRightPanelOpen: boolean
  onSave: () => void
  onReload: () => void
  onDelete: () => void
  onToggleRightPanel: () => void
  saveLabel: string
  diagramControls?: ReactNode
  isNodeTextEditing?: boolean
}

export function RecordToolbar({
  editor,
  activeView,
  hasChanges,
  isSaving,
  saveStatus,
  isEditorFocused,
  isRightPanelOpen,
  onSave,
  onReload,
  onDelete,
  onToggleRightPanel,
  saveLabel,
  diagramControls,
  isNodeTextEditing = false,
}: RecordToolbarProps) {
  const [isToolbarHovered, setIsToolbarHovered] = useState(false)
  const [isHeadingDropdownOpen, setIsHeadingDropdownOpen] = useState(false)
  const showFormatting = activeView === "document" && editor
  const formattingExpanded = isEditorFocused || isToolbarHovered || isHeadingDropdownOpen

  return (
    <div className="flex h-[71px] items-center gap-1 overflow-x-auto border-b bg-background py-2 pl-5 pr-4">
      <Button
        variant="secondary"
        onClick={onSave}
        disabled={!hasChanges || isSaving || saveStatus === "conflict"}
        className="mr-2 flex items-center gap-2"
      >
        {isSaving ? <Loader className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saveLabel}
      </Button>
      {(saveStatus === "error" || saveStatus === "conflict") && (
        <span
          className="mr-2 text-xs font-medium text-destructive"
          role="status"
          title={saveStatus === "conflict" ? "Reload this record before saving again." : undefined}
        >
          {saveStatus === "conflict" ? "Save conflict" : "Save failed"}
        </span>
      )}
      {saveStatus === "conflict" && (
        <Button type="button" variant="outline" size="sm" onClick={onReload}>
          Reload
        </Button>
      )}
      {diagramControls}

      {showFormatting && (
        <>
          <div className="mx-1 h-6 w-px bg-border" />
          <div
            className={`flex items-center overflow-hidden transition-all duration-300 ${
              formattingExpanded ? "max-w-[1000px] opacity-100" : "max-w-0 opacity-0"
            }`}
            onMouseEnter={() => setIsToolbarHovered(true)}
            onMouseLeave={() => setIsToolbarHovered(false)}
          >
            <div className="flex flex-nowrap items-center gap-1 pr-2">
              <FormatButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
                <Bold className="h-4 w-4" />
              </FormatButton>
              <FormatButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
                <Italic className="h-4 w-4" />
              </FormatButton>

              <DropdownMenu onOpenChange={setIsHeadingDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={editor.isActive("heading") ? "bg-muted" : ""}
                    aria-label="Text style"
                  >
                    {editor.isActive("heading", { level: 1 }) ? (
                      <span className="inline-flex h-4 w-4 items-center justify-center font-bold">H1</span>
                    ) : editor.isActive("heading", { level: 2 }) ? (
                      <span className="inline-flex h-4 w-4 items-center justify-center font-bold">H2</span>
                    ) : editor.isActive("heading", { level: 3 }) ? (
                      <span className="inline-flex h-4 w-4 items-center justify-center font-bold">H3</span>
                    ) : (
                      <ParagraphIcon className="h-4 w-4" />
                    )}
                    <ChevronDown className="ml-1 h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => editor.chain().focus().setParagraph().run()}>
                    <ParagraphIcon className="mr-2 h-4 w-4" />
                    Paragraph
                  </DropdownMenuItem>
                  {[1, 2, 3].map((level) => (
                    <DropdownMenuItem
                      key={level}
                      onClick={() => editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 }).run()}
                    >
                      <span className="mr-2 inline-flex h-4 w-4 items-center justify-center font-bold">H{level}</span>
                      Heading {level}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <FormatButton label="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
                <List className="h-4 w-4" />
              </FormatButton>
              <FormatButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
                <ListOrdered className="h-4 w-4" />
              </FormatButton>
              <FormatButton label="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
                <Quote className="h-4 w-4" />
              </FormatButton>
              <FormatButton label="Code block" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
                <Code className="h-4 w-4" />
              </FormatButton>
              <div className="mx-1 h-6 w-px bg-border" />
              <FormatButton
                label="Add link"
                active={editor.isActive("link")}
                onClick={() => {
                  const url = window.prompt("Enter the URL")
                  if (url) editor.chain().focus().setLink({ href: url }).run()
                }}
              >
                <LinkIcon className="h-4 w-4" />
              </FormatButton>
              <FormatButton
                label="Add image"
                onClick={() => {
                  const url = window.prompt("Enter the image URL")
                  if (url) editor.chain().focus().setImage({ src: url }).run()
                }}
              >
                <ImageIcon className="h-4 w-4" />
              </FormatButton>
              <div className="mx-1 h-6 w-px bg-border" />
              <FormatButton label="Align left" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
                <AlignLeft className="h-4 w-4" />
              </FormatButton>
              <FormatButton label="Align center" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
                <AlignCenter className="h-4 w-4" />
              </FormatButton>
              <FormatButton label="Align right" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
                <AlignRight className="h-4 w-4" />
              </FormatButton>
              <FormatButton label="Justify" active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()}>
                <AlignJustify className="h-4 w-4" />
              </FormatButton>
              <div className="mx-1 h-6 w-px bg-border" />
              <FormatButton label="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
                <Undo className="h-4 w-4" />
              </FormatButton>
              <FormatButton label="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
                <Redo className="h-4 w-4" />
              </FormatButton>
            </div>
          </div>
        </>
      )}

      <div className="flex-1" />
      {!isNodeTextEditing && (
        <>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                aria-label="Delete record"
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
                <AlertDialogAction
                  className="!bg-destructive !text-destructive-foreground hover:!bg-destructive/90"
                  onClick={onDelete}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleRightPanel}
            className="ml-2 text-muted-foreground hover:text-foreground"
            aria-label={isRightPanelOpen ? "Hide right panel" : "Show right panel"}
          >
            {isRightPanelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </Button>
        </>
      )}
    </div>
  )
}

function FormatButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={disabled}
      onClick={onClick}
      className={active ? "bg-muted" : ""}
      aria-label={label}
    >
      {children}
    </Button>
  )
}
