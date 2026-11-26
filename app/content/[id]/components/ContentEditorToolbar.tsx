"use client"

import { useState } from "react"
import type { Editor } from "@tiptap/react"
import { Button } from "@/app/components/ui/button"
import { stickyHeaderBorderClassName } from "@/app/components/ui/sticky-header-styles"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { ContentDeleteDialog } from "./ContentDeleteDialog"
import type { DeleteContentOptions, DeleteContentResult } from "../../delete-content-types"
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Code,
  ImageIcon,
  Italic,
  LinkIcon,
  List,
  ListOrdered,
  Maximize,
  ParagraphIcon,
  Quote,
  Redo,
  Save,
  Undo,
  UploadCloud,
} from "@/app/components/ui/icons"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
import type { ContentActiveTab } from "../content-item-types"

type Props = {
  editor: Editor | null
  instructionsEditor: Editor | null
  onSave: () => void
  isSaving: boolean
  onDelete: (options: DeleteContentOptions) => Promise<DeleteContentResult>
  linkedPostCount?: number
  contentId?: string
  activeTab: Exclude<ContentActiveTab, "ai">
  hasChanges: boolean
  contentType?: string
  onTeleprompter?: () => void
  onUploadAsset?: () => void
  isEditorFocused?: boolean
}

export function ContentEditorToolbar({
  editor,
  instructionsEditor,
  onSave,
  isSaving,
  onDelete,
  linkedPostCount = 0,
  contentId,
  activeTab,
  hasChanges,
  contentType,
  onTeleprompter,
  onUploadAsset,
  isEditorFocused,
}: Props) {
  const currentEditor = activeTab === "copy" ? editor : instructionsEditor
  const [isToolbarHovered, setIsToolbarHovered] = useState(false)
  const [isHeadingDropdownOpen, setIsHeadingDropdownOpen] = useState(false)
  const showFormattingControls = Boolean(
    isEditorFocused || isToolbarHovered || isHeadingDropdownOpen,
  )

  if (!currentEditor) return null

  const iconButton = (
    label: string,
    command: () => void,
    icon: React.ReactNode,
    active = false,
    disabled = false,
  ) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={command}
      className={active ? "bg-muted" : ""}
      disabled={disabled}
      aria-label={label}
    >
      {icon}
    </Button>
  )

  return (
    <div data-toolbar-icon-actions className={`flex h-[71px] items-center gap-1 overflow-hidden whitespace-nowrap py-2 pl-5 pr-4 ${stickyHeaderBorderClassName}`}>
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
        <Button
          variant="secondary"
          size="default"
          onClick={onSave}
          disabled={isSaving || !hasChanges}
          className="flex items-center gap-2 transition-all duration-200 hover:bg-primary/10"
        >
          {isSaving ? (
            <>
              <div className="h-4 w-4 animate-pulse rounded bg-muted" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save
            </>
          )}
        </Button>

        {!showFormattingControls && contentType === "video" && (
          <Button
            variant="secondary"
            size="default"
            onClick={onTeleprompter}
            className="flex items-center gap-2 transition-all duration-200 hover:bg-primary/10"
          >
            <Maximize className="h-4 w-4" />
            Teleprompter
          </Button>
        )}

        {!showFormattingControls && onUploadAsset && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onUploadAsset}
            className="flex items-center gap-2 transition-all duration-200"
          >
            <UploadCloud className="h-4 w-4" />
            Upload File
          </Button>
        )}

        <div className={`mx-1 h-6 w-px bg-border transition-all duration-300 ${showFormattingControls ? "opacity-100" : "mx-0 w-0 opacity-0"}`} />

        <div
          className={`flex min-w-0 items-center overflow-hidden transition-all duration-300 ${showFormattingControls ? "max-w-[1000px] flex-1 opacity-100" : "max-w-0 opacity-0"}`}
          onMouseEnter={() => setIsToolbarHovered(true)}
          onMouseLeave={() => setIsToolbarHovered(false)}
        >
          <div className="flex flex-nowrap items-center gap-1 pr-2">
            {iconButton(
              "Bold",
              () => currentEditor.chain().focus().toggleBold().run(),
              <Bold className="h-4 w-4" />,
              currentEditor.isActive("bold"),
            )}
            {iconButton(
              "Italic",
              () => currentEditor.chain().focus().toggleItalic().run(),
              <Italic className="h-4 w-4" />,
              currentEditor.isActive("italic"),
            )}
            {iconButton(
              "Bullet list",
              () => currentEditor.chain().focus().toggleBulletList().run(),
              <List className="h-4 w-4" />,
              currentEditor.isActive("bulletList"),
            )}
            {iconButton(
              "Numbered list",
              () => currentEditor.chain().focus().toggleOrderedList().run(),
              <ListOrdered className="h-4 w-4" />,
              currentEditor.isActive("orderedList"),
            )}
            {iconButton(
              "Quote",
              () => currentEditor.chain().focus().toggleBlockquote().run(),
              <Quote className="h-4 w-4" />,
              currentEditor.isActive("blockquote"),
            )}
            {iconButton(
              "Code block",
              () => currentEditor.chain().focus().toggleCodeBlock().run(),
              <Code className="h-4 w-4" />,
              currentEditor.isActive("codeBlock"),
            )}

            <DropdownMenu onOpenChange={setIsHeadingDropdownOpen}>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <DropdownMenuTrigger asChild>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" aria-label="Text style" data-toolbar-icon-action="off" className={currentEditor.isActive("heading") ? "bg-muted" : ""}>
                        {currentEditor.isActive("heading")
                          ? <span className="inline-flex h-4 w-4 items-center justify-center font-bold">H{currentEditor.getAttributes("heading").level}</span>
                          : <ParagraphIcon className="h-4 w-4" />}
                        <ChevronDown className="ml-1 h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                  </DropdownMenuTrigger>
                  <TooltipContent side="bottom">Text style</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => currentEditor.chain().focus().setParagraph().run()}>
                  <ParagraphIcon className="mr-2 h-4 w-4" />
                  Paragraph
                </DropdownMenuItem>
                {([1, 2, 3, 4, 5, 6] as const).map((level) => (
                  <DropdownMenuItem
                    key={level}
                    onClick={() => currentEditor.chain().focus().toggleHeading({ level }).run()}
                  >
                    <span className="mr-2 inline-flex h-4 w-4 items-center justify-center font-bold">H{level}</span>
                    Heading {level}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {iconButton("Insert link", () => {
              const url = window.prompt("Enter the URL")
              if (url) currentEditor.chain().focus().setLink({ href: url }).run()
            }, <LinkIcon className="h-4 w-4" />, currentEditor.isActive("link"))}
            {iconButton("Insert image", () => {
              const url = window.prompt("Enter the image URL")
              if (url) currentEditor.chain().focus().setImage({ src: url }).run()
            }, <ImageIcon className="h-4 w-4" />)}
            <div className="mx-1 h-6 w-px bg-border" />
            {(["left", "center", "right", "justify"] as const).map((align) => {
              const Icon = { left: AlignLeft, center: AlignCenter, right: AlignRight, justify: AlignJustify }[align]
              return <span key={align}>{iconButton(
                align === "justify" ? "Justify" : `Align ${align}`,
                () => currentEditor.chain().focus().setTextAlign(align).run(),
                <Icon className="h-4 w-4" />,
                currentEditor.isActive({ textAlign: align }),
              )}</span>
            })}
            <div className="mx-1 h-6 w-px bg-border" />
            {iconButton(
              "Undo",
              () => currentEditor.chain().focus().undo().run(),
              <Undo className="h-4 w-4" />,
              false,
              !currentEditor.can().undo(),
            )}
            {iconButton(
              "Redo",
              () => currentEditor.chain().focus().redo().run(),
              <Redo className="h-4 w-4" />,
              false,
              !currentEditor.can().redo(),
            )}
          </div>
        </div>

        {!showFormattingControls && (
          <>
            <div className="mx-1 h-6 w-px bg-border" />
            <ContentDeleteDialog key={contentId} contentId={contentId} linkedPostCount={linkedPostCount} onDelete={onDelete} />
          </>
        )}
      </div>
    </div>
  )
}
