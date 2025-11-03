import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/app/components/ui/use-toast'
import { MessageAttachment, InstanceAsset } from '../types'
import { createAsset } from '@/app/assets/actions'

interface UseAttachmentUploadProps {
  siteId: string
  instanceId?: string
}

export const useAttachmentUpload = ({ siteId, instanceId }: UseAttachmentUploadProps) => {
  const [isUploading, setIsUploading] = useState(false)
  const { toast } = useToast()

  const uploadFile = async (file: File): Promise<MessageAttachment | null> => {
    // Validate file type
    const allowedTypes = [
      'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp',
      'text/csv', 'text/plain', 'application/csv',
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/json', 'application/xml', 'text/xml'
    ]
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image, document, or text file (PNG, JPG, GIF, WebP, CSV, TXT, PDF, DOC, DOCX, XLS, XLSX, JSON, XML)',
        variant: 'destructive'
      })
      return null
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024 // 5MB in bytes
    if (file.size > maxSize) {
      toast({
        title: 'File too large',
        description: 'Please select a file smaller than 5MB',
        variant: 'destructive'
      })
      return null
    }

    setIsUploading(true)

    try {
      const supabase = createClient()
      
      // Generate unique filename with timestamp
      const fileExt = file.name.split('.').pop()
      const timestamp = Date.now()
      
      // Sanitize filename: replace spaces and problematic characters with underscores
      const baseFileName = file.name.replace(/\.[^/.]+$/, '')
      const sanitizedBaseName = baseFileName
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special characters with underscores
        .replace(/_{2,}/g, '_') // Replace multiple underscores with single underscore
        .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
      
      const fileName = `${sanitizedBaseName || 'file'}_${timestamp}.${fileExt}`
      
      // Determine file type folder based on MIME type
      const getFileTypeFolder = (mimeType: string) => {
        if (mimeType.startsWith('image/')) return 'image'
        if (mimeType.startsWith('text/') || mimeType === 'application/csv') return 'text'
        if (mimeType === 'application/pdf') return 'pdf'
        if (mimeType.includes('word') || mimeType.includes('document')) return 'document'
        if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'spreadsheet'
        if (mimeType.includes('json') || mimeType.includes('xml')) return 'data'
        return 'document'
      }
      
      const fileTypeFolder = getFileTypeFolder(file.type)
      const filePath = `${siteId}/${fileTypeFolder}/${fileName}`
      
      // Upload to Supabase storage (using same bucket as assets page)
      const { data, error } = await supabase
        .storage
        .from('assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) {
        console.error('Storage upload error:', error)
        toast({
          title: 'Upload failed',
          description: 'Failed to upload file. Please try again.',
          variant: 'destructive'
        })
        return null
      }

      // Get public URL
      const { data: { publicUrl } } = supabase
        .storage
        .from('assets')
        .getPublicUrl(data.path)

      const attachment: MessageAttachment = {
        id: `${timestamp}_${Math.random().toString(36).substring(2, 15)}`,
        name: file.name,
        url: publicUrl,
        type: file.type,
        size: file.size,
        uploaded_at: new Date().toISOString()
      }

      // Create asset record if instanceId is provided
      if (instanceId) {
        console.log('🔄 Creating asset for instance:', instanceId)
        try {
          const { asset, error: assetError } = await createAsset({
            name: file.name,
            file_path: publicUrl,
            file_type: file.type,
            file_size: file.size,
            site_id: siteId,
            instance_id: instanceId,
            tags: ['attachment']
          })

          if (assetError || !asset) {
            console.error('Error creating asset:', assetError)
            toast({
              title: 'Warning',
              description: 'File uploaded but asset record creation failed',
              variant: 'destructive'
            })
          } else {
            console.log('🔄 Asset created successfully:', asset.id)
          }
        } catch (error) {
          console.error('Error creating asset:', error)
          toast({
            title: 'Warning',
            description: 'File uploaded but asset record creation failed',
            variant: 'destructive'
          })
        }
      } else {
        console.log('🔄 No instanceId provided, skipping asset creation')
      }

      return attachment

    } catch (error) {
      console.error('Error uploading file:', error)
      toast({
        title: 'Upload failed',
        description: 'An error occurred while uploading the file.',
        variant: 'destructive'
      })
      return null
    } finally {
      setIsUploading(false)
    }
  }

  const uploadMultipleFiles = async (files: File[]): Promise<MessageAttachment[]> => {
    const uploadPromises = files.map(file => uploadFile(file))
    const results = await Promise.all(uploadPromises)
    return results.filter((attachment): attachment is MessageAttachment => attachment !== null)
  }

  return {
    uploadFile,
    uploadMultipleFiles,
    isUploading
  }
}
