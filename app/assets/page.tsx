"use client"

import { Button } from "@/app/components/ui/button"
import { Card } from "@/app/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Badge } from "@/app/components/ui/badge"
import { ExternalLink, PlusCircle, Filter, Search, ChevronDown, ChevronUp, Trash2, Download, Image, FileVideo, FileText, UploadCloud } from "@/app/components/ui/icons"
import { Input } from "@/app/components/ui/input"
import React from "react"
import { StickyHeader } from "@/app/components/ui/sticky-header"

interface Asset {
  id: string
  name: string
  type: "image" | "video" | "document"
  size: string
  uploadedAt: string
  url: string
  tags: string[]
  thumbnailUrl?: string
}

const assets: Asset[] = [
  {
    id: "1",
    name: "hero-banner.jpg",
    type: "image",
    size: "2.4 MB",
    uploadedAt: "2024-03-15",
    url: "/images/hero-banner.jpg",
    thumbnailUrl: "https://via.placeholder.com/300x200",
    tags: ["Marketing", "Homepage", "Banner"]
  },
  {
    id: "2",
    name: "product-demo.mp4",
    type: "video",
    size: "15.8 MB",
    uploadedAt: "2024-03-14",
    url: "/videos/product-demo.mp4",
    thumbnailUrl: "https://via.placeholder.com/300x200",
    tags: ["Product", "Demo", "Tutorial"]
  },
  {
    id: "3",
    name: "user-guide.pdf",
    type: "document",
    size: "1.2 MB",
    uploadedAt: "2024-03-13",
    url: "/documents/user-guide.pdf",
    tags: ["Documentation", "Guide"]
  },
  {
    id: "4",
    name: "team-photo.jpg",
    type: "image",
    size: "3.1 MB",
    uploadedAt: "2024-03-12",
    url: "/images/team-photo.jpg",
    thumbnailUrl: "https://via.placeholder.com/300x200",
    tags: ["Team", "About"]
  },
  {
    id: "5",
    name: "feature-overview.mp4",
    type: "video",
    size: "22.5 MB",
    uploadedAt: "2024-03-11",
    url: "/videos/feature-overview.mp4",
    thumbnailUrl: "https://via.placeholder.com/300x200",
    tags: ["Features", "Marketing"]
  }
]

function AssetCard({ asset }: { asset: Asset }) {
  const [imageError, setImageError] = React.useState(false)

  const getDefaultThumbnail = (type: Asset["type"]): string | undefined => {
    switch (type) {
      case "image":
        return "https://via.placeholder.com/300x200/f3f4f6/6b7280?text=Image"
      case "video":
        return "https://via.placeholder.com/300x200/f3f4f6/6b7280?text=Video"
      case "document":
        return undefined
    }
  }

  const getIcon = (type: Asset["type"]) => {
    switch (type) {
      case "image":
        return (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-gray-50 to-gray-100 text-gray-400">
            <Image className="h-12 w-12 animate-pulse" />
            <span className="text-sm font-medium">Image not available</span>
          </div>
        )
      case "video":
        return (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-gray-50 to-gray-100 text-gray-400">
            <FileVideo className="h-12 w-12 animate-pulse" />
            <span className="text-sm font-medium">Video preview</span>
          </div>
        )
      case "document":
        return (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-gray-50 to-gray-100 text-gray-400">
            <FileText className="h-12 w-12 animate-pulse" />
            <span className="text-sm font-medium">Document preview</span>
          </div>
        )
    }
  }

  const shouldShowImage = asset.type !== "document" && (asset.thumbnailUrl || getDefaultThumbnail(asset.type)) && !imageError

  const getTypeColor = (type: Asset["type"]) => {
    switch (type) {
      case "image":
        return "bg-blue-50 text-blue-700 border-blue-200"
      case "video":
        return "bg-purple-50 text-purple-700 border-purple-200"
      case "document":
        return "bg-amber-50 text-amber-700 border-amber-200"
    }
  }

  return (
    <Card className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
      <div className="aspect-[4/3] relative overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
        {shouldShowImage ? (
          <img
            src={asset.thumbnailUrl || getDefaultThumbnail(asset.type)}
            alt={asset.name}
            className="object-cover w-full h-full transition-all duration-300 group-hover:scale-105"
            onError={() => setImageError(true)}
          />
        ) : (
          getIcon(asset.type)
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end justify-center gap-2 p-4">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8 bg-white/90 hover:bg-white transition-colors duration-200"
              onClick={(e) => {
                e.stopPropagation()
                window.open(asset.url, '_blank')
              }}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8 bg-white/90 hover:bg-white transition-colors duration-200"
              onClick={(e) => {
                e.stopPropagation()
                // Aquí iría la lógica para descargar el asset
              }}
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8 bg-white/90 hover:bg-red-500 hover:text-white transition-colors duration-200"
              onClick={(e) => {
                e.stopPropagation()
                // Aquí iría la lógica para eliminar el asset
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="absolute top-2 right-2">
          <Badge variant="secondary" className={`${getTypeColor(asset.type)} text-xs font-medium capitalize`}>
            {asset.type}
          </Badge>
        </div>
      </div>
      <div className="p-4">
        <div className="flex flex-col gap-3">
          <div>
            <div className="font-medium truncate text-sm">{asset.name}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
              <span>{asset.size}</span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
              <span>{new Date(asset.uploadedAt).toLocaleDateString()}</span>
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
  )
}

export default function AssetsPage() {
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
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search assets..." className="pl-8 w-full" />
                <kbd className="pointer-events-none absolute right-2 top-2.5 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </div>
            </div>
          </div>
        </StickyHeader>
        
        <div className="p-8 space-y-4">
          <div className="px-8">
            <TabsContent value="all" className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {assets.map((asset) => (
                  <AssetCard key={asset.id} asset={asset} />
                ))}
              </div>
            </TabsContent>
            <TabsContent value="images" className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {assets
                  .filter(a => a.type === "image")
                  .map((asset) => (
                    <AssetCard key={asset.id} asset={asset} />
                  ))}
              </div>
            </TabsContent>
            <TabsContent value="videos" className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {assets
                  .filter(a => a.type === "video")
                  .map((asset) => (
                    <AssetCard key={asset.id} asset={asset} />
                  ))}
              </div>
            </TabsContent>
            <TabsContent value="documents" className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {assets
                  .filter(a => a.type === "document")
                  .map((asset) => (
                    <AssetCard key={asset.id} asset={asset} />
                  ))}
              </div>
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  )
} 