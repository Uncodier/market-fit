"use client"

import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select"
import { ArrowLeft, ArrowRight, Trash2, X } from "@/app/components/ui/icons"
import {
  RECORD_EDGE_TYPES,
  formatRecordEdgeType,
  type RecordDiagramEdge,
  type RecordEdgeType,
} from "@/app/records/lib/record-diagram"
import { getRecordEdgeVisualStyle } from "./record-diagram-edge-style"

type RecordDiagramEdgeEditorProps = {
  edge: RecordDiagramEdge
  onChange: (patch: Partial<RecordDiagramEdge>) => void
  onClose: () => void
  onDelete: () => void
}

export function RecordDiagramEdgeEditor({
  edge,
  onChange,
  onClose,
  onDelete,
}: RecordDiagramEdgeEditorProps) {
  return (
    <div
      aria-label="Relation editor"
      className="flex w-[360px] max-w-[calc(100vw-2rem)] items-center gap-1 rounded-lg border border-primary/30 bg-background p-1 shadow-xl"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <Select
        value={edge.type}
        onValueChange={(type) => onChange({ type: type as RecordEdgeType })}
      >
        <SelectTrigger className="h-8 w-[132px] shrink-0 border-0 text-xs shadow-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {RECORD_EDGE_TYPES.map((type) => (
            <SelectItem key={type} value={type}>
                    <span className="flex items-center gap-2">
                      <RelationLineSample type={type} />
                      {formatRecordEdgeType(type)}
                    </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        className="h-8 min-w-0 flex-1 text-xs"
        value={edge.label || ""}
        maxLength={120}
        placeholder="Label"
        aria-label="Relation label"
        onChange={(event) => onChange({ label: event.target.value || undefined })}
      />
      <Button
        type="button"
        variant={edge.metadata.bidirectional ? "secondary" : "ghost"}
        size="icon"
        className="h-8 w-8 shrink-0"
        aria-label="Two-way relation"
        aria-pressed={Boolean(edge.metadata.bidirectional)}
        title="Two-way relation"
        onClick={() => onChange({
          metadata: {
            ...edge.metadata,
            bidirectional: !edge.metadata.bidirectional,
          },
        })}
      >
        <span className="relative h-4 w-4" aria-hidden="true">
          <ArrowRight className="absolute left-0 top-0 h-3 w-3" />
          <ArrowLeft className="absolute bottom-0 right-0 h-3 w-3" />
        </span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
        aria-label="Delete relation"
        onClick={onDelete}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        aria-label="Close relation editor"
        onClick={onClose}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

function RelationLineSample({ type }: { type: RecordEdgeType }) {
  const style = getRecordEdgeVisualStyle(type)
  return (
    <svg aria-hidden="true" width="28" height="8" viewBox="0 0 28 8">
      <line
        x1="1"
        y1="4"
        x2="27"
        y2="4"
        stroke="currentColor"
        strokeWidth={style.strokeWidth}
        strokeDasharray={style.strokeDasharray}
        strokeLinecap={style.strokeLinecap}
      />
    </svg>
  )
}
