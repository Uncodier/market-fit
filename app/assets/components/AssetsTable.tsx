"use client"

import React, { useRef, useState } from "react"
import { format } from "date-fns"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { Button } from "@/app/components/ui/button"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Download, ExternalLink, FileText, FileVideo, Image, Link as LinkIcon, Trash2, Unlink, UploadCloud } from "@/app/components/ui/icons"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
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
import { useLocalization } from "@/app/context/LocalizationContext"
import { deleteAsset } from "@/app/assets/actions"
import { toast } from "sonner"
import {
  DocumentListHead,
  DocumentListRow,
  documentListShellClassName,
} from "@/app/components/documents/document-list"
import {
  AssetWithThumbnail,
  formatFileSize,
  getFileTypeCategory,
} from "./asset-utils"

interface AssetsTableProps {
  assets: AssetWithThumbnail[]
  onDelete: (id: string) => void
  onAttach?: (assetId: string) => void
  onDetach?: (assetId: string) => void
  agentId?: string
  emptyType?: "all" | "images" | "videos" | "documents"
}

function AssetThumb({ asset }: { asset: AssetWithThumbnail }) {
  const [imageError, setImageError] = useState(false)
  const pausedRef = useRef(false)
  const shouldShowImage = asset.file_type.startsWith("image/") && !imageError
  const shouldShowVideoPreview = asset.file_type.startsWith("video/") && !imageError
  const category = getFileTypeCategory(asset.file_type)

  return (
    <div className="h-9 w-9 rounded-md overflow-hidden flex-shrink-0 bg-muted">
      {shouldShowImage ? (
        <img src={asset.file_path} alt={asset.name} className="object-cover w-full h-full" onError={() => setImageError(true)} />
      ) : shouldShowVideoPreview ? (
        <video
          src={asset.file_path ? (asset.file_path.includes("#") ? asset.file_path : `${asset.file_path}#t=0.001`) : undefined}
          className="object-cover w-full h-full"
          controls={false}
          muted
          playsInline
          preload="metadata"
          poster={asset.thumbnailUrl}
          onError={() => setImageError(true)}
          onTimeUpdate={(e) => {
            const video = e.target as HTMLVideoElement
            if (!pausedRef.current && !asset.thumbnailUrl && video.currentTime > 0.1) {
              pausedRef.current = true
              video.pause()
              video.currentTime = 0.001
            }
          }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
          {category === "image" ? <Image className="h-4 w-4" /> : category === "video" ? <FileVideo className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
        </div>
      )}
    </div>
  )
}

export function AssetsTable({
  assets,
  onDelete,
  onAttach,
  onDetach,
  agentId,
  emptyType = "all",
}: AssetsTableProps) {
  const { t } = useLocalization()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDownload = (asset: AssetWithThumbnail) => {
    const fileName = asset.name || asset.file_path.split("/").pop() || "download"
    const link = document.createElement("a")
    link.href = asset.file_path
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(t("assets.toast.downloadStarted") || "Download started")
  }

  const handleDelete = async (asset: AssetWithThumbnail) => {
    setIsDeleting(true)
    try {
      const result = await deleteAsset(asset.id)
      if (result.error) throw new Error(result.error)
      onDelete(asset.id)
      toast.success(t("assets.toast.deleted") || "Asset deleted successfully")
    } catch {
      toast.error(t("assets.toast.deleteFailed") || "Error deleting asset")
    } finally {
      setIsDeleting(false)
      setDeletingId(null)
    }
  }

  if (assets.length === 0) {
    const empty = {
      all: { icon: <UploadCloud className="w-10 h-10 text-muted-foreground" />, title: t("assets.empty.title"), description: t("assets.empty.desc") },
      images: { icon: <Image className="w-10 h-10 text-muted-foreground" />, title: t("assets.empty.images"), description: t("assets.empty.imagesDesc") },
      videos: { icon: <FileVideo className="w-10 h-10 text-muted-foreground" />, title: t("assets.empty.videos"), description: t("assets.empty.videosDesc") },
      documents: { icon: <FileText className="w-10 h-10 text-muted-foreground" />, title: t("assets.empty.documents"), description: t("assets.empty.documentsDesc") },
    }[emptyType]
    return <EmptyCard icon={empty.icon} title={empty.title} description={empty.description} />
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className={documentListShellClassName()}>
        <Table className="min-w-[760px]">
          <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
            <TableRow className="hover:bg-transparent">
              <DocumentListHead className="w-[42%]">{t("assets.table.name") || "Name"}</DocumentListHead>
              <DocumentListHead className="w-[20%]">{t("assets.table.status") || "Status"}</DocumentListHead>
              <DocumentListHead className="w-[18%]">{t("assets.table.date") || "Date"}</DocumentListHead>
              <DocumentListHead className="w-[20%]" align="right">{t("assets.table.actions") || "Actions"}</DocumentListHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.map((asset) => {
              const category = getFileTypeCategory(asset.file_type)
              const meta = [category, formatFileSize(asset.file_size)].join(" · ")
              const status = asset.isAttachedToAgent
                ? (t("assets.table.attached") || "Attached")
                : (t("assets.table.library") || "Library")
              const dateLabel = asset.created_at ? format(new Date(asset.created_at), "MMM d, yyyy") : "—"

              return (
                <DocumentListRow
                  key={asset.id}
                  onClick={() => window.open(asset.file_path, "_blank")}
                  accent="none"
                >
                  <TableCell className="py-3.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <AssetThumb asset={asset} />
                      <div className="min-w-0 space-y-0.5">
                        <p className="truncate text-sm font-medium leading-tight text-foreground">{asset.name}</p>
                        <p className="truncate text-[11px] leading-tight text-muted-foreground">{meta}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-3.5 text-sm text-muted-foreground">
                    {status}
                  </TableCell>
                  <TableCell className="py-3.5 text-sm text-muted-foreground">
                    {dateLabel}
                  </TableCell>
                  <TableCell className="py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
                    <div className="flex justify-end gap-0.5 opacity-100 md:opacity-0 transition-opacity group-hover:opacity-100">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(asset.file_path, "_blank")}>
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("common.open") || "Open"}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(asset)}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("common.download") || "Download"}</TooltipContent>
                      </Tooltip>
                      {agentId && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => asset.isAttachedToAgent ? onDetach?.(asset.id) : onAttach?.(asset.id)}
                            >
                              {asset.isAttachedToAgent ? <Unlink className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {asset.isAttachedToAgent ? (t("assets.detach") || "Detach") : (t("assets.attach") || "Attach")}
                          </TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeletingId(asset.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("common.delete") || "Delete"}</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </DocumentListRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("assets.delete.title") || "Delete Asset"}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("assets.delete.description") || "This action cannot be undone. This will permanently delete the asset from your media library."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel") || "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const asset = assets.find((row) => row.id === deletingId)
                if (asset) handleDelete(asset)
              }}
              className="!bg-destructive hover:!bg-destructive/90 !text-destructive-foreground"
              disabled={isDeleting}
            >
              {isDeleting ? (t("common.deleting") || "Deleting...") : (t("common.delete") || "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  )
}
