import React, { useState } from 'react'

interface GeneratedVideoDisplayProps {
  toolResult: any
  isDarkMode: boolean
  onVideoClick?: (e: React.MouseEvent) => void
  isBrowserVisible?: boolean
}

export const GeneratedVideoDisplay: React.FC<GeneratedVideoDisplayProps> = ({
  toolResult,
  isDarkMode,
  isBrowserVisible = false
}) => {
  // Check if we have video URLs to display - support multiple data structures
  let videos: any[] = []
  
  if (toolResult?.output?.videos && Array.isArray(toolResult.output.videos)) {
    videos = toolResult.output.videos
  } else if (toolResult?.output?.video) {
    // Single video object
    videos = [toolResult.output.video]
  } else if (toolResult?.output?.url && typeof toolResult.output.url === 'string') {
    // Direct URL string
    videos = [toolResult.output.url]
  } else if (toolResult?.videos && Array.isArray(toolResult.videos)) {
    videos = toolResult.videos
  }

  if (videos.length === 0) {
    console.log('No videos found in toolResult:', toolResult)
    return null
  }

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>, index: number) => {
    const video = e.currentTarget
    console.error(`Video ${index + 1} failed to load:`, {
      src: video.src,
      error: video.error,
      networkState: video.networkState,
      readyState: video.readyState,
      errorCode: video.error?.code,
      errorMessage: video.error?.message
    })
  }

  const convertSupabaseUrlToMakinari = (url: string): string => {
    if (!url) return url
    // Convert Supabase storage URLs to db.makinari.com
    if (url.includes('supabase.co/storage')) {
      return url.replace(/https?:\/\/[^\/]+\.supabase\.co/, 'https://db.makinari.com')
    }
    return url
  }

  const getProxiedVideoUrl = (url: string): string => {
    if (!url) return url
    // Use proxy for videos to avoid CORS issues
    // Only proxy if it's from db.makinari.com or supabase.co
    if (url.includes('db.makinari.com') || url.includes('supabase.co')) {
      const proxied = `/api/assets/proxy?url=${encodeURIComponent(url)}`
      console.log('Using proxied video URL:', { original: url, proxied })
      return proxied
    }
    return url
  }

  const getVideoUrl = (videoObj: any): string => {
    let url = ''
    if (typeof videoObj === 'string') {
      url = videoObj
    } else if (videoObj?.url) {
      url = videoObj.url
    } else if (videoObj?.src) {
      url = videoObj.src
    } else if (videoObj?.file_path) {
      url = videoObj.file_path
    }
    
    // Convert Supabase URL to db.makinari.com if needed
    const convertedUrl = convertSupabaseUrlToMakinari(url)
    // Use proxy to avoid CORS issues
    return getProxiedVideoUrl(convertedUrl)
  }

  const getVideoMimeType = (videoObj: any): string => {
    if (videoObj?.mimeType) {
      return videoObj.mimeType
    }
    // Fallback: try to detect from URL
    const url = getVideoUrl(videoObj)
    if (url) {
      if (url.includes('.mp4')) return 'video/mp4'
      if (url.includes('.webm')) return 'video/webm'
      if (url.includes('.mov') || url.includes('.quicktime')) return 'video/quicktime'
    }
    return 'video/mp4' // Default
  }

  return (
    <div className="space-y-3 inline-block">
      {/* Display generated videos */}
      <div className="grid gap-3">
        {videos.map((videoObj: any, index: number) => {
          const videoUrl = getVideoUrl(videoObj)
          if (!videoUrl) {
            console.warn(`Video ${index + 1} has no valid URL:`, videoObj)
            return null
          }
          
          const mimeType = getVideoMimeType(videoObj)
          
          return (
            <div key={index} className="relative">
              <video 
                src={videoUrl}
                controls
                preload="metadata"
                playsInline
                className={isBrowserVisible ? "w-full h-auto rounded-lg border shadow-sm" : "max-w-[33vw] h-auto rounded-lg border shadow-sm"}
                style={{ height: 'auto', maxWidth: isBrowserVisible ? '100%' : undefined }}
                onError={(e) => handleVideoError(e, index)}
                onLoadStart={() => console.log(`Video ${index + 1} started loading:`, videoUrl)}
                onCanPlay={() => console.log(`Video ${index + 1} can play`)}
                onLoadedMetadata={() => console.log(`Video ${index + 1} metadata loaded`)}
                onLoadedData={() => console.log(`Video ${index + 1} data loaded`)}
                onProgress={() => console.log(`Video ${index + 1} progress`)}
                onStalled={() => console.warn(`Video ${index + 1} stalled`)}
                onSuspend={() => console.warn(`Video ${index + 1} suspended`)}
              >
                <source src={videoUrl} type={mimeType} />
                <source src={videoUrl} type="video/mp4" />
                <source src={videoUrl} type="video/webm" />
                Your browser does not support the video tag.
                <a href={videoUrl} download>Download video</a>
              </video>
              <div className="text-xs text-muted-foreground/70 mt-1">
                Generated Video {index + 1}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Component for collapsed view - only shows videos
export const GeneratedVideoDisplayCollapsed: React.FC<GeneratedVideoDisplayProps> = ({
  toolResult,
  isDarkMode,
  onVideoClick,
  isBrowserVisible = false
}) => {
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0)
  
  // Check if we have video URLs to display - support multiple data structures
  let videos: any[] = []
  
  if (toolResult?.output?.videos && Array.isArray(toolResult.output.videos)) {
    videos = toolResult.output.videos
  } else if (toolResult?.output?.video) {
    // Single video object
    videos = [toolResult.output.video]
  } else if (toolResult?.output?.url && typeof toolResult.output.url === 'string') {
    // Direct URL string
    videos = [toolResult.output.url]
  } else if (toolResult?.videos && Array.isArray(toolResult.videos)) {
    videos = toolResult.videos
  }

  if (videos.length === 0) {
    console.log('No videos found in toolResult (collapsed):', toolResult)
    return null
  }

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>, index: number) => {
    const video = e.currentTarget
    const error = video.error
    
    const errorDetails: any = {
      src: video.src,
      networkState: video.networkState,
      readyState: video.readyState,
      currentSrc: video.currentSrc,
      canPlayType: video.canPlayType('video/mp4'),
    }
    
    if (error) {
      errorDetails.errorCode = error.code
      errorDetails.errorMessage = error.message
      errorDetails.error = {
        code: error.code,
        message: error.message,
        MEDIA_ERR_ABORTED: error.MEDIA_ERR_ABORTED,
        MEDIA_ERR_NETWORK: error.MEDIA_ERR_NETWORK,
        MEDIA_ERR_DECODE: error.MEDIA_ERR_DECODE,
        MEDIA_ERR_SRC_NOT_SUPPORTED: error.MEDIA_ERR_SRC_NOT_SUPPORTED,
      }
    } else {
      errorDetails.error = null
      errorDetails.note = 'Video error object is null/undefined - might be a codec or format issue'
    }
    
    console.error(`Video ${index + 1} failed to load (collapsed):`, errorDetails)
    
    // Try to fetch the URL with full headers to check content-type
    fetch(video.src, { method: 'HEAD' })
      .then((response) => {
        console.log('Video URL HEAD response:', {
          status: response.status,
          statusText: response.statusText,
          contentType: response.headers.get('content-type'),
          contentLength: response.headers.get('content-length'),
          acceptRanges: response.headers.get('accept-ranges'),
        })
      })
      .catch((fetchError) => console.error('Video URL fetch test failed:', fetchError))
  }

  const convertSupabaseUrlToMakinari = (url: string): string => {
    if (!url) return url
    // Convert Supabase storage URLs to db.makinari.com
    if (url.includes('supabase.co/storage')) {
      const converted = url.replace(/https?:\/\/[^\/]+\.supabase\.co/, 'https://db.makinari.com')
      console.log('Converting Supabase URL to db.makinari.com (collapsed):', { original: url, converted })
      return converted
    }
    return url
  }

  const getProxiedVideoUrl = (url: string): string => {
    if (!url) return url
    // Use proxy for videos to avoid CORS issues
    // Only proxy if it's from db.makinari.com or supabase.co
    if (url.includes('db.makinari.com') || url.includes('supabase.co')) {
      const proxied = `/api/assets/proxy?url=${encodeURIComponent(url)}`
      console.log('Using proxied video URL (collapsed):', { original: url, proxied })
      return proxied
    }
    return url
  }

  const getVideoUrl = (videoObj: any): string => {
    let url = ''
    if (typeof videoObj === 'string') {
      url = videoObj
    } else if (videoObj?.url) {
      url = videoObj.url
    } else if (videoObj?.src) {
      url = videoObj.src
    } else if (videoObj?.file_path) {
      url = videoObj.file_path
    }
    
    // Convert Supabase URL to db.makinari.com if needed
    const convertedUrl = convertSupabaseUrlToMakinari(url)
    // Use proxy to avoid CORS issues
    return getProxiedVideoUrl(convertedUrl)
  }

  const getVideoMimeType = (videoObj: any): string => {
    if (videoObj?.mimeType) {
      return videoObj.mimeType
    }
    // Fallback: try to detect from URL
    const url = getVideoUrl(videoObj)
    if (url) {
      if (url.includes('.mp4')) return 'video/mp4'
      if (url.includes('.webm')) return 'video/webm'
      if (url.includes('.mov') || url.includes('.quicktime')) return 'video/quicktime'
    }
    return 'video/mp4' // Default
  }

  // Single video - simple display
  if (videos.length === 1) {
    const videoUrl = getVideoUrl(videos[0])
    if (!videoUrl) {
      console.warn('Single video has no valid URL:', videos[0])
      return null
    }
    const mimeType = getVideoMimeType(videos[0])
    
    return (
      <div className="grid gap-3 inline-block">
        <div className="relative">
          <div 
            className="relative cursor-pointer group"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onVideoClick?.(e)
            }}
          >
            <video 
              src={videoUrl}
              preload="metadata"
              playsInline
              muted
              className={isBrowserVisible ? "w-full h-auto rounded-lg border shadow-sm hover:opacity-90 transition-opacity" : "max-w-[33vw] h-auto rounded-lg border shadow-sm hover:opacity-90 transition-opacity"}
              style={{ height: 'auto', maxWidth: isBrowserVisible ? '100%' : undefined }}
            >
              <source src={videoUrl} type={mimeType} />
              <source src={videoUrl} type="video/mp4" />
              <source src={videoUrl} type="video/webm" />
            </video>
            {/* Play overlay button */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors rounded-lg">
              <div className="w-16 h-16 rounded-full bg-background/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-foreground ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Multiple videos - carousel with thumbnails
  const currentVideoUrl = getVideoUrl(videos[selectedVideoIndex])
  if (!currentVideoUrl) {
    console.warn('Current video has no valid URL:', videos[selectedVideoIndex])
    return null
  }

  const currentMimeType = getVideoMimeType(videos[selectedVideoIndex])

  return (
    <div className="space-y-3 inline-block">
      {/* Main video display */}
      <div className="relative">
        <div 
          className="relative cursor-pointer group"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onVideoClick?.(e as any)
          }}
        >
          <video 
            key={selectedVideoIndex}
            src={currentVideoUrl}
            preload="metadata"
            playsInline
            muted
            className={isBrowserVisible ? "w-full h-auto rounded-lg border shadow-sm hover:opacity-90 transition-opacity" : "max-w-[33vw] h-auto rounded-lg border shadow-sm hover:opacity-90 transition-opacity"}
            style={{ height: 'auto', maxWidth: isBrowserVisible ? '100%' : undefined }}
          >
            <source src={currentVideoUrl} type={currentMimeType} />
            <source src={currentVideoUrl} type="video/mp4" />
            <source src={currentVideoUrl} type="video/webm" />
          </video>
          {/* Play overlay button */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors rounded-lg">
            <div className="w-16 h-16 rounded-full bg-background/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
              <svg className="w-8 h-8 text-foreground ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
      
      {/* Thumbnail carousel */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {videos.map((videoObj: any, index: number) => {
          const thumbnailUrl = getVideoUrl(videoObj)
          if (!thumbnailUrl) return null
          
          return (
            <button
              key={index}
              onClick={() => setSelectedVideoIndex(index)}
              className={`flex-shrink-0 w-20 h-20 rounded-lg border-2 transition-all duration-200 flex items-center justify-center overflow-hidden ${
                selectedVideoIndex === index
                  ? 'border-primary shadow-md'
                  : 'border-muted-foreground/30 hover:border-muted-foreground/60'
              }`}
            >
              <video 
                src={thumbnailUrl}
                className="w-full h-full object-cover rounded-lg"
                style={{ width: '80px', height: '80px' }}
                muted
                preload="metadata"
                playsInline
                onError={(e) => handleVideoError(e, index)}
              >
                <source src={thumbnailUrl} type="video/mp4" />
                <source src={thumbnailUrl} type="video/webm" />
              </video>
            </button>
          )
        })}
      </div>
    </div>
  )
}

