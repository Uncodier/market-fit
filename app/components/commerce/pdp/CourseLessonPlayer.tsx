"use client"

import { useState } from "react"
import { PlayCircle, CheckCircle } from "@/app/components/ui/icons"

export function CourseLessonPlayer({ 
  videos, 
  title, 
  progress,
  onProgressUpdate
}: { 
  videos: { url: string; title?: string }[],
  title: string,
  progress?: { lastIndex: number, completedIndexes: number[] },
  onProgressUpdate?: (index: number, completed: boolean) => void
}) {
  const initialIndex = progress?.lastIndex || 0
  const [currentIndex, setCurrentIndex] = useState(initialIndex >= 0 && initialIndex < videos.length ? initialIndex : 0)
  const completed = progress?.completedIndexes || []

  if (!videos || videos.length === 0) return null

  const currentVideo = videos[currentIndex]
  
  // Extract youtube or vimeo ID if possible
  const getEmbedUrl = (url: string) => {
    try {
      if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
        const videoId = url.includes('youtu.be/') ? url.split('youtu.be/')[1].split('?')[0] : new URL(url).searchParams.get('v')
        if (videoId) return `https://www.youtube.com/embed/${videoId}`
      }
      if (url.includes('vimeo.com/')) {
        const parts = url.split('/')
        const videoId = parts[parts.length - 1]
        if (videoId && !isNaN(Number(videoId))) return `https://player.vimeo.com/video/${videoId}`
      }
    } catch (e) {
      // invalid URL
    }
    return null
  }

  const embedUrl = getEmbedUrl(currentVideo.url)

  return (
    <div className="flex flex-col lg:flex-row gap-6 bg-card border border-border/50 rounded-3xl overflow-hidden shadow-lg">
      <div className="flex-1 lg:border-r border-border/50">
        <div className="aspect-video bg-black relative">
          {embedUrl ? (
            <iframe 
              src={embedUrl}
              className="absolute inset-0 w-full h-full"
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          ) : (
            <video 
              src={currentVideo.url} 
              controls 
              className="absolute inset-0 w-full h-full object-contain"
            />
          )}
        </div>
        <div className="p-6 sm:p-8">
          <h2 className="text-2xl font-bold mb-2">{currentVideo.title || `${title} - Lesson ${currentIndex + 1}`}</h2>
          <div className="flex items-center gap-4 mt-6">
            <button 
              onClick={() => onProgressUpdate && onProgressUpdate(currentIndex, !completed.includes(currentIndex))}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${completed.includes(currentIndex) ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            >
              <CheckCircle size={18} className={completed.includes(currentIndex) ? 'text-primary' : ''} />
              {completed.includes(currentIndex) ? 'Completed' : 'Mark as complete'}
            </button>
          </div>
        </div>
      </div>
      
      <div className="w-full lg:w-80 shrink-0 flex flex-col max-h-[600px]">
        <div className="p-6 border-b border-border/50">
          <h3 className="font-bold text-lg">Course Content</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {completed.length} of {videos.length} completed
          </p>
          <div className="w-full h-1.5 bg-muted rounded-full mt-3 overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${(completed.length / videos.length) * 100}%` }}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {videos.map((vid, idx) => {
            const isActive = currentIndex === idx
            const isCompleted = completed.includes(idx)
            
            return (
              <button
                key={idx}
                onClick={() => {
                  setCurrentIndex(idx)
                  if (onProgressUpdate && idx !== progress?.lastIndex) {
                    onProgressUpdate(idx, isCompleted) // Keep same completion, but update lastIndex
                  }
                }}
                className={`w-full text-left flex items-start gap-3 p-4 rounded-xl transition-colors mb-1 ${isActive ? 'bg-primary/5 border border-primary/20' : 'hover:bg-muted/50 border border-transparent'}`}
              >
                <div className={`mt-0.5 shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${isCompleted ? 'text-primary' : isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {isCompleted ? <CheckCircle size={20} className="text-primary" /> : <PlayCircle size={14} />}
                </div>
                <div className="flex-1">
                  <div className={`font-medium text-sm line-clamp-2 ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {idx + 1}. {vid.title || `Lesson ${idx + 1}`}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
