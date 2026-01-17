"use client"

import { Button } from "@/app/components/ui/button"
import { Card } from "@/app/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Badge } from "@/app/components/ui/badge"
import { ExternalLink, PlusCircle, Filter, Search, ChevronDown, ChevronUp, Trash2, Download, Image, FileVideo, FileText, UploadCloud, Link as LinkIcon, Unlink, TableRows, LayoutGrid } from "@/app/components/ui/icons"
import { Input } from "@/app/components/ui/input"
import React, { useEffect, useState, Suspense } from "react"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { getAssets, deleteAsset, attachAssetToAgent, detachAssetFromAgent, getAgentAssets, type Asset } from "@/app/assets/actions"
import { useSite } from "@/app/context/SiteContext"
import { toast } from "sonner"
import { Skeleton } from "@/app/components/ui/skeleton"
import { LoadingSkeleton } from "@/app/components/ui/loading-skeleton"
import { EmptyState } from "@/app/components/ui/empty-state"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/app/components/ui/tooltip"
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
import { useCommandK } from "@/app/hooks/use-command-k"
import { safeReload } from "@/app/utils/safe-reload"
import { useSearchParams } from "next/navigation"
import { ToggleGroup, ToggleGroupItem } from "@/app/components/ui/toggle-group"
import { CardContent } from "@/app/components/ui/card"

interface AssetWithThumbnail extends Asset {
  thumbnailUrl?: string
  tags: string[]
  isAttachedToAgent?: boolean
}

// Compatible file types for agents (same as in upload-file-dialog)
const AGENT_COMPATIBLE_FILE_TYPES = [
  'application/pdf',
  'text/csv',
  'application/vnd.ms-excel',
  'text/markdown',
  'text/plain',
  'application/json',
  'text/yaml',
  'application/x-yaml',
  'image/jpeg',
  'image/png',
  'image/webp'
]

const AGENT_COMPATIBLE_EXTENSIONS = [
  '.pdf', '.csv', '.md', '.txt', '.json', '.yaml', '.yml', '.jpg', '.jpeg', '.png', '.webp'
]

// Helper function to normalize MIME type to category (image/video/document)
const getFileTypeCategory = (fileType: string): "image" | "video" | "document" => {
  if (fileType.startsWith('image/')) {
    return "image"
  }
  if (fileType.startsWith('video/')) {
    return "video"
  }
  return "document"
}

// Helper function to get color classes for file type
const getTypeColor = (fileType: string) => {
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

// Helper function to check if an asset is compatible with agents
const isAssetCompatibleWithAgent = (asset: Asset): boolean => {
  // Check by file type first
  if (AGENT_COMPATIBLE_FILE_TYPES.includes(asset.file_type)) {
    return true
  }
  
  // Then check by extension as fallback
  const extension = `.${asset.name.split('.').pop()?.toLowerCase()}`
  return AGENT_COMPATIBLE_EXTENSIONS.includes(extension)
}

function AssetCardSkeleton() {
  return (
    <Card className="group relative overflow-hidden transition-all duration-300">
      <div className="aspect-[4/3] relative overflow-hidden bg-gradient-to-br from-muted/50 to-muted/70">
        <div className="w-full h-full animate-pulse">
          <Skeleton className="w-full h-full" />
        </div>
        <div className="absolute top-2 right-2 animate-pulse">
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
      <div className="p-4">
        <div className="flex flex-col gap-3">
          <div className="animate-pulse">
            <Skeleton className="h-5 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <div className="flex flex-wrap gap-1.5 animate-pulse">
            <Skeleton className="h-4 w-12 rounded-full" />
            <Skeleton className="h-4 w-16 rounded-full" />
            <Skeleton className="h-4 w-14 rounded-full" />
          </div>
        </div>
      </div>
    </Card>
  )
}

function AssetCard({ 
  asset, 
  onDelete, 
  onAttach, 
  onDetach, 
  isCompatibleWithAgent = false, 
  agentId 
}: { 
  asset: AssetWithThumbnail
  onDelete: () => void
  onAttach?: (assetId: string) => void
  onDetach?: (assetId: string) => void
  isCompatibleWithAgent?: boolean
  agentId?: string
}) {
  const [imageError, setImageError] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [useGoogleViewer, setUseGoogleViewer] = useState(false)
  const [textContent, setTextContent] = useState<string | null>(null)
  const [isLoadingText, setIsLoadingText] = useState(false)

  const getDefaultThumbnail = (fileType: string): string | undefined => {
    const category = getFileTypeCategory(fileType)
    switch (category) {
      case "image":
        return "https://via.placeholder.com/300x200/f3f4f6/6b7280?text=Image"
      case "video":
        return "https://via.placeholder.com/300x200/f3f4f6/6b7280?text=Video"
      case "document":
        return undefined
    }
  }

  const getIcon = (fileType: string) => {
    const category = getFileTypeCategory(fileType)
    switch (category) {
      case "image":
        return (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-[#f8f9fa]">
            <div className="bg-blue-50 p-4 rounded-full">
              <Image className="h-12 w-12 text-blue-500" />
            </div>
            <span className="text-sm font-medium text-gray-600">Image not available</span>
          </div>
        )
      case "video":
        return (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-[#f8f9fa]">
            <div className="bg-purple-50 p-4 rounded-full">
              <FileVideo className="h-12 w-12 text-purple-500" />
            </div>
            <span className="text-sm font-medium text-gray-600">Video preview</span>
          </div>
        )
      case "document":
        return (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-[#f8f9fa]">
            <div className="bg-amber-50 p-4 rounded-full">
              <FileText className="h-12 w-12 text-amber-500" />
            </div>
            <span className="text-sm font-medium text-gray-600">Document preview</span>
          </div>
        )
    }
  }

  const getDocumentPreview = () => {
    const fileExtension = asset.name.split('.').pop()?.toLowerCase()
    const isPDF = fileExtension === 'pdf'
    const fileName = asset.name.toLowerCase()
    
    // Detectar archivos de texto (incluyendo archivos sin extensión que podrían ser texto)
    const isTextFile = !fileExtension || // Sin extensión, podría ser texto
      ['txt', 'md', 'json', 'xml', 'csv', 'log', 'conf', 'config', 'yml', 'yaml', 'ini', 'env'].includes(fileExtension) ||
      fileName.includes('readme') || 
      fileName.includes('faq') ||
      fileName.includes('changelog') ||
      fileName.includes('license') ||
      fileName.includes('config')
    
    // URLs para diferentes métodos de visualización
    const directPdfUrl = isPDF ? `${asset.file_path}#toolbar=0&navpanes=0&scrollbar=0&view=FitH` : asset.file_path
    const googleViewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(asset.file_path)}&embedded=true`
    
    const handleDirectLoadError = () => {
      if (isPDF && !useGoogleViewer) {
        // Si el PDF directo falla, intentar con Google Viewer
        setUseGoogleViewer(true)
      } else {
        // Si Google Viewer también falla, mostrar fallback
        setImageError(true)
      }
    }

    // Función para cargar contenido de texto
    const loadTextContent = async () => {
      if (textContent !== null || isLoadingText) return // Ya cargado o cargando
      
      setIsLoadingText(true)
      try {
        const response = await fetch(asset.file_path)
        if (response.ok) {
          const text = await response.text()
          setTextContent(text)
        } else {
          setImageError(true)
        }
      } catch (error) {
        console.error('Error loading text content:', error)
        setImageError(true)
      } finally {
        setIsLoadingText(false)
      }
    }

    // Cargar contenido de texto si es necesario
    if (isTextFile && textContent === null && !isLoadingText && !imageError) {
      loadTextContent()
    }
    
    return (
      <div className="w-full h-full bg-white relative">
        {isPDF ? (
          // Para PDFs, intentar carga directa primero, luego Google Viewer
          <iframe
            key={useGoogleViewer ? 'google' : 'direct'} // Force re-render when switching
            src={useGoogleViewer ? googleViewerUrl : directPdfUrl}
            className="w-full h-full border-0"
            title={asset.name}
            onError={handleDirectLoadError}
            onLoad={(e) => {
              // Verificar si el iframe cargó correctamente
              try {
                const iframe = e.target as HTMLIFrameElement
                setTimeout(() => {
                  if (!iframe.contentWindow) {
                    handleDirectLoadError()
                  }
                }, useGoogleViewer ? 3000 : 1500)
              } catch (error) {
                handleDirectLoadError()
              }
            }}
          />
        ) : isTextFile ? (
          // Para archivos de texto, mostrar contenido cargado
          <div className="w-full h-full relative">
            {isLoadingText ? (
              <div className="w-full h-full flex items-center justify-center bg-gray-50">
                <div className="text-center">
                  <LoadingSkeleton variant="fullscreen" size="md" />
                  <p className="mt-2 text-sm text-gray-600">Loading content...</p>
                </div>
              </div>
            ) : textContent ? (
              <div className="w-full h-full overflow-auto bg-white p-4">
                <pre 
                  className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800"
                  style={{
                    fontFamily: 'Monaco, Consolas, "Lucida Console", monospace',
                    fontSize: '13px',
                    lineHeight: '1.6'
                  }}
                >
                  {textContent}
                </pre>
              </div>
            ) : (
              // Fallback mientras carga
              <div className="w-full h-full flex items-center justify-center bg-gray-50">
                <div className="text-center">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Preparing preview...</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          // Para otros tipos, mostrar placeholder
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
            <div className="bg-blue-100 p-6 rounded-2xl">
              <FileText className="h-16 w-16 text-blue-600" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-blue-800 mb-1">Document</p>
              <p className="text-xs text-blue-600 uppercase tracking-wide font-medium">
                {fileExtension || 'No Extension'}
              </p>
            </div>
            <div className="text-xs text-blue-700/70 text-center max-w-48">
              Click "Open" to view the {fileExtension?.toUpperCase() || 'file'}
            </div>
          </div>
        )}
        
        {/* Fallback overlay cuando todo falla */}
        {imageError && (
          <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-amber-50 to-orange-50 p-6">
            <div className="bg-amber-100 p-6 rounded-2xl">
              <FileText className="h-16 w-16 text-amber-600" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-amber-800 mb-1">
                {isPDF ? 'PDF Preview' : 'Document Preview'}
              </p>
              <p className="text-xs text-amber-600 uppercase tracking-wide font-medium">
                {fileExtension || 'Document'}
              </p>
            </div>
            <div className="text-xs text-amber-700/70 text-center">
              Preview not available - Click "Open" to view
            </div>
            {isPDF && (
              <div className="text-[10px] text-amber-600/60 text-center mt-2">
                PDF viewer blocked by security policy
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // Para imágenes, usamos la URL del archivo directamente
  // Para videos, mostramos un thumbnail o un icono
  // Para documentos, intentamos mostrar un preview en iframe
  const shouldShowImage = asset.file_type.startsWith('image/') && !imageError
  const shouldShowDocumentPreview = !asset.file_type.startsWith('image/') && !asset.file_type.startsWith('video/') && !imageError

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const result = await deleteAsset(asset.id)
      if (result.error) {
        throw new Error(result.error)
      }
      onDelete()
      toast.success("Asset deleted successfully")
    } catch (error) {
      console.error("Error deleting asset:", error)
      toast.error("Error deleting asset")
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.open(asset.file_path, '_blank')
  }

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsDownloading(true)
    
    try {
      // Obtener el nombre del archivo de la URL
      const fileName = asset.name || asset.file_path.split('/').pop() || 'download'
      
      // Crear un elemento <a> temporal
      const link = document.createElement('a')
      link.href = asset.file_path
      link.download = fileName
      
      // Añadir al DOM, hacer clic y luego eliminar
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast.success("Download started")
    } catch (error) {
      console.error("Error downloading asset:", error)
      toast.error("Error downloading file")
    } finally {
      setIsDownloading(false)
    }
  }

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes || bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <>
      <Card className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
        <div className="aspect-[4/3] relative overflow-hidden bg-gradient-to-br from-muted/40 to-muted/60">
          {shouldShowImage ? (
            <img
              src={asset.file_path}
              alt={asset.name}
              className="object-cover w-full h-full transition-all duration-300 hover:scale-[1.02]"
              onError={() => setImageError(true)}
            />
          ) : shouldShowDocumentPreview ? (
            getDocumentPreview()
          ) : (
            getIcon(asset.file_type)
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end justify-center gap-2 p-4">
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8 bg-white/90 hover:bg-white dark:bg-gray-800/90 dark:hover:bg-gray-800 transition-colors duration-200"
                      onClick={handleOpen}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Open</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8 bg-white/90 hover:bg-white dark:bg-gray-800/90 dark:hover:bg-gray-800 transition-colors duration-200"
                      onClick={handleDownload}
                      disabled={isDownloading}
                    >
                      <Download className={`h-4 w-4 ${isDownloading ? 'animate-pulse' : ''}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Download</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Agent attach/detach buttons - only show if compatible and agentId is provided */}
              {isCompatibleWithAgent && agentId && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        className={`h-8 w-8 transition-colors duration-200 ${
                          asset.isAttachedToAgent 
                            ? 'bg-green-500/90 hover:bg-red-500 text-white dark:bg-green-600/90 dark:hover:bg-red-600' 
                            : 'bg-white/90 hover:bg-green-500 hover:text-white dark:bg-gray-800/90 dark:hover:bg-green-600'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (asset.isAttachedToAgent) {
                            onDetach?.(asset.id)
                          } else {
                            onAttach?.(asset.id)
                          }
                        }}
                      >
                        {asset.isAttachedToAgent ? (
                          <Unlink className="h-4 w-4" />
                        ) : (
                          <LinkIcon className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{asset.isAttachedToAgent ? 'Detach from Agent' : 'Attach to Agent'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8 bg-white/90 hover:bg-red-500 hover:text-white dark:bg-gray-800/90 dark:hover:bg-red-500 transition-colors duration-200"
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowDeleteDialog(true)
                      }}
                      disabled={isDeleting}
                    >
                      <Trash2 className={`h-4 w-4 ${isDeleting ? 'animate-pulse' : ''}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
            <Badge variant="secondary" className={`${getTypeColor(asset.file_type)} text-xs font-medium capitalize px-1 py-0.5 w-fit`}>
              {getFileTypeCategory(asset.file_type)}
            </Badge>
            {isCompatibleWithAgent && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-medium px-1 py-0.5 w-fit">
                Agent Compatible
              </Badge>
            )}
            {asset.isAttachedToAgent && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] font-medium px-1 py-0.5 w-fit">
                Attached
              </Badge>
            )}
          </div>
        </div>
        <div className="p-4">
          <div className="flex flex-col gap-3">
            <div>
              <div className="font-medium truncate text-sm">{asset.name}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                <span>{formatFileSize(asset.file_size)}</span>
                <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                <span>{new Date(asset.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {asset.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200 text-[10px] px-2 py-0.5 h-auto whitespace-nowrap"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Asset</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the asset 
              "{asset.name}" from your media library and remove it from your projects.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="!bg-destructive hover:!bg-destructive/90 !text-destructive-foreground"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Asset"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function AssetListItem({ 
  asset, 
  onDelete, 
  onAttach, 
  onDetach, 
  isCompatibleWithAgent = false, 
  agentId 
}: { 
  asset: AssetWithThumbnail
  onDelete: () => void
  onAttach?: (assetId: string) => void
  onDetach?: (assetId: string) => void
  isCompatibleWithAgent?: boolean
  agentId?: string
}) {
  const [imageError, setImageError] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const shouldShowImage = asset.file_type.startsWith('image/') && !imageError

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes || bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.open(asset.file_path, '_blank')
  }

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsDownloading(true)
    
    try {
      const fileName = asset.name || asset.file_path.split('/').pop() || 'download'
      const link = document.createElement('a')
      link.href = asset.file_path
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success("Download started")
    } catch (error) {
      console.error("Error downloading asset:", error)
      toast.error("Error downloading file")
    } finally {
      setIsDownloading(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const result = await deleteAsset(asset.id)
      if (result.error) {
        throw new Error(result.error)
      }
      onDelete()
      toast.success("Asset deleted successfully")
    } catch (error) {
      console.error("Error deleting asset:", error)
      toast.error("Error deleting asset")
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  return (
    <>
      <Card className="border border-border hover:border-foreground/20 transition-colors overflow-hidden">
        <div className="flex items-center hover:bg-muted/50 transition-colors w-full">
          <CardContent className="flex-1 p-2 w-full overflow-x-auto">
            <div className="flex items-center gap-3 min-w-[800px]">
              {/* Thumbnail */}
              <div className="w-16 h-16 min-w-[64px] flex-shrink-0 rounded-lg overflow-hidden bg-muted/50">
                {shouldShowImage ? (
                  <img
                    src={asset.file_path}
                    alt={asset.name}
                    className="object-cover w-full h-full"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {getFileTypeCategory(asset.file_type) === "image" ? (
                      <Image className="h-6 w-6 text-muted-foreground" />
                    ) : getFileTypeCategory(asset.file_type) === "video" ? (
                      <FileVideo className="h-6 w-6 text-muted-foreground" />
                    ) : (
                      <FileText className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                )}
              </div>

              {/* Asset Info */}
              <div className="flex-1 min-w-0 pr-3">
                <h3 className="font-semibold text-sm truncate">{asset.name}</h3>
                {asset.description && (
                  <p className="text-xs text-muted-foreground/80 truncate mt-0.5">
                    {asset.description}
                  </p>
                )}
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <Badge variant="secondary" className={`${getTypeColor(asset.file_type)} text-xs font-medium capitalize px-1 py-0.5 w-fit`}>
                    {getFileTypeCategory(asset.file_type)}
                  </Badge>
                  {asset.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200 text-[10px] px-2 py-0.5 h-auto whitespace-nowrap"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* File Size */}
              <div className="w-[100px] min-w-[100px] flex-shrink-0">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">Size</p>
                <p className="text-xs font-medium truncate">{formatFileSize(asset.file_size)}</p>
              </div>

              {/* Created Date */}
              <div className="w-[120px] min-w-[120px] flex-shrink-0">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">Created</p>
                <p className="text-xs font-medium truncate">{new Date(asset.created_at).toLocaleDateString()}</p>
              </div>

              {/* Actions */}
              <div className="w-[160px] min-w-[160px] flex-shrink-0 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleOpen}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Open</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleDownload}
                        disabled={isDownloading}
                      >
                        <Download className={`h-4 w-4 ${isDownloading ? 'animate-pulse' : ''}`} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Download</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {isCompatibleWithAgent && agentId && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-8 w-8 ${
                            asset.isAttachedToAgent 
                              ? 'text-green-600 hover:text-red-600' 
                              : 'hover:text-green-600'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (asset.isAttachedToAgent) {
                              onDetach?.(asset.id)
                            } else {
                              onAttach?.(asset.id)
                            }
                          }}
                        >
                          {asset.isAttachedToAgent ? (
                            <Unlink className="h-4 w-4" />
                          ) : (
                            <LinkIcon className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{asset.isAttachedToAgent ? 'Detach from Agent' : 'Attach to Agent'}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowDeleteDialog(true)
                        }}
                        disabled={isDeleting}
                      >
                        <Trash2 className={`h-4 w-4 ${isDeleting ? 'animate-pulse' : ''}`} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Delete</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </CardContent>
        </div>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Asset</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the asset 
              "{asset.name}" from your media library and remove it from your projects.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="!bg-destructive hover:!bg-destructive/90 !text-destructive-foreground"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Asset"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

const AssetEmptyState = ({ type }: { type: "all" | "images" | "videos" | "documents" }) => {
  const emptyStateProps = {
    all: {
      icon: <UploadCloud className="w-24 h-24 text-primary/40" />,
      title: "No assets found",
      description: "Upload your first asset to get started with your media library.",
    },
    images: {
      icon: <Image className="w-24 h-24 text-primary/40" />,
      title: "No images found",
      description: "Upload images to enhance your content with visual elements.",
    },
    videos: {
      icon: <FileVideo className="w-24 h-24 text-primary/40" />,
      title: "No videos found",
      description: "Upload videos to engage your audience with rich media content.",
    },
    documents: {
      icon: <FileText className="w-24 h-24 text-primary/40" />,
      title: "No documents found",
      description: "Upload documents to share important information with your audience.",
    },
  }

  return (
    <EmptyState {...emptyStateProps[type]} />
  )
}

type AssetViewType = 'grid' | 'list'

function AssetViewSelector({ currentView, onViewChange }: { currentView: AssetViewType, onViewChange: (view: AssetViewType) => void }) {
  return (
    <ToggleGroup type="single" value={currentView} onValueChange={(value: string) => value && onViewChange(value as AssetViewType)}>
      <ToggleGroupItem value="grid" aria-label="Toggle grid view" className="px-2">
        <LayoutGrid className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="list" aria-label="Toggle list view" className="px-2">
        <TableRows className="h-4 w-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

export default function AssetsPage() {
  return (
    <Suspense fallback={<AssetsLoadingPage />}>
      <AssetsContent />
    </Suspense>
  )
}

// Loading page component that doesn't use useSearchParams
function AssetsLoadingPage() {
  return (
    <div className="flex-1 p-0">
      <Tabs defaultValue="all">
        <StickyHeader>
          <div className="px-16 pt-0">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-8">
                  <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full">
                    <TabsTrigger value="all" className="text-xs rounded-full">All Assets</TabsTrigger>
                    <TabsTrigger value="images" className="text-xs rounded-full">Images</TabsTrigger>
                    <TabsTrigger value="videos" className="text-xs rounded-full">Videos</TabsTrigger>
                    <TabsTrigger value="documents" className="text-xs rounded-full">Documents</TabsTrigger>
                  </TabsList>
                <div className="relative w-64">
                  <Input 
                    placeholder="Search assets..." 
                    className="w-full pr-16"
                    icon={<Search className="h-4 w-4 text-muted-foreground" />}
                    disabled
                  />
                  <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex z-20">
                    <span className="text-xs">⌘</span>K
                  </kbd>
                </div>
              </div>
              <div className="ml-auto">
                {/* Any other buttons would go here */}
              </div>
            </div>
          </div>
        </StickyHeader>
        
        <div className="p-8 space-y-4">
          <div className="px-8">
            <>
              <TabsContent value="all" className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <AssetCardSkeleton key={index} />
                  ))}
                </div>
              </TabsContent>
            </>
          </div>
        </div>
      </Tabs>
    </div>
  )
}

// Content component that uses useSearchParams
function AssetsContent() {
  const { currentSite, isLoading: isSiteLoading } = useSite()
  const [assets, setAssets] = useState<AssetWithThumbnail[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [attachedAssetIds, setAttachedAssetIds] = useState<string[]>([])
  const [viewType, setViewType] = useState<AssetViewType>('grid')
  
  // Get agent ID from URL parameters
  const searchParams = useSearchParams()
  const agentId = searchParams.get('agent')
  
  // Usar el hook de Command+K
  useCommandK()

  useEffect(() => {
    async function loadAssets() {
      try {
        // Si el sitio está cargando, mantenemos el estado de carga
        if (isSiteLoading) return

        // Si no hay sitio seleccionado después de la carga
        if (!currentSite?.id) {
          setError("Por favor, selecciona un sitio primero")
          setIsLoading(false)
          return
        }
        
        setIsLoading(true)
        const { assets: fetchedAssets, error } = await getAssets(currentSite.id)
        
        if (error) throw new Error(error)
        
        // Transformar los assets para incluir las etiquetas desde metadata
        const assetsWithTags = fetchedAssets?.map(asset => {
          const metadata = asset.metadata as { tags?: string[] } || {}
          return {
            ...asset,
            tags: metadata.tags || [],
            isAttachedToAgent: false // Will be updated when agent assets are loaded
          }
        }) || []
        
        setAssets(assetsWithTags)
        
        // If agentId is provided, load attached assets
        if (agentId) {
          console.log("Loading attached assets for agent:", agentId)
          const { assetIds, error: agentAssetsError } = await getAgentAssets(agentId)
          
          if (agentAssetsError) {
            console.error("Error loading agent assets:", agentAssetsError)
          } else if (assetIds) {
            console.log("Found attached assets:", assetIds)
            setAttachedAssetIds(assetIds)
            
            // Update assets to mark which ones are attached
            setAssets(prev => prev.map(asset => ({
              ...asset,
              isAttachedToAgent: assetIds.includes(asset.id)
            })))
          }
        }
      } catch (err) {
        console.error("Error loading assets:", err)
        setError("Error al cargar los assets")
      } finally {
        setIsLoading(false)
      }
    }
    
    loadAssets()
  }, [currentSite?.id, isSiteLoading, agentId])
  
  // Handle attaching asset to agent
  const handleAttach = async (assetId: string) => {
    if (!agentId) return
    
    console.log("Attaching asset", assetId, "to agent", agentId)
    const { error } = await attachAssetToAgent(agentId, assetId)
    
    if (error) {
      console.error("Error attaching asset:", error)
      toast.error("Failed to attach asset to agent")
      return
    }
    
    // Update local state
    setAttachedAssetIds(prev => [...prev, assetId])
    setAssets(prev => prev.map(asset => 
      asset.id === assetId 
        ? { ...asset, isAttachedToAgent: true }
        : asset
    ))
    
    toast.success("Asset attached to agent successfully")
  }
  
  // Handle detaching asset from agent
  const handleDetach = async (assetId: string) => {
    if (!agentId) return
    
    console.log("Detaching asset", assetId, "from agent", agentId)
    const { error } = await detachAssetFromAgent(agentId, assetId)
    
    if (error) {
      console.error("Error detaching asset:", error)
      toast.error("Failed to detach asset from agent")
      return
    }
    
    // Update local state
    setAttachedAssetIds(prev => prev.filter(id => id !== assetId))
    setAssets(prev => prev.map(asset => 
      asset.id === assetId 
        ? { ...asset, isAttachedToAgent: false }
        : asset
    ))
    
    toast.success("Asset detached from agent successfully")
  }

  // Función para manejar la búsqueda
  const handleSearch = (term: string) => {
    setIsSearching(true)
    setSearchTerm(term)
    
    // Simulamos un pequeño retraso para mostrar el estado de búsqueda
    setTimeout(() => {
      setIsSearching(false)
    }, 300)
  }

  // Filter assets based on search term and agent compatibility
  let filteredAssets = assets.filter(asset => {
    // Search term filter
    const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    
    // If agentId is provided, only show compatible assets
    if (agentId) {
      return matchesSearch && isAssetCompatibleWithAgent(asset)
    }
    
    return matchesSearch
  })

  const handleDeleteAsset = (assetId: string) => {
    setAssets(assets.filter(a => a.id !== assetId))
  }

  // Si el sitio está cargando, mostramos el skeleton
  if (isSiteLoading || (isLoading && !error)) {
    return (
      <div className="flex-1 p-0 bg-muted/30 min-h-[calc(100vh-64px)]">
        <Tabs defaultValue="all">
          <StickyHeader>
            <div className="px-16 pt-0">
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-8">
                  <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full">
                    <TabsTrigger value="all" className="text-xs rounded-full">All Assets</TabsTrigger>
                    <TabsTrigger value="images" className="text-xs rounded-full">Images</TabsTrigger>
                    <TabsTrigger value="videos" className="text-xs rounded-full">Videos</TabsTrigger>
                    <TabsTrigger value="documents" className="text-xs rounded-full">Documents</TabsTrigger>
                  </TabsList>
                  <div className="relative w-64">
                    <Input 
                      data-command-k-input
                      placeholder="Search assets..." 
                      className="w-full pr-16" 
                      value={searchTerm}
                      onChange={(e) => handleSearch(e.target.value)}
                      icon={<Search className={`h-4 w-4 ${isSearching ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />}
                    />
                    <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex z-20">
                      <span className="text-xs">⌘</span>K
                    </kbd>
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-4">
                  {agentId && (
                    <div className="text-sm text-muted-foreground">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        Agent Mode: {agentId}
                      </Badge>
                    </div>
                  )}
                  <AssetViewSelector currentView={viewType} onViewChange={setViewType} />
                </div>
              </div>
            </div>
          </StickyHeader>
          
          <div className="p-8 space-y-4">
            <div className="px-8">
              <>
                <TabsContent value="all" className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, index) => (
                      <AssetCardSkeleton key={index} />
                    ))}
                  </div>
                </TabsContent>
                <TabsContent value="images" className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <AssetCardSkeleton key={index} />
                    ))}
                  </div>
                </TabsContent>
                <TabsContent value="videos" className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <AssetCardSkeleton key={index} />
                    ))}
                  </div>
                </TabsContent>
                <TabsContent value="documents" className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <AssetCardSkeleton key={index} />
                    ))}
                  </div>
                </TabsContent>
              </>
            </div>
          </div>
        </Tabs>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center space-y-4">
          <p className="text-red-500 mb-4">{error}</p>
          <Button 
            variant="outline" 
            onClick={() => safeReload(false, 'Assets page error retry')}
          >
            Intentar nuevamente
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-0 bg-muted/30 min-h-[calc(100vh-64px)]">
      <Tabs defaultValue="all">
        <StickyHeader>
          <div className="px-16 pt-0">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-8">
                <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full">
                  <TabsTrigger value="all" className="text-xs rounded-full">{agentId ? 'Compatible Assets' : 'All Assets'}</TabsTrigger>
                  <TabsTrigger value="images" className="text-xs rounded-full">Images</TabsTrigger>
                  <TabsTrigger value="videos" className="text-xs rounded-full">Videos</TabsTrigger>
                  <TabsTrigger value="documents" className="text-xs rounded-full">Documents</TabsTrigger>
                </TabsList>
                <div className="relative w-64">
                  <Input 
                    data-command-k-input
                    placeholder="Search assets..." 
                    className="w-full pr-16" 
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    icon={<Search className={`h-4 w-4 ${isSearching ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />}
                  />
                  <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex z-20">
                    <span className="text-xs">⌘</span>K
                  </kbd>
                </div>
              </div>
              <div className="ml-auto flex items-center gap-4">
                {agentId && (
                  <div className="text-sm text-muted-foreground">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      Agent Mode: {agentId}
                    </Badge>
                  </div>
                )}
                <AssetViewSelector currentView={viewType} onViewChange={setViewType} />
              </div>
            </div>
          </div>
        </StickyHeader>
        
        <div className="p-8 space-y-4">
          <div className="px-8">
            <>
              <TabsContent value="all" className="space-y-4">
                {filteredAssets.length === 0 ? (
                  <AssetEmptyState type="all" />
                ) : viewType === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredAssets.map((asset) => (
                      <AssetCard 
                        key={asset.id} 
                        asset={asset} 
                        onDelete={() => handleDeleteAsset(asset.id)}
                        onAttach={handleAttach}
                        onDetach={handleDetach}
                        isCompatibleWithAgent={isAssetCompatibleWithAgent(asset)}
                        agentId={agentId || undefined}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredAssets.map((asset) => (
                      <AssetListItem
                        key={asset.id}
                        asset={asset}
                        onDelete={() => handleDeleteAsset(asset.id)}
                        onAttach={handleAttach}
                        onDetach={handleDetach}
                        isCompatibleWithAgent={isAssetCompatibleWithAgent(asset)}
                        agentId={agentId || undefined}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="images" className="space-y-4">
                {filteredAssets.filter(a => a.file_type.startsWith('image/')).length === 0 ? (
                  <AssetEmptyState type="images" />
                ) : viewType === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredAssets
                      .filter(a => a.file_type.startsWith('image/'))
                      .map((asset) => (
                        <AssetCard 
                          key={asset.id} 
                          asset={asset} 
                          onDelete={() => handleDeleteAsset(asset.id)}
                          onAttach={handleAttach}
                          onDetach={handleDetach}
                          isCompatibleWithAgent={isAssetCompatibleWithAgent(asset)}
                          agentId={agentId || undefined}
                        />
                      ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredAssets
                      .filter(a => a.file_type.startsWith('image/'))
                      .map((asset) => (
                        <AssetListItem
                          key={asset.id}
                          asset={asset}
                          onDelete={() => handleDeleteAsset(asset.id)}
                          onAttach={handleAttach}
                          onDetach={handleDetach}
                          isCompatibleWithAgent={isAssetCompatibleWithAgent(asset)}
                          agentId={agentId || undefined}
                        />
                      ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="videos" className="space-y-4">
                {filteredAssets.filter(a => a.file_type.startsWith('video/')).length === 0 ? (
                  <AssetEmptyState type="videos" />
                ) : viewType === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredAssets
                      .filter(a => a.file_type.startsWith('video/'))
                      .map((asset) => (
                        <AssetCard 
                          key={asset.id} 
                          asset={asset} 
                          onDelete={() => handleDeleteAsset(asset.id)}
                          onAttach={handleAttach}
                          onDetach={handleDetach}
                          isCompatibleWithAgent={isAssetCompatibleWithAgent(asset)}
                          agentId={agentId || undefined}
                        />
                      ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredAssets
                      .filter(a => a.file_type.startsWith('video/'))
                      .map((asset) => (
                        <AssetListItem
                          key={asset.id}
                          asset={asset}
                          onDelete={() => handleDeleteAsset(asset.id)}
                          onAttach={handleAttach}
                          onDetach={handleDetach}
                          isCompatibleWithAgent={isAssetCompatibleWithAgent(asset)}
                          agentId={agentId || undefined}
                        />
                      ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="documents" className="space-y-4">
                {filteredAssets.filter(a => !a.file_type.startsWith('image/') && !a.file_type.startsWith('video/')).length === 0 ? (
                  <AssetEmptyState type="documents" />
                ) : viewType === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredAssets
                      .filter(a => !a.file_type.startsWith('image/') && !a.file_type.startsWith('video/'))
                      .map((asset) => (
                        <AssetCard 
                          key={asset.id} 
                          asset={asset} 
                          onDelete={() => handleDeleteAsset(asset.id)}
                          onAttach={handleAttach}
                          onDetach={handleDetach}
                          isCompatibleWithAgent={isAssetCompatibleWithAgent(asset)}
                          agentId={agentId || undefined}
                        />
                      ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredAssets
                      .filter(a => !a.file_type.startsWith('image/') && !a.file_type.startsWith('video/'))
                      .map((asset) => (
                        <AssetListItem
                          key={asset.id}
                          asset={asset}
                          onDelete={() => handleDeleteAsset(asset.id)}
                          onAttach={handleAttach}
                          onDetach={handleDetach}
                          isCompatibleWithAgent={isAssetCompatibleWithAgent(asset)}
                          agentId={agentId || undefined}
                        />
                      ))}
                  </div>
                )}
              </TabsContent>
            </>
          </div>
        </div>
      </Tabs>
    </div>
  )
} 