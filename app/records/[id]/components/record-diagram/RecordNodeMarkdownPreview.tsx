"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"

export function RecordNodeMarkdownPreview({
  markdown,
  showPlaceholder,
  onEdit,
}: {
  markdown: string
  showPlaceholder: boolean
  onEdit: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Edit node content"
      className={cn(
        "min-h-5 cursor-text overflow-auto text-left text-sm",
        "prose prose-sm max-w-none dark:prose-invert",
        "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        "[&_h1]:my-1 [&_h2]:my-1 [&_h3]:my-1 [&_p]:my-1",
        "[&_ol]:my-1 [&_ul]:my-1 [&_pre]:my-1",
      )}
      onClick={(event) => {
        event.stopPropagation()
        onEdit()
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter") return
        event.preventDefault()
        onEdit()
      }}
    >
      {markdown ? (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      ) : showPlaceholder ? (
        <span className="text-muted-foreground">
          Add the semantic content agents should understand...
        </span>
      ) : null}
    </div>
  )
}
