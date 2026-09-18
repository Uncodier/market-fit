import { uploadAssetFile } from "@/app/assets/actions"
import type { RecordNodeAttachment } from "@/app/records/lib/record-diagram"

export const MAX_RECORD_NODE_ATTACHMENTS = 8
export const MAX_RECORD_NODE_ATTACHMENT_BYTES = 25 * 1024 * 1024

export async function uploadRecordNodeAttachment(
  file: File,
  kind: "image" | "file"
): Promise<RecordNodeAttachment> {
  if (file.size > MAX_RECORD_NODE_ATTACHMENT_BYTES) {
    throw new Error("Files must be smaller than 25 MB")
  }
  if (kind === "image" && !file.type.startsWith("image/")) {
    throw new Error("Select a valid image")
  }

  const { path, error } = await uploadAssetFile(file)
  if (error || !path) throw new Error(error || "Upload failed")

  return {
    id: crypto.randomUUID(),
    name: file.name,
    url: path,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    kind,
  }
}
