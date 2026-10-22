import { FileText } from "@/app/components/ui/icons"
import type { InstanceNode } from "@/app/types/instance-nodes"

/** Documents are uploaded outputs too, even when there is no media preview. */
export function ImprentaUploadedFile({ node }: { node: InstanceNode }) {
  if (node.settings.imprenta_source !== "upload" || node.settings.media_type !== "text") return null
  const output = node.result.outputs?.[0]
  const url = output?.data?.url || output?.url
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return null
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3 text-sm hover:bg-muted/60"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 truncate">{node.prompt.text || "Open uploaded file"}</span>
    </a>
  )
}