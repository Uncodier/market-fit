"use client"

import { useState, useCallback } from "react"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Textarea } from "@/app/components/ui/textarea"
import { 
  UploadCloud, 
  FileText, 
  X,
  Image as ImageIcon,
  FileVideo,
  Tag
} from "@/app/components/ui/icons"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/app/components/ui/dialog"
import { Badge } from "@/app/components/ui/badge"
import { useDropzone } from "react-dropzone"
import { cn } from "@/lib/utils"
import { useSite } from "@/app/context/SiteContext"
import { createAsset, uploadAssetFile } from "@/app/assets/actions"
import { useToast } from "@/app/components/ui/use-toast"
import { useRouter } from "next/navigation"

interface UploadAssetDialogProps {
  onUploadAsset: (data: { 
    name: string
    description?: string
    file_path: string
    file_type: string
    file_size: number
    tags: string[]
    site_id: string
  }) => Promise<void>
}

export function UploadAssetDialog({ onUploadAsset }: UploadAssetDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { currentSite } = useSite()
  const router = useRouter()
  const { toast } = useToast()

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0]
    if (selectedFile) {
      setFile(selectedFile)
      
      // Si el nombre está vacío, usar el nombre del archivo
      if (!name) {
        setName(selectedFile.name.split('.')[0])
      }
      
      // Generar una vista previa para imágenes
      if (selectedFile.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = () => {
          setFilePreview(reader.result as string)
        }
        reader.readAsDataURL(selectedFile)
      } else {
        setFilePreview(null)
      }
    }
  }, [name])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    disabled: isSubmitting
  })

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()])
      setTagInput("")
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }

  const getFileTypeIcon = () => {
    if (!file) return <UploadCloud className="h-10 w-10 text-gray-400" />
    
    const fileType = file.type
    if (fileType.startsWith('image/')) {
      return <ImageIcon className="h-10 w-10 text-blue-500" />
    } else if (fileType.startsWith('video/')) {
      return <FileVideo className="h-10 w-10 text-purple-500" />
    } else {
      return <FileText className="h-10 w-10 text-amber-500" />
    }
  }

  const getFileType = (): string => {
    if (!file) return ""
    
    const fileType = file.type
    if (fileType.startsWith('image/')) {
      return "image"
    } else if (fileType.startsWith('video/')) {
      return "video"
    } else {
      return "document"
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const resetForm = () => {
    setName("")
    setDescription("")
    setTags([])
    setTagInput("")
    setFile(null)
    setFilePreview(null)
    setError(null)
  }

  const handleSubmit = async () => {
    // Validar que exista un sitio seleccionado
    if (!currentSite?.id) {
      setError("Por favor, selecciona un sitio primero")
      return
    }

    // Validar campos requeridos
    if (!name || !file) {
      setError("Por favor, completa el nombre y sube un archivo")
      return
    }
    
    setIsSubmitting(true)
    setError(null)

    try {
      // Primero subimos el archivo a Supabase Storage
      const { path, error: uploadError } = await uploadAssetFile(file)
      
      if (uploadError) {
        // Verificar si el error es sobre el bucket no encontrado
        if (uploadError.includes("bucket") && uploadError.includes("no existe")) {
          throw new Error("Error de configuración: El bucket de almacenamiento no existe. Por favor, contacta al administrador.")
        }
        throw new Error(uploadError || "Error al subir el archivo")
      }
      
      if (!path) {
        throw new Error("No se pudo obtener la URL del archivo subido")
      }
      
      // Luego creamos el registro en la base de datos
      await onUploadAsset({ 
        name,
        description: description || undefined,
        file_path: path,
        file_type: getFileType(),
        file_size: file.size,
        tags,
        site_id: currentSite.id
      })
      
      // Limpiar el formulario y cerrar el modal
      resetForm()
      setIsOpen(false)

      // Refrescar la lista de assets
      router.refresh()
    } catch (err) {
      console.error("Error uploading asset:", err)
      setError(err instanceof Error ? err.message : "Error al subir el asset")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open)
      if (!open) resetForm()
    }}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <UploadCloud className="h-4 w-4" />
          Upload Asset
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Upload New Asset</DialogTitle>
          <DialogDescription>
            Upload a file to your asset library. You can add tags to organize your assets.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}
          
          <div
            {...getRootProps()}
            className={cn(
              "relative flex flex-col items-center justify-center gap-4 p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
              isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:bg-gray-50",
              isSubmitting && "opacity-50 cursor-not-allowed hover:bg-transparent"
            )}
          >
            <input {...getInputProps()} />
            
            {filePreview ? (
              <div className="relative aspect-video w-full">
                <img
                  src={filePreview}
                  alt="Preview"
                  className="object-contain w-full h-full rounded-lg"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setFile(null)
                    setFilePreview(null)
                  }}
                  className="absolute -top-2 -right-2 p-1 rounded-full bg-red-500 text-white hover:bg-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : file ? (
              <div className="flex flex-col items-center gap-2">
                {getFileTypeIcon()}
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600 truncate max-w-xs">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setFile(null)
                  }}
                  className="mt-2 text-xs text-red-500 hover:text-red-700"
                >
                  Remove file
                </button>
              </div>
            ) : (
              <>
                <UploadCloud className="h-10 w-10 text-gray-400" />
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600">
                    {isSubmitting ? "Uploading..." : "Drag and drop a file or click to select"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Images, videos, documents (max. 10MB)
                  </p>
                </div>
              </>
            )}
          </div>
          
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Name
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-4 h-4 w-4 text-muted-foreground" />
              <Input
                id="name"
                placeholder="Enter asset name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-12 pl-9"
                disabled={isSubmitting}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Description (optional)
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Textarea
                id="description"
                placeholder="Add a description for this asset"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[80px] pl-9 pt-2"
                disabled={isSubmitting}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label htmlFor="tags" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Tags (optional)
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <Badge 
                  key={tag} 
                  variant="secondary"
                  className="bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200 flex items-center gap-1"
                >
                  {tag}
                  <button 
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1 hover:text-red-500"
                    disabled={isSubmitting}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="absolute left-3 top-4 h-4 w-4 text-muted-foreground" />
                <Input
                  id="tags"
                  placeholder="Add tags..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-12 pl-9"
                  disabled={isSubmitting}
                />
              </div>
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleAddTag}
                disabled={!tagInput.trim() || isSubmitting}
                className="h-12"
              >
                Add
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter className="flex justify-between border-t pt-4">
          <Button 
            variant="outline" 
            onClick={() => {
              resetForm()
              setIsOpen(false)
            }}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !file || !name}
            className={isSubmitting ? "opacity-70 cursor-not-allowed" : ""}
          >
            {isSubmitting ? "Uploading..." : "Upload Asset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 