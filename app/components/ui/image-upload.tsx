"use client"

import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import { ImageIcon, X } from "@/app/components/ui/icons"
import Image from "next/image"
import { cn } from "@/lib/utils"

const compressImage = (file: File, maxWidth = 1024, maxHeight = 1024, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new window.Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = width * ratio;
          height = height * ratio;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("No se pudo crear el contexto de canvas"));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Exportamos siempre a jpeg para mejor compresión, o webp
        // WebP tiene mejor compresión que JPEG
        const dataUrl = canvas.toDataURL('image/webp', quality);
        resolve(dataUrl);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

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
      
      const compressedDataUrl = await compressImage(file, 1024, 1024, 0.75);
      onChange(compressedDataUrl);
      setIsUploading(false)
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