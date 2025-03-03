"use client"

import { Button } from "@/app/components/ui/button"
import { Card } from "@/app/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Badge } from "@/app/components/ui/badge"
import { ExternalLink, PlusCircle, Filter, Search, ChevronDown, ChevronUp, Trash2, Download, Image, FileVideo, FileText, UploadCloud } from "@/app/components/ui/icons"
import { Input } from "@/app/components/ui/input"
import React, { useEffect, useState } from "react"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { getAssets, deleteAsset, type Asset } from "@/app/assets/actions"
import { useSite } from "@/app/context/SiteContext"
import { toast } from "sonner"
import { Skeleton } from "@/app/components/ui/skeleton"
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

interface AssetWithThumbnail extends Asset {
  thumbnailUrl?: string
  tags: string[]
}

function AssetCardSkeleton() {
  return (
    <Card className="group relative overflow-hidden transition-all duration-300">
      <div className="aspect-[4/3] relative overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
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

function AssetCard({ asset, onDelete }: { asset: AssetWithThumbnail, onDelete: () => void }) {
  const [imageError, setImageError] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const getDefaultThumbnail = (type: string): string | undefined => {
    switch (type) {
      case "image":
        return "https://via.placeholder.com/300x200/f3f4f6/6b7280?text=Image"
      case "video":
        return "https://via.placeholder.com/300x200/f3f4f6/6b7280?text=Video"
      case "document":
        return undefined
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
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

  // Para imágenes, usamos la URL del archivo directamente
  // Para videos, mostramos un thumbnail o un icono
  // Para documentos, mostramos un icono
  const shouldShowImage = asset.file_type === "image" && !imageError

  const getTypeColor = (type: string) => {
    switch (type) {
      case "image":
        return "bg-blue-50 text-blue-700 border-blue-200"
      case "video":
        return "bg-purple-50 text-purple-700 border-purple-200"
      case "document":
        return "bg-amber-50 text-amber-700 border-amber-200"
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
        <div className="aspect-[4/3] relative overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
          {shouldShowImage ? (
            <div className="w-full h-full flex items-center justify-center bg-[#f8f9fa] p-2">
              <img
                src={asset.file_path}
                alt={asset.name}
                className="object-contain w-full h-full transition-all duration-300 hover:scale-[1.02] max-h-full"
                onError={() => setImageError(true)}
              />
            </div>
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
                      className="h-8 w-8 bg-white/90 hover:bg-white transition-colors duration-200"
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
                      className="h-8 w-8 bg-white/90 hover:bg-white transition-colors duration-200"
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

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8 bg-white/90 hover:bg-red-500 hover:text-white transition-colors duration-200"
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
          <div className="absolute top-2 right-2">
            <Badge variant="secondary" className={`${getTypeColor(asset.file_type)} text-xs font-medium capitalize`}>
              {asset.file_type}
            </Badge>
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
                  className="bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200 text-[10px] px-2 py-0 h-4"
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
              className="bg-red-500 hover:bg-red-600 text-white"
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

export default function AssetsPage() {
  const { currentSite, isLoading: isSiteLoading } = useSite()
  const [assets, setAssets] = useState<AssetWithThumbnail[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  
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
            tags: metadata.tags || []
          }
        }) || []
        
        setAssets(assetsWithTags)
      } catch (err) {
        console.error("Error loading assets:", err)
        setError("Error al cargar los assets")
      } finally {
        setIsLoading(false)
      }
    }
    
    loadAssets()
  }, [currentSite?.id, isSiteLoading])

  // Función para manejar la búsqueda
  const handleSearch = (term: string) => {
    setIsSearching(true)
    setSearchTerm(term)
    
    // Simulamos un pequeño retraso para mostrar el estado de búsqueda
    setTimeout(() => {
      setIsSearching(false)
    }, 300)
  }

  const filteredAssets = assets.filter(asset => 
    asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const handleDeleteAsset = (assetId: string) => {
    setAssets(assets.filter(a => a.id !== assetId))
  }

  // Si el sitio está cargando, mostramos el skeleton
  if (isSiteLoading || (isLoading && !error)) {
    return (
      <div className="flex-1 p-0">
        <Tabs defaultValue="all">
          <StickyHeader>
            <div className="px-16 pt-0">
              <div className="flex items-center gap-8">
                <div className="flex-1">
                  <TabsList className="w-full">
                    <TabsTrigger value="all">All Assets</TabsTrigger>
                    <TabsTrigger value="images">Images</TabsTrigger>
                    <TabsTrigger value="videos">Videos</TabsTrigger>
                    <TabsTrigger value="documents">Documents</TabsTrigger>
                  </TabsList>
                </div>
                <div className="relative w-64">
                  <Input 
                    data-command-k-input
                    placeholder="Search assets..." 
                    className="w-full" 
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    icon={<Search className={`h-4 w-4 ${isSearching ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />}
                  />
                  <kbd className="pointer-events-none absolute right-2 top-4 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                    <span className="text-xs">⌘</span>K
                  </kbd>
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
            onClick={() => window.location.reload()}
          >
            Intentar nuevamente
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-0">
      <Tabs defaultValue="all">
        <StickyHeader>
          <div className="px-16 pt-0">
            <div className="flex items-center gap-8">
              <div className="flex-1">
                <TabsList className="w-full">
                  <TabsTrigger value="all">All Assets</TabsTrigger>
                  <TabsTrigger value="images">Images</TabsTrigger>
                  <TabsTrigger value="videos">Videos</TabsTrigger>
                  <TabsTrigger value="documents">Documents</TabsTrigger>
                </TabsList>
              </div>
              <div className="relative w-64">
                <Input 
                  data-command-k-input
                  placeholder="Search assets..." 
                  className="w-full" 
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  icon={<Search className={`h-4 w-4 ${isSearching ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />}
                />
                <kbd className="pointer-events-none absolute right-2 top-4 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                  <span className="text-xs">⌘</span>K
                </kbd>
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
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredAssets.map((asset) => (
                      <AssetCard key={asset.id} asset={asset} onDelete={() => handleDeleteAsset(asset.id)} />
                    ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="images" className="space-y-4">
                {filteredAssets.filter(a => a.file_type === "image").length === 0 ? (
                  <AssetEmptyState type="images" />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredAssets
                      .filter(a => a.file_type === "image")
                      .map((asset) => (
                        <AssetCard key={asset.id} asset={asset} onDelete={() => handleDeleteAsset(asset.id)} />
                      ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="videos" className="space-y-4">
                {filteredAssets.filter(a => a.file_type === "video").length === 0 ? (
                  <AssetEmptyState type="videos" />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredAssets
                      .filter(a => a.file_type === "video")
                      .map((asset) => (
                        <AssetCard key={asset.id} asset={asset} onDelete={() => handleDeleteAsset(asset.id)} />
                      ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="documents" className="space-y-4">
                {filteredAssets.filter(a => a.file_type === "document").length === 0 ? (
                  <AssetEmptyState type="documents" />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredAssets
                      .filter(a => a.file_type === "document")
                      .map((asset) => (
                        <AssetCard key={asset.id} asset={asset} onDelete={() => handleDeleteAsset(asset.id)} />
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