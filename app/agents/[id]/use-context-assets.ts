import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { getAssets, attachAssetToAgent, detachAssetFromAgent, type Asset } from "@/app/assets/actions"
import type { EditorFile } from "./editor-profile"

const fileTypes = new Set([
  "application/pdf", "text/csv", "application/vnd.ms-excel", "text/markdown", "text/plain", "application/json",
  "text/yaml", "application/x-yaml", "image/jpeg", "image/png", "image/webp",
])
const extensions = new Set(["pdf", "csv", "md", "txt", "json", "yaml", "yml", "jpg", "jpeg", "png", "webp"])

export function useContextAssets(siteId: string, agentId: string, files: EditorFile[], onChange: (files: EditorFile[]) => void) {
  const [assets, setAssets] = useState<Asset[] | null>(null)
  const [busy, setBusy] = useState<"files" | "assets" | null>(null)
  const current = useRef(false)
  const pending = useRef(false)

  useLayoutEffect(() => {
    current.current = true
    return () => { current.current = false }
  }, [])
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { assets, error } = await getAssets(siteId)
        if (cancelled) return
        if (error) throw new Error(error)
        setAssets((assets ?? []).filter((asset) => asset.site_id === siteId && (fileTypes.has(asset.file_type) ||
          extensions.has(asset.name.split(".").pop()?.toLowerCase() ?? ""))))
      } catch {
        if (!cancelled) {
          setAssets([])
          toast.error("Failed to load available assets")
        }
      }
    }
    void load()
    return () => { cancelled = true }
  }, [siteId, files])

  async function toggle(assetId: string, source: "files" | "assets") {
    if (pending.current) return
    const attached = files.some((file) => file.id === assetId)
    const asset = assets?.find((item) => item.id === assetId)
    if (!attached && !asset) return
    pending.current = true
    setBusy(source)
    try {
      const action = attached ? detachAssetFromAgent : attachAssetToAgent
      const { error } = await action(agentId, assetId)
      if (!current.current) return
      if (error) throw new Error(error)
      if (attached) onChange(files.filter((file) => file.id !== assetId))
      else if (asset) onChange([...files, { id: asset.id, name: asset.name, path: asset.file_path }])
      toast.success(attached ? "Asset detached successfully" : "Asset attached successfully")
    } catch {
      if (current.current) toast.error(attached ? "Failed to detach asset" : "Failed to attach asset")
    } finally {
      pending.current = false
      if (current.current) setBusy(null)
    }
  }

  return { assets, busy, toggle }
}