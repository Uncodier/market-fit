"use client"
import { Image as ImageIcon, File, Code, FileText } from "@/app/components/ui/icons"
export interface FileUpload {
  name: string
  url: string
  size: number
  type: string
}

// Helper function to get file icon based on type
export const getFileIcon = (type: string) => {
  if (type.startsWith('image/')) return ImageIcon
  if (type === 'application/pdf') return File
  if (type.includes('code') || type.includes('json') || type.includes('text')) return Code
  return FileText
}

// Helper function to format file size
export const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// Helper function to check if file is previewable
export const isPreviewable = (type: string) => {
  return type.startsWith('image/') || type === 'application/pdf'
}

export const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    })
  }

export const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
  }

  // Function to render file preview
export const renderFilePreview = (file: FileUpload) => {
    if (file.type.startsWith('image/')) {
      return (
        <div className="relative w-full rounded-md overflow-hidden bg-muted">
          <img
            src={file.url}
            alt={file.name}
            className="w-full h-auto max-h-[400px] object-contain mx-auto"
            loading="lazy"
          />
        </div>
      )
    }
    if (file.type === 'application/pdf') {
      return (
        <iframe
          src={file.url}
          className="w-full aspect-[4/3] rounded-md border"
          title={file.name}
        />
      )
    }
    return null
  }

