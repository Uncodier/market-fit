"use client"

import { Button } from "@/app/components/ui/button"
import {
  Bold,
  Code,
  Heading2,
  Italic,
  LinkIcon,
  List,
  ListOrdered,
  Quote,
} from "@/app/components/ui/icons"
import type { RecordNodeMarkdownCommand } from "./use-record-node-markdown-editor"

type FormatAction = {
  command: RecordNodeMarkdownCommand
  label: string
  icon: React.ReactNode
}

const ACTIONS: FormatAction[] = [
  { command: "bold", label: "Bold", icon: <Bold className="h-4 w-4" /> },
  { command: "italic", label: "Italic", icon: <Italic className="h-4 w-4" /> },
  { command: "heading", label: "Heading", icon: <Heading2 className="h-4 w-4" /> },
  { command: "bullet", label: "Bullet list", icon: <List className="h-4 w-4" /> },
  { command: "ordered", label: "Numbered list", icon: <ListOrdered className="h-4 w-4" /> },
  { command: "quote", label: "Quote", icon: <Quote className="h-4 w-4" /> },
  { command: "code", label: "Code", icon: <Code className="h-4 w-4" /> },
  { command: "link", label: "Link", icon: <LinkIcon className="h-4 w-4" /> },
]

export function RecordNodeMarkdownControls({
  onFormat,
}: {
  onFormat: (command: RecordNodeMarkdownCommand) => void
}) {
  return (
    <div
      data-node-markdown-toolbar
      className="flex items-center gap-0.5"
      onMouseDown={(event) => event.preventDefault()}
    >
      <div className="mx-1 h-4 w-px bg-border" />
      {ACTIONS.map((action) => (
        <Button
          key={action.command}
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={action.label}
          title={action.label}
          onClick={() => onFormat(action.command)}
        >
          {action.icon}
        </Button>
      ))}
    </div>
  )
}
