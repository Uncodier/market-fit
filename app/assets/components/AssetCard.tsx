"use client"

import { useState, useRef } from "react"
import { Button } from "@/app/components/ui/button"
import { Card } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { ExternalLink, Trash2, Download, Image, FileVideo, FileText, Link as LinkIcon, Unlink } from "@/app/components/ui/icons"
import { toast } from "sonner"
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/app/components/ui/tooltip"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/app/components/ui/alert-dialog"
import { deleteAsset } from "@/app/assets/actions"
import { getFileTypeCategory, getTypeColor, formatFileSize, type AssetWithThumbnail } from "./asset-utils"

export function AssetCard({ 
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
  const pausedRef = useRef(false)

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
  const shouldShowVideoPreview = asset.file_type.startsWith('video/') && !imageError
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

  return (
    <>
      <Card className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
        <div className="aspect-square w-full relative overflow-hidden bg-gradient-to-br from-muted/40 to-muted/60">
          {shouldShowImage ? (
            <img
              src={asset.file_path}
              alt={asset.name}
              className="object-cover w-full h-full transition-all duration-300 hover:scale-[1.02]"
              onError={() => setImageError(true)}
            />
          ) : shouldShowVideoPreview ? (
            <video
              src={asset.file_path ? (asset.file_path.includes('#') ? asset.file_path : `${asset.file_path}#t=0.001`) : undefined}
              className="object-cover w-full h-full transition-all duration-300 hover:scale-[1.02]"
              controls={false}
              muted
              playsInline
              autoPlay={!asset.thumbnailUrl}
              preload="metadata"
              poster={asset.thumbnailUrl}
              onError={() => setImageError(true)}
              onLoadedData={() => {
                // Initial fallback load flag
              }}
              onTimeUpdate={(e) => {
                const video = e.target as HTMLVideoElement;
                if (!pausedRef.current && !asset.thumbnailUrl && video.currentTime > 0.1) {
                  pausedRef.current = true;
                  video.pause();
                  video.currentTime = 0.001;
                }
              }}
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

