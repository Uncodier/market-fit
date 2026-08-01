"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Button } from "@/app/components/ui/button"
import { Label } from "@/app/components/ui/label"
import { FileUp, Trash2, File as FileIcon, Loader2 } from "@/app/components/ui/icons"
import { listCatalogItemFiles, uploadCatalogItemFile, deleteCatalogItemFile } from "../digital-file-actions"
import { toast } from "sonner"
import { useLocalization } from "@/app/context/LocalizationContext"

export function ProductDownloadableFilesCard({ item }: { item: any }) {
  const { t } = useLocalization()
  const [files, setFiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  // Only show for file and license digital assets
  const isDownloadable = item?.kind === 'digital_asset' && (item?.digital_subtype === 'file' || item?.digital_subtype === 'license')

  useEffect(() => {
    if (!item?.id || !isDownloadable) return
    loadFiles()
  }, [item?.id, isDownloadable])

  async function loadFiles() {
    setLoading(true)
    const { data, error } = await listCatalogItemFiles(item.id)
    if (error) {
      toast.error(error)
    } else {
      setFiles(data || [])
    }
    setLoading(false)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    
    const file = e.target.files[0]
    setUploading(true)
    
    const formData = new FormData()
    formData.append('file', file)
    
    const { data, error } = await uploadCatalogItemFile(item.id, formData)
    
    if (error) {
      toast.error(error)
    } else if (data) {
      toast.success(t('catalog.digitalAssets.uploadSuccess') || 'File uploaded successfully')
      setFiles(prev => [...prev, data])
    }
    
    setUploading(false)
    e.target.value = ''
  }

  const handleDelete = async (fileId: string) => {
    if (!confirm(t('catalog.digitalAssets.confirmDelete') || 'Are you sure you want to delete this file?')) return
    
    const { error } = await deleteCatalogItemFile(fileId)
    if (error) {
      toast.error(error)
    } else {
      toast.success(t('catalog.digitalAssets.deleteSuccess') || 'File deleted successfully')
      setFiles(prev => prev.filter(f => f.id !== fileId))
    }
  }

  if (!isDownloadable) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('catalog.digitalAssets.title') || 'Downloadable Files'}</CardTitle>
        <CardDescription>
          {t('catalog.digitalAssets.description') || 'Attach secure files that buyers can download after purchase.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {loading ? (
          <div className="flex justify-center p-6"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            {files.length > 0 && (
              <div className="border rounded-lg overflow-hidden divide-y">
                {files.map(f => (
                  <div key={f.id} className="p-3 bg-card flex items-center justify-between group">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-8 h-8 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <FileIcon size={16} />
                      </div>
                      <div className="truncate">
                        <p className="font-medium text-sm truncate">{f.file_name}</p>
                        <p className="text-xs text-muted-foreground">{(f.size_bytes / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(f.id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="relative">
              <input 
                type="file" 
                id="digital-asset-upload"
                className="sr-only"
                onChange={handleFileChange}
                disabled={uploading}
              />
              <label 
                htmlFor="digital-asset-upload"
                className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer transition-colors ${uploading ? 'bg-muted/50 border-muted' : 'bg-card hover:bg-muted/50 border-border hover:border-primary/50'}`}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                    <span className="text-sm font-medium">{t('catalog.digitalAssets.uploading') || 'Uploading file...'}</span>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
                      <FileUp size={24} />
                    </div>
                    <span className="text-base font-semibold">{t('catalog.digitalAssets.uploadAction') || 'Click to upload a file'}</span>
                    <span className="text-sm text-muted-foreground mt-1">Maximum size: 500MB</span>
                  </>
                )}
              </label>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
