"use client"

import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import { ImageIcon, X } from "@/app/components/ui/icons"
import Image from "next/image"
import { cn } from "@/lib/utils"

interface ImageUploadProps {
  value: string
  onChange: (value: string) => void
  onRemove: () => void
  disabled?: boolean
}

export function ImageUpload({
  value,
  onChange,
  onRemove,
  disabled
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    try {
      setIsUploading(true)
      const file = acceptedFiles[0]
      
      // Aquí iría la lógica para subir a Supabase Storage
      // Por ahora solo convertimos a base64 para la demo
      const reader = new FileReader()
      reader.onloadend = () => {
        onChange(reader.result as string)
        setIsUploading(false)
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error(error)
      setIsUploading(false)
    }
  }, [onChange])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif"]
    },
    disabled: disabled || isUploading,
    maxFiles: 1
  })

  return (
    <div>
      <div
        {...getRootProps()}
        className={cn(
          "relative flex flex-col items-center justify-center gap-4 p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
          isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:bg-gray-50",
          disabled && "opacity-50 cursor-not-allowed hover:bg-transparent"
        )}
      >
        <input {...getInputProps()} />
        
        {value ? (
          <div className="relative aspect-video w-full">
            <Image
              src={value}
              alt="Logo"
              fill
              className="object-cover rounded-lg"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onRemove()
              }}
              className="absolute -top-2 -right-2 p-1 rounded-full bg-red-500 text-white hover:bg-red-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <ImageIcon className="h-10 w-10 text-gray-400" />
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">
                {isUploading ? "Subiendo..." : "Arrastra una imagen o haz clic para seleccionar"}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                PNG, JPG o GIF (max. 4MB)
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
} 