import { type Asset } from "@/app/assets/actions"

export interface AssetWithThumbnail extends Asset {
  thumbnailUrl?: string
  tags: string[]
  isAttachedToAgent?: boolean
}

export type AssetViewType = "grid" | "list"

export const AGENT_COMPATIBLE_FILE_TYPES = [
  "application/pdf",
  "text/csv",
  "application/vnd.ms-excel",
  "text/markdown",
  "text/plain",
  "application/json",
  "text/yaml",
  "application/x-yaml",
  "image/jpeg",
  "image/png",
  "image/webp",
]

export const AGENT_COMPATIBLE_EXTENSIONS = [
  ".pdf", ".csv", ".md", ".txt", ".json", ".yaml", ".yml", ".jpg", ".jpeg", ".png", ".webp",
]

export function getFileTypeCategory(fileType: string): "image" | "video" | "document" {
  if (fileType.startsWith("image/")) return "image"
  if (fileType.startsWith("video/")) return "video"
  return "document"
}

export function getTypeColor(fileType: string) {
  const category = getFileTypeCategory(fileType)
  switch (category) {
    case "image":
      return "bg-blue-50 text-blue-700 border-blue-200"
    case "video":
      return "bg-purple-50 text-purple-700 border-purple-200"
    case "document":
      return "bg-amber-50 text-amber-700 border-amber-200"
  }
}

export function isAssetCompatibleWithAgent(asset: Asset): boolean {
  if (AGENT_COMPATIBLE_FILE_TYPES.includes(asset.file_type)) return true
  const extension = `.${asset.name.split(".").pop()?.toLowerCase()}`
  return AGENT_COMPATIBLE_EXTENSIONS.includes(extension)
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes || bytes === 0) return "0 Bytes"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}
