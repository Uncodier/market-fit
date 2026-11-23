import type React from 'react'
import { useToast } from '@/app/components/ui/use-toast'

export function useToolMediaDownloads(toolResult: any) {
  const { toast } = useToast()
  // Function to download image
  const handleDownloadImage = async (e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (!toolResult?.output?.images || toolResult.output.images.length === 0) {
      return
    }

    const images = toolResult.output.images
    const downloadImage = async (imageObj: any, index: number) => {
      try {
        const imageUrl = typeof imageObj === 'string' ? imageObj : imageObj?.url || ''
        const response = await fetch(imageUrl)
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `image-${index + 1}.${blob.type.split('/')[1] || 'png'}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      } catch (err) {
        console.error('Failed to download image:', err)
        toast({
          title: "Download failed",
          description: `Could not download image ${index + 1}`,
          variant: "destructive"
        })
      }
    }

    // Download all images
    for (let i = 0; i < images.length; i++) {
      await downloadImage(images[i], i)
      // Small delay between downloads
      if (i < images.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    }

    toast({
      title: "Download started",
      description: `Downloading ${images.length} image(s)...`,
    })
  }

  // Function to download video
  const handleDownloadVideo = async (e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (!toolResult?.output?.videos || toolResult.output.videos.length === 0) {
      return
    }

    const videos = toolResult.output.videos
    const downloadVideo = async (videoObj: any, index: number) => {
      try {
        const videoUrl = typeof videoObj === 'string' ? videoObj : videoObj?.url || ''
        const response = await fetch(videoUrl)
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `video-${index + 1}.${blob.type.split('/')[1] || 'mp4'}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      } catch (err) {
        console.error('Failed to download video:', err)
        toast({
          title: "Download failed",
          description: `Could not download video ${index + 1}`,
          variant: "destructive"
        })
      }
    }

    // Download all videos
    for (let i = 0; i < videos.length; i++) {
      await downloadVideo(videos[i], i)
      // Small delay between downloads
      if (i < videos.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    }

    toast({
      title: "Download started",
      description: `Downloading ${videos.length} video(s)...`,
    })
  }

  return { handleDownloadImage, handleDownloadVideo }
}
