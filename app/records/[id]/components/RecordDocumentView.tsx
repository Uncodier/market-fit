"use client"

import type { Editor } from "@tiptap/react"
import { EditorContent } from "@tiptap/react"
import { Input } from "@/app/components/ui/input"
import { RecordDynamicForm } from "./RecordDynamicForm"
import type { RecordItem } from "../../actions"

interface RecordDocumentViewProps {
  editor: Editor | null
  record: RecordItem
  title: string
  status: string
  formData: Record<string, any>
  relationsData: Record<string, any>
  onTitleChange: (value: string) => void
  onFieldChange: (field: string, value: any, type: "field" | "relation") => void
  onStatusChange: (value: string) => void
}

export function RecordDocumentView({
  editor,
  record,
  title,
  status,
  formData,
  relationsData,
  onTitleChange,
  onFieldChange,
  onStatusChange,
}: RecordDocumentViewProps) {
  const templateFields = record.category?.template_fields || []

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto h-full max-w-4xl p-4 md:p-8">
        {templateFields.length === 0 ? (
          <div className="flex h-full flex-col space-y-4">
            <Input
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder="Record Title"
              className="h-auto flex-none border-none bg-transparent px-0 text-4xl font-bold shadow-none focus-visible:ring-0"
            />
            <EditorContent editor={editor} className="flex min-h-0 flex-1 flex-col" />
          </div>
        ) : (
          <div className="space-y-6">
            <Input
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder="Record Title"
              className="h-auto border-none bg-transparent px-0 text-4xl font-bold shadow-none focus-visible:ring-0"
            />
            <RecordDynamicForm
              fields={templateFields}
              formData={formData}
              relationsData={relationsData}
              status={status}
              record={record}
              onChange={onFieldChange}
              onStatusChange={onStatusChange}
            />
            <div className="h-auto border-none px-0 pt-4 text-lg text-muted-foreground shadow-none focus-visible:ring-0">
              <EditorContent editor={editor} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
