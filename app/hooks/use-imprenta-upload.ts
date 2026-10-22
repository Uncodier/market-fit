"use client"

import { useRef, useState, type ChangeEvent } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { uploadAssetFile } from "@/app/assets/actions"
import type { InstanceNode } from "@/app/types/instance-nodes"
import type { ViewportSnapshot } from "@/app/lib/imprenta-viewport-store"

type Options = {
  instanceId?: string
  siteId?: string
  getViewport: () => ViewportSnapshot | undefined
  onUploaded: (node: InstanceNode) => void | Promise<void>
}

export function useImprentaUpload({ instanceId, siteId, getViewport, onUploaded }: Options) {
  const [isUploadingAsset, setIsUploadingAsset] = useState(false)
  const uploadPending = useRef(false)

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file || uploadPending.current) return
    if (!instanceId || !siteId) {
      input.value = ""
      toast.error("Select a workspace before uploading a file")
      return
    }

    uploadPending.current = true
    setIsUploadingAsset(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error("Sign in before uploading a file")
      toast.info("Uploading asset...")
      const { path, error: uploadError } = await uploadAssetFile(file)
      if (uploadError || !path) throw new Error("The file could not be uploaded. Please try again.")

      const mediaType = file.type.startsWith("image/") ? "image"
        : file.type.startsWith("video/") ? "video"
          : file.type.startsWith("audio/") ? "audio" : "text"
      const viewport = getViewport()
      const position = viewport && viewport.canvasWidth > 0 && viewport.canvasHeight > 0
        ? {
          x: (viewport.canvasWidth / 2 - viewport.position.x) / viewport.scale - 240,
          y: (viewport.canvasHeight / 2 - viewport.position.y) / viewport.scale - 150,
        } : undefined
      const { data: node, error } = await supabase.from("instance_nodes").insert([{
        instance_id: instanceId,
        site_id: siteId,
        user_id: session.user.id,
        parent_node_id: null,
        type: `generate-${mediaType}`,
        status: "completed",
        prompt: { text: file.name },
        settings: {
          imprenta_mode: true,
          imprenta_source: "upload",
          media_type: mediaType,
          ...(position ? { ui_position: position } : {}),
        },
        result: { outputs: [{ url: path, type: mediaType }] },
      }]).select("*").single()

      // Storage alone is not success: the canvas needs a confirmed persisted row.
      if (error || !node?.id) throw new Error("The uploaded file could not be saved to Content Creator")
      await onUploaded(node as InstanceNode)
      toast.success("Asset uploaded successfully")
    } catch (error) {
      console.error("Content Creator upload failed:", error)
      toast.error(error instanceof Error ? error.message : "Failed to upload asset")
    } finally {
      uploadPending.current = false
      setIsUploadingAsset(false)
      input.value = ""
    }
  }

  return { isUploadingAsset, handleFileChange }
}