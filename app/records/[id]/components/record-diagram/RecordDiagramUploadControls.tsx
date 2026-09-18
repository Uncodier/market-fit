"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { FileText, ImageIcon } from "@/app/components/ui/icons"
import type { RecordNodeAttachment } from "@/app/records/lib/record-diagram"
import { uploadRecordNodeAttachment } from "./record-node-attachments"

type RecordDiagramUploadControlsProps = {
  disabled?: boolean
  onUploaded: (attachment: RecordNodeAttachment) => void
}

export function RecordDiagramUploadControls({
  disabled,
  onUploaded,
}: RecordDiagramUploadControlsProps) {
  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  const upload = async (file: File | undefined, kind: "image" | "file") => {
    if (!file) return
    setIsUploading(true)
    try {
      const attachment = await uploadRecordNodeAttachment(file, kind)
      onUploaded(attachment)
      toast.success(kind === "image" ? "Image node created" : "File node created")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed")
    } finally {
      setIsUploading(false)
      if (imageInputRef.current) imageInputRef.current.value = ""
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  return (
    <>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => void upload(event.target.files?.[0], "image")}
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(event) => void upload(event.target.files?.[0], "file")}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 gap-2"
        disabled={disabled || isUploading}
        onClick={() => imageInputRef.current?.click()}
      >
        <ImageIcon className="h-4 w-4" />
        Image
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 gap-2"
        disabled={disabled || isUploading}
        onClick={() => fileInputRef.current?.click()}
      >
        <FileText className="h-4 w-4" />
        {isUploading ? "Uploading..." : "File"}
      </Button>
    </>
  )
}
