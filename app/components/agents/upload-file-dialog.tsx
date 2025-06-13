"use client"

import { useState, useCallback, useEffect } from "react"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { 
  UploadCloud, 
  FileText, 
  X
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
import { useDropzone } from "react-dropzone"
import { cn } from "@/lib/utils"
import { useSite } from "@/app/context/SiteContext"
import { createAsset, uploadAssetFile } from "@/app/assets/actions"
import { useToast } from "@/app/components/ui/use-toast"
import { createClient } from "@/lib/supabase/client"
import { Skeleton } from "@/app/components/ui/skeleton"

interface FileData {
  id?: string;
  name: string;
  path: string;
}

interface UploadFileDialogProps {
  agentId: string;
  onFileUploaded: (fileData: {
    id: string;
    name: string;
    path: string;
  }) => void;
  buttonLabel?: string;
  mode?: 'create' | 'update';
  initialData?: FileData;
  trigger?: React.ReactNode;
}

// Acceptable file types for agent assets
const ACCEPTED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'text/csv': ['.csv'],
  'application/vnd.ms-excel': ['.csv'],
  'text/markdown': ['.md'],
  'text/plain': ['.md', '.txt'],
  'application/json': ['.json'],
  'text/yaml': ['.yaml', '.yml'],
  'application/x-yaml': ['.yaml', '.yml'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
}

// Helper function to check if a file is acceptable
const isAcceptableFile = (file: File): boolean => {
  // Check by mimetype first
  for (const mimeType in ACCEPTED_FILE_TYPES) {
    if (file.type === mimeType) {
      return true;
    }
  }
  
  // Then check by extension as fallback
  const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
  for (const mimeType in ACCEPTED_FILE_TYPES) {
    if (ACCEPTED_FILE_TYPES[mimeType as keyof typeof ACCEPTED_FILE_TYPES].includes(extension)) {
      return true;
    }
  }
  
  return false;
}

// Enhanced loading skeleton for the upload dialog
function UploadSkeleton() {
  return (
    <div className="space-y-6 py-4">
      {/* Upload progress indicator */}
      <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-md text-sm flex items-center justify-center">
        <div className="mr-3 animate-spin">
          <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <span>Uploading your file... Please wait.</span>
      </div>

      <div className="flex flex-col items-center justify-center gap-4 p-6 border-2 border-dashed rounded-lg border-gray-200 bg-gray-50">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2 w-full max-w-[250px]">
          <Skeleton className="h-4 w-3/4 mx-auto" />
          <Skeleton className="h-3 w-1/2 mx-auto" />
        </div>
      </div>
      
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-12 w-full" />
      </div>
      
      <div className="flex justify-between pt-4">
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  )
}

// File preview skeleton
function FilePreviewSkeleton() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="animate-pulse flex flex-col items-center">
        <div className="animate-spin mb-2">
          <svg className="h-6 w-6 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <Skeleton className="h-10 w-10 rounded mb-2" />
        <div className="text-center">
          <Skeleton className="h-4 w-36 mx-auto" />
          <Skeleton className="h-3 w-20 mx-auto mt-1" />
          <p className="text-xs text-primary mt-2">Processing file...</p>
        </div>
      </div>
    </div>
  )
}

export function UploadFileDialog({ 
  agentId, 
  onFileUploaded, 
  buttonLabel = "Add File", 
  mode = 'create',
  initialData,
  trigger 
}: UploadFileDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { currentSite } = useSite()
  const { toast } = useToast()
  const supabase = createClient()
  
  // Initialize form with existing data when in update mode
  useEffect(() => {
    if (mode === 'update' && initialData) {
      setName(initialData.name || "")
    }
  }, [initialData, mode])

  const onDrop = useCallback(async (acceptedFiles: File[], rejectedFiles: any[]) => {
    // Handle rejected files
    if (rejectedFiles.length > 0) {
      const message = "This file type is not supported. Please upload a CSV, PDF, Markdown (.md), TXT, JSON, YAML, or image file (JPG, PNG, WebP).";
      setError(message);
      return;
    }
    
    const selectedFile = acceptedFiles[0];
    if (selectedFile) {
      // Show loading state while processing file
      setIsLoading(true);
      setError(null);
      
      try {
        // Additional type validation to exclude GIFs or other unwanted types
        if (!isAcceptableFile(selectedFile)) {
          setError("This file type is not supported. Please upload a CSV, PDF, Markdown (.md), TXT, JSON, YAML, or image file (JPG, PNG, WebP).");
          setIsLoading(false);
          return;
        }
        
        // Simulate processing time to show the skeleton (at least 1 second)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setFile(selectedFile);
        
        // If name is empty, use file name
        if (!name) {
          setName(selectedFile.name.split('.')[0]);
        }
        
        // Generate preview for images
        if (selectedFile.type.startsWith('image/') && selectedFile.type !== 'image/gif') {
          const reader = new FileReader();
          
          // Set a timeout to ensure the loader shows for at least 1.5 seconds total
          const previewTimer = setTimeout(() => {
            reader.onload = () => {
              setFilePreview(reader.result as string);
              setIsLoading(false);
            };
            reader.onerror = () => {
              setError("Error processing image preview");
              setIsLoading(false);
            };
            reader.readAsDataURL(selectedFile);
          }, 500);
          
          // Clean up if component unmounts
          return () => clearTimeout(previewTimer);
        } else {
          // For non-image files, show the loading state for a bit longer
          setTimeout(() => {
            setFilePreview(null);
            setIsLoading(false);
          }, 500);
        }
      } catch (error) {
        console.error("Error processing file:", error);
        setError("Error processing file. Please try again.");
        setIsLoading(false);
      }
    }
  }, [name]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    maxFiles: 1,
    disabled: isSubmitting || isLoading,
    maxSize: 10 * 1024 * 1024 // 10MB max file size
  });

  const getFileTypeIcon = () => {
    if (!file) return <UploadCloud className="h-10 w-10 text-gray-400" />
    return <FileText className="h-10 w-10 text-amber-500" />
  }

  const getFileType = (): string => {
    if (!file) return ""
    
    const fileType = file.type
    const fileName = file.name.toLowerCase()
    
    if (fileType.startsWith('image/')) {
      return "image"
    } else if (fileType === 'application/pdf') {
      return "document"
    } else if (fileType === 'text/csv' || fileType === 'application/vnd.ms-excel') {
      return "spreadsheet"
    } else if (fileType === 'application/json' || fileName.endsWith('.json')) {
      return "data"
    } else if (fileType === 'text/yaml' || fileType === 'application/x-yaml' || fileName.endsWith('.yaml') || fileName.endsWith('.yml')) {
      return "data"
    } else if (fileType === 'text/plain' && fileName.endsWith('.txt')) {
      return "text"
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
    setName(mode === 'update' && initialData ? initialData.name : "")
    setFile(null)
    setFilePreview(null)
    setError(null)
    setIsLoading(false)
    setIsSubmitting(false)
  }

  const handleSubmit = async () => {
    // Validate site is selected
    if (!currentSite?.id) {
      setError("Please select a site first")
      return
    }

    // Validate required fields
    if (!name || !file) {
      setError("Please complete the name and upload a file")
      return
    }
    
    // Check if agent ID is valid
    if (!agentId || agentId === "new") {
      setError("Please save the agent first before adding files")
      return
    }
    
    // Set submitting state to show skeleton
    setIsSubmitting(true)
    setError(null)

    try {
      // Add small delay to ensure skeleton is shown
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // First upload file to Supabase Storage
      const { path, error: uploadError } = await uploadAssetFile(file)
      
      if (uploadError) {
        throw new Error(uploadError || "Error uploading file")
      }
      
      if (!path) {
        throw new Error("Could not get URL of uploaded file")
      }
      
      // Then create or update asset in the database
      if (mode === 'update' && initialData?.id) {
        // Update existing asset
        const { error: updateError } = await supabase
          .from('assets')
          .update({ 
            name,
            file_path: path,
            file_type: getFileType(),
            file_size: file.size,
            updated_at: new Date().toISOString()
          })
          .eq('id', initialData.id)
        
        if (updateError) {
          throw new Error(`Error updating asset: ${updateError.message}`)
        }
        
        // Inform parent component
        onFileUploaded({
          id: initialData.id,
          name: name,
          path: path
        })
        
        toast({
          title: "File updated",
          description: "The file has been replaced successfully",
        })
      } else {
        // Create new asset
        const { asset, error: assetError } = await createAsset({ 
          name,
          file_path: path,
          file_type: getFileType(),
          file_size: file.size,
          tags: ["agent-context"],
          site_id: currentSite.id
        })
        
        if (assetError || !asset) {
          throw new Error(assetError || "Error creating asset record")
        }
        
        // Create relation in agent_assets table
        const { error: relationError } = await supabase
          .from('agent_assets')
          .insert({
            agent_id: agentId,
            asset_id: asset.id
          })
        
        if (relationError) {
          throw new Error(`Error linking file to agent: ${relationError.message}`)
        }
        
        // Inform parent component
        onFileUploaded({
          id: asset.id,
          name: asset.name,
          path: asset.file_path
        })
        
        toast({
          title: "File uploaded",
          description: "The file has been uploaded and linked to this agent",
        })
      }
      
      // Add delay before closing to show success state
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Reset form and close modal
      resetForm()
      setIsOpen(false)
    } catch (err) {
      console.error("Error handling file:", err)
      setError(err instanceof Error ? err.message : "Error uploading file")
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        if (open !== isOpen) {
          setIsOpen(open);
          if (!open) {
            // When closing dialog, reset all states
            resetForm();
            setIsLoading(false);
            setIsSubmitting(false);
          }
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button size="sm">
            <UploadCloud className="h-4 w-4 mr-2" />
            {buttonLabel}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>{mode === 'update' ? 'Replace File' : 'Upload Context File'}</DialogTitle>
          <DialogDescription>
            {mode === 'update' 
              ? 'Upload a new file to replace the existing one'
              : 'Upload a file to provide additional context for your agent'}
          </DialogDescription>
        </DialogHeader>
        
        {isSubmitting ? (
          <UploadSkeleton />
        ) : (
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
                (isSubmitting || isLoading) && "opacity-70 cursor-not-allowed hover:bg-transparent bg-gray-50"
              )}
            >
              <input {...getInputProps()} />
              
              {isLoading ? (
                <FilePreviewSkeleton />
              ) : filePreview ? (
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
                  <div className="flex flex-col items-center justify-center">
                    <UploadCloud className="h-10 w-10 text-gray-400 flex-shrink-0 mb-2" />
                    <div className="text-center flex flex-col items-center">
                      <p className="text-sm font-medium text-gray-600">
                        {isSubmitting ? "Uploading..." : (mode === 'update' ? "Drag and drop a new file or click to select" : "Drag and drop a file or click to select")}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        CSV, PDF, Markdown (.md), TXT, JSON, YAML, and images (JPG, PNG, WebP) up to 10MB
                      </p>
                    </div>
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
                  placeholder="Enter file name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12 pl-9"
                  disabled={isSubmitting || isLoading}
                />
              </div>
            </div>
          </div>
        )}
        
        <DialogFooter className="flex justify-between border-t pt-4">
          <Button 
            variant="outline" 
            onClick={() => {
              resetForm()
              setIsOpen(false)
            }}
            disabled={isSubmitting || isLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || isLoading || !file || !name}
            className={cn(
              isSubmitting && "opacity-70 cursor-not-allowed bg-primary/80",
              "min-w-[100px]"
            )}
          >
            {isSubmitting ? (
              <div className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Uploading...
              </div>
            ) : (
              mode === 'update' ? "Replace File" : "Upload File"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 