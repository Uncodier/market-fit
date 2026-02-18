"use client"

import { useEffect, useState } from "react"
import { Button } from "@/app/components/ui/button"
import { Badge } from "@/app/components/ui/badge"
import { Image as ImageIcon, FileVideo, FileText, Star, Trash2, UploadCloud } from "@/app/components/ui/icons"
import {
  getContentAssets,
  detachAssetFromContent,
  setContentPrimaryAsset,
  type ContentAssetWithDetails
} from "@/app/assets/actions"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog"
import { useSite } from "@/app/context/SiteContext"
import { useRouter } from "next/navigation"

function getAssetIcon(fileType: string) {
  if (fileType.startsWith("image/")) return <ImageIcon className="h-8 w-8 text-muted-foreground" />
  if (fileType.startsWith("video/")) return <FileVideo className="h-8 w-8 text-muted-foreground" />
  return <FileText className="h-8 w-8 text-muted-foreground" />
}

export function ContentAssetsGrid({
  contentId,
  refreshTrigger,
  onOpenUpload,
}: {
  contentId: string
  refreshTrigger: number
  onOpenUpload: () => void
}) {
  const { currentSite } = useSite()
  const router = useRouter()
  const [assets, setAssets] = useState<ContentAssetWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [detachId, setDetachId] = useState<string | null>(null)
  const [isDetaching, setIsDetaching] = useState(false)

  const loadAssets = async () => {
    setLoading(true)
    const { assets: list, error } = await getContentAssets(contentId)
    if (error) {
      toast.error(error)
      setAssets([])
    } else {
      setAssets(list || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadAssets()
  }, [contentId, refreshTrigger])

  const handleSetPrimary = async (assetId: string) => {
    const { error } = await setContentPrimaryAsset(contentId, assetId)
    if (error) {
      toast.error(error)
      return
    }
    toast.success("Primary asset updated")
    loadAssets()
    router.refresh()
  }

  const handleDetach = async (assetId: string) => {
    setIsDetaching(true)
    const { error } = await detachAssetFromContent(contentId, assetId)
    setIsDetaching(false)
    setDetachId(null)
    if (error) {
      toast.error(error)
      return
    }
    toast.success("Asset removed from content")
    loadAssets()
    router.refresh()
  }

  if (!currentSite?.id) {
    return null
  }

  if (loading) {
    return (
      <div className="mt-8 pt-8 pb-8 pl-4 border-t border-border">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
          Media Assets
        </h3>
        <div className="text-sm text-muted-foreground">Loading assets...</div>
      </div>
    )
  }

  return (
    <>
      <div className="mt-8 pt-8 pb-8 pl-4 border-t border-border">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
          Media Assets
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="group rounded-xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="aspect-square w-full overflow-hidden bg-muted">
                {asset.file_type.startsWith("image/") ? (
                  <img
                    src={asset.file_path}
                    alt={asset.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {getAssetIcon(asset.file_type)}
                  </div>
                )}
              </div>
              <div className="p-2 flex items-center justify-between gap-1 min-w-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate" title={asset.name}>{asset.name}</p>
                  {asset.is_primary && (
                    <Badge variant="secondary" className="text-[10px] mt-0.5">Primary</Badge>
                  )}
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  {!asset.is_primary && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleSetPrimary(asset.id)}
                      title="Set as primary"
                    >
                      <Star className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => setDetachId(asset.id)}
                    title="Remove from content"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={onOpenUpload}
            className="group rounded-xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col cursor-pointer text-left"
          >
            <div className="aspect-square w-full overflow-hidden bg-muted flex items-center justify-center">
              <UploadCloud className="h-10 w-10 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
            <div className="p-2 min-w-0">
              <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">Add asset</p>
              <p className="text-[10px] text-muted-foreground/80">Drop or click</p>
            </div>
          </button>
        </div>
      </div>

      <AlertDialog open={!!detachId} onOpenChange={(open) => !open && setDetachId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove asset from content</AlertDialogTitle>
            <AlertDialogDescription>
              The asset will be unlinked from this content. The file will remain in your asset library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => detachId && handleDetach(detachId)}
              className="!bg-destructive hover:!bg-destructive/90 !text-destructive-foreground"
              disabled={isDetaching}
            >
              {isDetaching ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
