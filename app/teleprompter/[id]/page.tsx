"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/app/components/ui/button"
import { Slider } from "@/app/components/ui/slider"
import { Card, CardContent } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { 
  RotateCcw, 
  Settings,
  PlayCircle,
  StopCircle,
  ChevronLeft,
  Eye,
  EyeOff,
  Circle,
  X
} from "@/app/components/ui/icons"
import { toast } from "sonner"
import { getContentById } from "@/app/content/actions"
import { createAsset, uploadAssetFile } from "@/app/assets/actions"
import { useSite } from "@/app/context/SiteContext"
import { cn } from "@/lib/utils"

// Local icon components for Play and Pause
const Play = ({ className = "", size = 20, ...props }: { className?: string, size?: number, [key: string]: any }) => (
  <div 
    className={`inline-flex items-center justify-center safari-icon-fix ${className}`}
    style={{ 
      width: size, 
      height: size, 
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      ...props.style 
    }}
    onClick={props.onClick}
    aria-hidden={props["aria-hidden"] ?? true}
  >
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  </div>
)

const Pause = ({ className = "", size = 20, ...props }: { className?: string, size?: number, [key: string]: any }) => (
  <div 
    className={`inline-flex items-center justify-center safari-icon-fix ${className}`}
    style={{ 
      width: size, 
      height: size, 
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      ...props.style 
    }}
    onClick={props.onClick}
    aria-hidden={props["aria-hidden"] ?? true}
  >
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  </div>
)

interface TeleprompterSettings {
  fontSize: number
  scrollSpeed: number
  backgroundColor: string
  textColor: string
  lineHeight: number
  padding: number
}

const defaultSettings: TeleprompterSettings = {
  fontSize: 32,
  scrollSpeed: 50,
  backgroundColor: '#000000',
  textColor: '#ffffff',
  lineHeight: 1.6,
  padding: 40
}

// Preset configurations
const presets = {
  presentation: { fontSize: 36, scrollSpeed: 40, lineHeight: 1.8, padding: 60 },
  practice: { fontSize: 28, scrollSpeed: 60, lineHeight: 1.5, padding: 40 },
  recording: { fontSize: 32, scrollSpeed: 45, lineHeight: 1.7, padding: 50 },
  interview: { fontSize: 30, scrollSpeed: 35, lineHeight: 1.6, padding: 45 }
}

export default function TeleprompterPage() {
  const params = useParams()
  const router = useRouter()
  const { currentSite } = useSite()
  const [content, setContent] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isScrolling, setIsScrolling] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [settings, setSettings] = useState<TeleprompterSettings>(defaultSettings)
  const [showSettings, setShowSettings] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([])
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isSavingVideo, setIsSavingVideo] = useState(false)
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [showPreview, setShowPreview] = useState(true)
  
  // Video preview dragging state
  const [previewPosition, setPreviewPosition] = useState(() => {
    // Start centered horizontally, below top controls
    if (typeof window !== 'undefined') {
      const previewWidth = 192 // w-48 = 12rem = 192px
      const centerX = (window.innerWidth - previewWidth) / 2
      return { x: Math.max(10, centerX), y: 64 }
    }
    return { x: 0, y: 64 }
  })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const videoPreviewRef = useRef<HTMLVideoElement>(null)
  const previewContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadContent()
  }, [params.id])

  useEffect(() => {
    // Check media support on component mount
    const { supported, error } = checkMediaSupport()
    if (!supported) {
      console.warn("Media support issue detected on mount:", error)
      // Show a subtle toast to inform the user
      setTimeout(() => {
        toast.error("Recording not available: " + error, { duration: 5000 })
      }, 2000) // Delay to avoid interfering with page load
    }
  }, [])

  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      cleanupRecording()
    }
  }, [])

  // Handle drag events
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.addEventListener('touchmove', handleTouchMove, { passive: false })
      document.addEventListener('touchend', handleTouchEnd)
      
      // Add cursor style to body while dragging
      document.body.style.cursor = 'grabbing'
      document.body.style.userSelect = 'none'
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.removeEventListener('touchmove', handleTouchMove)
        document.removeEventListener('touchend', handleTouchEnd)
        
        // Reset cursor and user select
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
     }, [isDragging, dragOffset])

  // Handle window resize to keep preview visible
  useEffect(() => {
    const handleResize = () => {
      if (isStreamValid(stream) && showPreview) {
        setPreviewPosition(prev => constrainPosition(prev.x, prev.y))
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [stream, showPreview])

  useEffect(() => {
    // Hide controls after 3 seconds of inactivity
    const resetControlsTimeout = () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false)
      }, 3000)
    }

    const handleMouseMove = () => {
      setShowControls(true)
      resetControlsTimeout()
    }

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        toggleScrolling()
      } else if (e.code === 'Escape') {
        router.push(`/content/${params.id}`)
      } else if (e.code === 'ArrowUp' && (e.ctrlKey || e.metaKey)) {
        // Ctrl/Cmd + Up: Increase font size
        e.preventDefault()
        setSettings(prev => ({ ...prev, fontSize: Math.min(72, prev.fontSize + 2) }))
      } else if (e.code === 'ArrowDown' && (e.ctrlKey || e.metaKey)) {
        // Ctrl/Cmd + Down: Decrease font size
        e.preventDefault()
        setSettings(prev => ({ ...prev, fontSize: Math.max(12, prev.fontSize - 2) }))
      } else if (e.code === 'ArrowRight' && (e.ctrlKey || e.metaKey)) {
        // Ctrl/Cmd + Right: Increase speed
        e.preventDefault()
        setSettings(prev => ({ ...prev, scrollSpeed: Math.min(300, prev.scrollSpeed + 5) }))
      } else if (e.code === 'ArrowLeft' && (e.ctrlKey || e.metaKey)) {
        // Ctrl/Cmd + Left: Decrease speed
        e.preventDefault()
        setSettings(prev => ({ ...prev, scrollSpeed: Math.max(5, prev.scrollSpeed - 5) }))
      } else if (e.code === 'KeyR' && (e.ctrlKey || e.metaKey)) {
        // Ctrl/Cmd + R: Reset to beginning
        e.preventDefault()
        resetScroll()
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('keydown', handleKeyPress)
    
    // Initial timeout
    resetControlsTimeout()

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('keydown', handleKeyPress)
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
    }
  }, [router, params.id])

  const loadContent = async () => {
    setIsLoading(true)
    try {
      const { content: contentData, error } = await getContentById(params.id as string)
      
      if (error) {
        toast.error(error)
        router.push(`/content/${params.id}`)
        return
      }

      if (!contentData) {
        toast.error("Content not found")
        router.push(`/content/${params.id}`)
        return
      }

      if (contentData.type !== 'video') {
        toast.error("Teleprompter is only available for video content")
        router.push(`/content/${params.id}`)
        return
      }

      setContent(contentData)
    } catch (error) {
      console.error("Error loading content:", error)
      toast.error("Failed to load content")
      router.push(`/content/${params.id}`)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleScrolling = useCallback(() => {
    // Always clear any existing interval first
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current)
      scrollIntervalRef.current = null
    }
    
    if (isScrolling) {
      // Just stop scrolling - interval already cleared above
      setIsScrolling(false)
    } else {
      // Start scrolling
      setIsScrolling(true)
      if (!startTime) {
        setStartTime(new Date())
      }
      
      // Create new interval
      scrollIntervalRef.current = setInterval(() => {
        if (scrollContainerRef.current) {
          const scrollAmount = (settings.scrollSpeed / 100) * 1.2 // Pixels per interval
          scrollContainerRef.current.scrollTop += scrollAmount
        }
      }, 16) // ~60fps
    }
  }, [isScrolling, settings.scrollSpeed, startTime])

  const resetScroll = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0
    }
    setIsScrolling(false)
    setStartTime(null)
    setElapsedTime(0)
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current)
      scrollIntervalRef.current = null
    }
  }

  // Timer effect
  useEffect(() => {
    let timerInterval: NodeJS.Timeout
    
    if (isScrolling && startTime) {
      timerInterval = setInterval(() => {
        setElapsedTime(Math.floor((new Date().getTime() - startTime.getTime()) / 1000))
      }, 1000)
    }
    
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval)
      }
    }
  }, [isScrolling, startTime])

  const checkMediaSupport = () => {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      return { supported: false, error: "Not running in browser environment" }
    }

    // Check if navigator exists
    if (typeof navigator === 'undefined') {
      return { 
        supported: false, 
        error: "Navigator is not available" 
      }
    }

    // Check if mediaDevices exists on navigator
    if (!navigator.mediaDevices) {
      return { 
        supported: false, 
        error: "MediaDevices API is not available. This might be due to an insecure connection or browser restrictions." 
      }
    }

    // Check if getUserMedia method exists
    if (typeof navigator.mediaDevices.getUserMedia !== 'function') {
      return { 
        supported: false, 
        error: "getUserMedia is not supported in this browser. Please use a modern browser like Chrome, Firefox, or Safari." 
      }
    }

    // Check if we're on HTTPS (required for getUserMedia in most browsers)
    if (typeof location !== 'undefined' && location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      return { 
        supported: false, 
        error: "Camera access requires HTTPS. Please use a secure connection." 
      }
    }

    // Check if MediaRecorder is supported
    if (typeof window.MediaRecorder === 'undefined') {
      return { 
        supported: false, 
        error: "MediaRecorder is not supported in this browser." 
      }
    }

    return { supported: true, error: null }
  }

  const isStreamValid = (stream: MediaStream | null): boolean => {
    return !!(stream && stream.active && stream.getVideoTracks().length > 0)
  }

  // Video preview dragging functions
  const constrainPosition = (x: number, y: number) => {
    const previewWidth = 192 // w-48 = 12rem = 192px
    const previewHeight = 144 // h-36 = 9rem = 144px
    const margin = 10 // Small margin from edges
    
    const maxX = window.innerWidth - previewWidth - margin
    const maxY = window.innerHeight - previewHeight - margin
    
    return {
      x: Math.max(margin, Math.min(maxX, x)),
      y: Math.max(margin, Math.min(maxY, y))
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!previewContainerRef.current) return
    
    setIsDragging(true)
    const rect = previewContainerRef.current.getBoundingClientRect()
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
    
    // Prevent text selection while dragging
    e.preventDefault()
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return
    
    const newPosition = constrainPosition(
      e.clientX - dragOffset.x,
      e.clientY - dragOffset.y
    )
    
    setPreviewPosition(newPosition)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    
    // Optional: Snap to edges if close enough
    const snapDistance = 20
    const currentPos = previewPosition
    
    let snappedX = currentPos.x
    let snappedY = currentPos.y
    
    // Snap to left edge
    if (currentPos.x < snapDistance) {
      snappedX = 10
    }
    // Snap to right edge
    else if (currentPos.x > window.innerWidth - 192 - snapDistance - 10) {
      snappedX = window.innerWidth - 192 - 10
    }
    
    // Snap to top edge (below controls)
    if (currentPos.y < 64 + snapDistance) {
      snappedY = 64
    }
    // Snap to bottom edge
    else if (currentPos.y > window.innerHeight - 144 - snapDistance - 10) {
      snappedY = window.innerHeight - 144 - 10
    }
    
    if (snappedX !== currentPos.x || snappedY !== currentPos.y) {
      setPreviewPosition({ x: snappedX, y: snappedY })
    }
  }

  // Touch event handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!previewContainerRef.current) return
    
    const touch = e.touches[0]
    setIsDragging(true)
    const rect = previewContainerRef.current.getBoundingClientRect()
    setDragOffset({
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    })
    
    e.preventDefault()
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging) return
    
    const touch = e.touches[0]
    const newPosition = constrainPosition(
      touch.clientX - dragOffset.x,
      touch.clientY - dragOffset.y
    )
    
    setPreviewPosition(newPosition)
    e.preventDefault()
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
    
    // Optional: Snap to edges if close enough (same logic as mouse)
    const snapDistance = 20
    const currentPos = previewPosition
    
    let snappedX = currentPos.x
    let snappedY = currentPos.y
    
    if (currentPos.x < snapDistance) {
      snappedX = 10
    } else if (currentPos.x > window.innerWidth - 192 - snapDistance - 10) {
      snappedX = window.innerWidth - 192 - 10
    }
    
    if (currentPos.y < 64 + snapDistance) {
      snappedY = 64
    } else if (currentPos.y > window.innerHeight - 144 - snapDistance - 10) {
      snappedY = window.innerHeight - 144 - 10
    }
    
    if (snappedX !== currentPos.x || snappedY !== currentPos.y) {
      setPreviewPosition({ x: snappedX, y: snappedY })
    }
  }

  const cleanupRecording = () => {
    try {
      // Stop all tracks if stream exists and is valid
      if (stream && stream.getTracks) {
        stream.getTracks().forEach(track => {
          if (track && track.stop) {
            track.stop()
          }
        })
      }
      
      // Stop media recorder if exists and active
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop()
      }
      
      // Clean up video preview
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = null
      }
    } catch (error) {
      console.warn("Error during cleanup:", error)
    } finally {
      // Reset all states regardless of cleanup success
      setIsRecording(false)
      setMediaRecorder(null)
      setStream(null)
      setRecordedChunks([])
    }
  }

  const startRecording = async () => {
    try {
      // Debug logging
      console.log("Starting recording - navigator:", typeof navigator)
      console.log("mediaDevices:", typeof navigator?.mediaDevices)
      console.log("getUserMedia:", typeof navigator?.mediaDevices?.getUserMedia)
      
      // Check media support first
      const { supported, error } = checkMediaSupport()
      if (!supported) {
        console.log("Media support check failed:", error)
        toast.error(error || "Media recording is not supported")
        return
      }

      // Double-check that getUserMedia is available before calling
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia is not available")
      }

      // Request camera and microphone permissions
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        }, 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      })
      
      console.log("MediaStream obtained:", mediaStream)
      console.log("Video tracks:", mediaStream.getVideoTracks().length)
      console.log("Audio tracks:", mediaStream.getAudioTracks().length)
      
      setStream(mediaStream)
      
      // Show preview in video element with enhanced error handling
      if (videoPreviewRef.current) {
        const videoElement = videoPreviewRef.current
        
        // Add event listeners for debugging
        const handleLoadedMetadata = () => {
          console.log("Video metadata loaded successfully")
          console.log("Video dimensions:", videoElement.videoWidth, "x", videoElement.videoHeight)
        }
        
        const handlePlay = () => {
          console.log("Video started playing")
        }
        
        const handleError = (e: Event) => {
          console.error("Video element error:", e)
          const target = e.target as HTMLVideoElement
          if (target.error) {
            console.error("Video error details:", target.error.message, target.error.code)
          }
        }
        
        const handleLoadStart = () => {
          console.log("Video load started")
        }
        
        // Add event listeners
        videoElement.addEventListener('loadedmetadata', handleLoadedMetadata)
        videoElement.addEventListener('play', handlePlay)
        videoElement.addEventListener('error', handleError)
        videoElement.addEventListener('loadstart', handleLoadStart)
        
        // Cleanup function for event listeners
        const cleanup = () => {
          videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata)
          videoElement.removeEventListener('play', handlePlay)
          videoElement.removeEventListener('error', handleError)
          videoElement.removeEventListener('loadstart', handleLoadStart)
        }
        
        try {
          console.log("Setting srcObject to video element")
          videoElement.srcObject = mediaStream
          
          // Try to play with more robust error handling
          const playPromise = videoElement.play()
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                console.log("Video play promise resolved successfully")
              })
              .catch((error) => {
                console.error("Video play promise rejected:", error)
                
                // Try alternative approach if autoplay fails
                if (error.name === 'NotAllowedError') {
                  console.log("Autoplay blocked, will try manual play")
                  toast.info("Click on the video preview to start playback")
                }
              })
          }
        } catch (error) {
          console.error("Error setting video srcObject:", error)
          cleanup()
        }
      }
      
      const recorder = new MediaRecorder(mediaStream)
      setMediaRecorder(recorder)
      
      const chunks: Blob[] = []
      setRecordedChunks(chunks)
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
          setRecordedChunks([...chunks])
        }
      }
      
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' })
        const url = URL.createObjectURL(blob)
        
        // Download the video
        const a = document.createElement('a')
        a.href = url
        a.download = `${content?.title || 'video'}-recording.webm`
        a.click()
        
        URL.revokeObjectURL(url)
        setRecordedChunks([])
      }
      
      recorder.start()
      setIsRecording(true)
      toast.success("Recording started")
    } catch (error: any) {
      console.error("Error starting recording:", error)
      
      // Clean up any partial state on error
      cleanupRecording()
      
      let errorMessage = "Failed to start recording."
      
      if (error.name === 'NotAllowedError') {
        errorMessage = "Camera/microphone access was denied. Please allow permissions and try again."
      } else if (error.name === 'NotFoundError') {
        errorMessage = "No camera or microphone found. Please connect a device and try again."
      } else if (error.name === 'NotReadableError') {
        errorMessage = "Camera or microphone is already in use by another application."
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = "Camera settings are not supported. Trying with default settings..."
        
        // Try again with more relaxed constraints
        try {
          // Double-check availability again for fallback
          if (!navigator?.mediaDevices?.getUserMedia) {
            throw new Error("getUserMedia is not available for fallback")
          }
          
          const fallbackStream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true 
          })
          setStream(fallbackStream)
          
          if (videoPreviewRef.current) {
            videoPreviewRef.current.srcObject = fallbackStream
            videoPreviewRef.current.play()
          }
          
          const recorder = new MediaRecorder(fallbackStream)
          setMediaRecorder(recorder)
          recorder.start()
          setIsRecording(true)
          toast.success("Recording started with default settings")
          return
        } catch (fallbackError) {
          console.error("Fallback recording failed:", fallbackError)
          errorMessage = "Failed to start recording even with default settings."
          cleanupRecording() // Clean up after fallback failure too
        }
      } else if (error.name === 'SecurityError') {
        errorMessage = "Security error: Please ensure you're on a secure connection (HTTPS)."
      } else if (error.message === 'getUserMedia is not available') {
        errorMessage = "Camera API is not available. Please refresh the page and try again."
      } else if (error.message?.includes('Cannot read properties of undefined')) {
        errorMessage = "Browser API error: Please refresh the page and ensure you're using a supported browser (Chrome, Firefox, Safari)."
      }
      
      toast.error(errorMessage)
    }
  }

  const stopRecording = async () => {
    // Create backup of chunks before cleanup
    const chunksToSave = [...recordedChunks]
    
    cleanupRecording()
    
    // Save the recorded video as an asset
    if (chunksToSave.length > 0 && currentSite?.id && content) {
      setIsSavingVideo(true)
      try {
        const blob = new Blob(chunksToSave, { type: 'video/webm' })
        
        // Create a File object from the blob
        const fileName = `${content.title}-recording-${Date.now()}.webm`
        const file = new File([blob], fileName, { type: 'video/webm' })
        
        // Upload the file to storage
        const { path, error: uploadError } = await uploadAssetFile(file)
        
        if (uploadError) {
          throw new Error(uploadError)
        }
        
        if (!path) {
          throw new Error("Could not get URL of uploaded video")
        }
        
        // Create the asset record
        const { asset, error: assetError } = await createAsset({
          name: fileName,
          description: `Recorded video for "${content.title}"`,
          file_path: path,
          file_type: 'video/webm',
          file_size: file.size,
          tags: ['teleprompter-recording', 'video', content.type],
          site_id: currentSite.id
        })
        
        if (assetError || !asset) {
          throw new Error(assetError || "Error creating asset record")
        }
        
        toast.success("Video saved successfully as an asset")
        
        // Show additional info about where to find the video
        setTimeout(() => {
          toast.info("You can find the recorded video in the Assets section")
        }, 2000)
        
        // Also provide download option
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        a.click()
        URL.revokeObjectURL(url)
        
      } catch (error) {
        console.error("Error saving video:", error)
        toast.error(error instanceof Error ? error.message : "Failed to save video")
        
        // Fallback to just download if saving fails
        const blob = new Blob(recordedChunks, { type: 'video/webm' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${content?.title || 'video'}-recording.webm`
        a.click()
        URL.revokeObjectURL(url)
      } finally {
        setIsSavingVideo(false)
        setRecordedChunks([])
      }
    } else {
      toast.success("Recording stopped")
    }
  }

  useEffect(() => {
    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current)
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [stream])

  // Convert HTML content to plain text for display
  const getPlainText = (htmlContent: string) => {
    if (!htmlContent) return ''
    
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = htmlContent
    return tempDiv.textContent || tempDiv.innerText || ''
  }

  // Calculate estimated reading time
  const calculateReadingTime = (text: string, scrollSpeed: number) => {
    const wordsPerMinute = 150 // Average reading speed
    const wordCount = text.trim().split(/\s+/).filter(word => word.length > 0).length
    const baseTimeMinutes = wordCount / wordsPerMinute
    
    // Adjust for scroll speed (slower speed = more time)
    const speedMultiplier = 100 / scrollSpeed
    const adjustedTimeMinutes = baseTimeMinutes * speedMultiplier
    
    const minutes = Math.floor(adjustedTimeMinutes)
    const seconds = Math.floor((adjustedTimeMinutes - minutes) * 60)
    
    return { minutes, seconds, wordCount }
  }

  const plainText = content ? getPlainText(content.text || content.content || '') : ''
  const { minutes, seconds, wordCount } = calculateReadingTime(plainText, settings.scrollSpeed)

  const applyPreset = (presetName: keyof typeof presets) => {
    const preset = presets[presetName]
    setSettings(prev => ({
      ...prev,
      ...preset
    }))
  }

  if (isLoading) {
    return (
      <div 
        className="fixed inset-0 overflow-hidden bg-black"
      >
        {/* Skeleton for top controls */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-8 w-24 bg-white/10 animate-pulse rounded"></div>
            <div className="h-6 w-32 bg-white/10 animate-pulse rounded"></div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-white/10 animate-pulse rounded"></div>
            <div className="h-8 w-8 bg-white/10 animate-pulse rounded"></div>
          </div>
        </div>

        {/* Skeleton for main text content */}
        <div className="h-full flex items-center justify-center p-20">
          <div className="max-w-4xl w-full space-y-8">
            <div className="space-y-6">
              <div className="h-8 bg-white/10 animate-pulse rounded w-3/4 mx-auto"></div>
              <div className="h-8 bg-white/10 animate-pulse rounded w-full mx-auto"></div>
              <div className="h-8 bg-white/10 animate-pulse rounded w-5/6 mx-auto"></div>
            </div>
            
            <div className="space-y-6">
              <div className="h-8 bg-white/10 animate-pulse rounded w-4/5 mx-auto"></div>
              <div className="h-8 bg-white/10 animate-pulse rounded w-full mx-auto"></div>
              <div className="h-8 bg-white/10 animate-pulse rounded w-2/3 mx-auto"></div>
            </div>
            
            <div className="space-y-6">
              <div className="h-8 bg-white/10 animate-pulse rounded w-5/6 mx-auto"></div>
              <div className="h-8 bg-white/10 animate-pulse rounded w-3/4 mx-auto"></div>
              <div className="h-8 bg-white/10 animate-pulse rounded w-4/5 mx-auto"></div>
            </div>
          </div>
        </div>

        {/* Skeleton for bottom controls */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          <div className="flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-lg p-4">
            {/* Font controls skeleton */}
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-white/20 animate-pulse rounded"></div>
              <div className="h-4 w-6 bg-white/20 animate-pulse rounded"></div>
              <div className="h-8 w-8 bg-white/20 animate-pulse rounded"></div>
            </div>
            
            <div className="w-px h-6 bg-white/20" />
            
            {/* Speed controls skeleton */}
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-white/20 animate-pulse rounded"></div>
              <div className="h-4 w-8 bg-white/20 animate-pulse rounded"></div>
              <div className="h-8 w-8 bg-white/20 animate-pulse rounded"></div>
            </div>
            
            <div className="w-px h-6 bg-white/20" />
            
            {/* Timer skeletons */}
            <div className="h-12 w-16 bg-white/20 animate-pulse rounded"></div>
            <div className="h-12 w-16 bg-white/20 animate-pulse rounded"></div>
            
            <div className="w-px h-6 bg-white/20" />
            
            {/* Control buttons skeleton */}
            <div className="h-8 w-8 bg-white/20 animate-pulse rounded"></div>
            <div className="h-10 w-24 bg-white/20 animate-pulse rounded"></div>
            <div className="h-8 w-20 bg-white/20 animate-pulse rounded"></div>
          </div>
        </div>

        {/* Skeleton for keyboard shortcuts hint */}
        <div className="fixed bottom-4 left-4">
          <div className="space-y-1">
            <div className="h-3 w-48 bg-white/10 animate-pulse rounded"></div>
            <div className="h-3 w-40 bg-white/10 animate-pulse rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="fixed inset-0 overflow-hidden"
      style={{ backgroundColor: settings.backgroundColor }}
    >
      {/* Video Preview */}
      {isStreamValid(stream) && showPreview && (
        <div 
          ref={previewContainerRef}
          className={cn(
            "absolute pointer-events-auto z-10 transition-all duration-200",
            isDragging ? "shadow-2xl scale-105" : "shadow-lg hover:shadow-xl"
          )}
          style={{
            left: `${previewPosition.x}px`,
            top: `${previewPosition.y}px`,
            cursor: isDragging ? 'grabbing' : 'grab',
            transition: isDragging ? 'none' : 'left 0.3s ease-out, top 0.3s ease-out, transform 0.2s ease-out, box-shadow 0.2s ease-out'
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
                     <div className={cn(
             "group relative bg-black/80 backdrop-blur-sm rounded-lg border overflow-hidden transition-all duration-200",
             isDragging ? "border-blue-400/50 bg-black/90" : "border-white/20 hover:border-white/30"
           )}>
            {/* Drag handle */}
            <div className={cn(
              "absolute top-0 left-0 right-0 h-6 bg-black/50 backdrop-blur-sm flex items-center justify-center z-20 transition-opacity duration-200",
              isDragging || showControls ? "opacity-100" : "opacity-0 hover:opacity-100"
            )}>
              <div className="flex space-x-0.5">
                <div className="w-1 h-1 bg-white/60 rounded-full"></div>
                <div className="w-1 h-1 bg-white/60 rounded-full"></div>
                <div className="w-1 h-1 bg-white/60 rounded-full"></div>
                <div className="w-1 h-1 bg-white/60 rounded-full"></div>
                <div className="w-1 h-1 bg-white/60 rounded-full"></div>
                <div className="w-1 h-1 bg-white/60 rounded-full"></div>
              </div>
            </div>
            
            <video
              ref={videoPreviewRef}
              autoPlay
              muted
              playsInline
              className="w-48 h-36 object-cover pointer-events-none select-none"
              style={{ transform: 'scaleX(-1)' }} // Mirror the preview
              onLoadedMetadata={(e) => {
                const video = e.target as HTMLVideoElement
                console.log("Video preview loaded:", video.videoWidth, "x", video.videoHeight)
              }}
              onPlay={() => console.log("Video preview playing")}
              onError={(e) => {
                const video = e.target as HTMLVideoElement
                console.error("Video preview error:", video.error)
              }}
              onLoadStart={() => console.log("Video preview load started")}
              onCanPlay={() => console.log("Video preview can play")}
              onDoubleClick={(e) => {
                e.stopPropagation()
                // Allow manual play if autoplay fails on double click
                const video = videoPreviewRef.current
                if (video && video.paused) {
                  video.play().catch(console.error)
                }
              }}
            />
            
            {/* Preview controls */}
            <div className="absolute top-7 right-2 flex gap-1 z-30">
              <Button
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowPreview(false)
                }}
                className="h-6 w-6 p-0 bg-black/50 text-white border-white/20 hover:bg-black/70 pointer-events-auto"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            
            {/* Recording indicator */}
            {isRecording && (
              <div className="absolute top-2 left-2 flex items-center gap-1">
                <Circle className="h-2 w-2 fill-current text-red-500 animate-pulse" />
                <span className="text-white text-xs font-medium">REC</span>
              </div>
            )}
            
            {/* Video status indicator */}
            {isStreamValid(stream) && (
              <div className="absolute bottom-2 left-2 flex items-center gap-1">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-white text-xs">Live</span>
              </div>
            )}
            
            {/* Drag hint */}
            {!isDragging && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="text-white/80 text-xs text-center bg-black/70 px-3 py-2 rounded-md backdrop-blur-sm border border-white/20">
                  <div className="flex items-center gap-2">
                    <div className="flex space-x-0.5">
                      <div className="w-1 h-1 bg-white/60 rounded-full"></div>
                      <div className="w-1 h-1 bg-white/60 rounded-full"></div>
                      <div className="w-1 h-1 bg-white/60 rounded-full"></div>
                    </div>
                    <span>Drag to move</span>
                  </div>
                  <div className="text-white/60 text-xs mt-1">Double-click to play</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Show preview button when hidden and camera is active */}
      {isStreamValid(stream) && !showPreview && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 pointer-events-auto z-10">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowPreview(true)}
            className="bg-black/50 text-white border-white/20 hover:bg-black/70"
          >
            <Eye className="h-4 w-4 mr-2" />
            Show Preview
          </Button>
        </div>
      )}

      {/* Main teleprompter text */}
      <div
        ref={scrollContainerRef}
        className="h-full overflow-y-auto scrollbar-hide"
        style={{ 
          padding: `${settings.padding}px`,
          paddingTop: `${settings.padding + 100}px`, // Extra padding for initial position
          paddingBottom: `${settings.padding + 100}px`, // Extra padding for final position
          scrollBehavior: 'auto' // Disable CSS smooth scrolling to let our animation handle it
        }}
      >
        <div 
          className="whitespace-pre-wrap leading-relaxed"
          style={{
            fontSize: `${settings.fontSize}px`,
            color: settings.textColor,
            lineHeight: settings.lineHeight,
            fontFamily: 'Inter, system-ui, sans-serif',
            textAlign: 'center',
            maxWidth: '800px',
            margin: '0 auto',
            willChange: 'transform' // Optimize for animations
          }}
        >
          {plainText || 'No content available for teleprompter.'}
        </div>
      </div>

      {/* Controls overlay */}
      <div 
        className={cn(
          "fixed inset-0 pointer-events-none transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0"
        )}
      >
        {/* Top controls */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push(`/content/${params.id}`)}
              className="bg-black/50 text-white border-white/20 hover:bg-black/70"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back to Editor
            </Button>
            
            <Badge className="bg-black/50 text-white border-white/20">
              {content?.title}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className="bg-black/50 text-white border-white/20 hover:bg-black/70"
            >
              <Settings className="h-4 w-4" />
            </Button>
            
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowControls(!showControls)}
              className="bg-black/50 text-white border-white/20 hover:bg-black/70"
            >
              {showControls ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Bottom controls */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 pointer-events-auto">
          <div className="flex items-center gap-4 bg-black/50 backdrop-blur-sm rounded-lg p-4 border border-white/20">
            {/* Quick font size controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSettings(prev => ({ ...prev, fontSize: Math.max(12, prev.fontSize - 4) }))}
                className="bg-black/50 text-white border-white/20 hover:bg-black/70 px-2"
              >
                A-
              </Button>
              <span className="text-white text-xs min-w-[30px] text-center">{settings.fontSize}</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSettings(prev => ({ ...prev, fontSize: Math.min(72, prev.fontSize + 4) }))}
                className="bg-black/50 text-white border-white/20 hover:bg-black/70 px-2"
              >
                A+
              </Button>
            </div>

            <div className="w-px h-6 bg-white/20" />

            {/* Quick speed controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSettings(prev => ({ ...prev, scrollSpeed: Math.max(5, prev.scrollSpeed - 5) }))}
                className="bg-black/50 text-white border-white/20 hover:bg-black/70 px-2"
              >
                🐌
              </Button>
              <span className="text-white text-xs min-w-[35px] text-center">{settings.scrollSpeed}%</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSettings(prev => ({ ...prev, scrollSpeed: Math.min(300, prev.scrollSpeed + 5) }))}
                className="bg-black/50 text-white border-white/20 hover:bg-black/70 px-2"
              >
                🐰
              </Button>
            </div>

            <div className="w-px h-6 bg-white/20" />

            {/* Timer display */}
            <div className="text-white text-sm px-3 py-1 bg-white/10 rounded">
              <div className="text-center">
                <div className="text-xs text-white/60">Elapsed</div>
                <div className="font-mono">
                  {Math.floor(elapsedTime / 60).toString().padStart(2, '0')}:
                  {(elapsedTime % 60).toString().padStart(2, '0')}
                </div>
              </div>
            </div>

            <div className="text-white text-sm px-3 py-1 bg-white/10 rounded">
              <div className="text-center">
                <div className="text-xs text-white/60">Est. Total</div>
                <div className="font-mono">
                  {minutes.toString().padStart(2, '0')}:
                  {seconds.toString().padStart(2, '0')}
                </div>
              </div>
            </div>

            <div className="w-px h-6 bg-white/20" />
            
            <Button
              variant="secondary"
              size="sm"
              onClick={resetScroll}
              className="bg-black/50 text-white border-white/20 hover:bg-black/70"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            
            <Button
              variant={isScrolling ? "default" : "secondary"}
              size="lg"
              onClick={toggleScrolling}
              className={cn(
                "px-6",
                isScrolling 
                  ? "bg-red-600 hover:bg-red-700 text-white" 
                  : "bg-green-600 hover:bg-green-700 text-white"
              )}
            >
              {isScrolling ? <Pause className="h-5 w-5 mr-2" /> : <Play className="h-5 w-5 mr-2" />}
              {isScrolling ? 'Pause' : 'Play'}
            </Button>

            <Button
              variant={isRecording ? "destructive" : "secondary"}
              size="sm"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isSavingVideo}
              className={cn(
                "min-w-[80px]", // Ensure consistent minimum width
                isRecording 
                  ? "bg-red-600 hover:bg-red-700 text-white border-red-600" 
                  : "bg-black/50 text-white border-white/20 hover:bg-black/70",
                isSavingVideo && "opacity-75"
              )}
            >
              {isSavingVideo ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2"></span>
                  Saving...
                </>
              ) : isRecording ? (
                <>
                  <StopCircle className="h-4 w-4 mr-2" />
                  Stop
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Record
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="absolute top-20 right-4 w-80 pointer-events-auto">
            <Card className="bg-black/50 backdrop-blur-sm border-white/20">
              <CardContent className="p-6 space-y-6">
                <h3 className="text-lg font-semibold text-white">Teleprompter Settings</h3>
                
                {/* Reading Time Info */}
                <div className="bg-white/10 rounded-lg p-4 space-y-2">
                  <h4 className="text-sm font-medium text-white">Reading Time</h4>
                  <div className="text-white/80 text-sm space-y-1">
                    <div>📝 {wordCount} words</div>
                    <div>⏱️ ~{minutes}m {seconds}s</div>
                    <div className="text-xs text-white/60">
                      Based on {settings.scrollSpeed}% speed
                    </div>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-white">Quick Presets</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => applyPreset('presentation')}
                      className="bg-black/50 text-white border-white/20 hover:bg-black/70 text-xs"
                    >
                      🎯 Presentation
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => applyPreset('recording')}
                      className="bg-black/50 text-white border-white/20 hover:bg-black/70 text-xs"
                    >
                      🎬 Recording
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => applyPreset('practice')}
                      className="bg-black/50 text-white border-white/20 hover:bg-black/70 text-xs"
                    >
                      🔄 Practice
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => applyPreset('interview')}
                      className="bg-black/50 text-white border-white/20 hover:bg-black/70 text-xs"
                    >
                      🎤 Interview
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-white mb-2 block">
                      Font Size: {settings.fontSize}px
                    </label>
                    <Slider
                      value={[settings.fontSize]}
                      onValueChange={([value]) => setSettings(prev => ({ ...prev, fontSize: value }))}
                      min={12}
                      max={72}
                      step={2}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-white/60 mt-1">
                      <span>12px</span>
                      <span>72px</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-white mb-2 block">
                      Scroll Speed: {settings.scrollSpeed}%
                    </label>
                    <Slider
                      value={[settings.scrollSpeed]}
                      onValueChange={([value]) => setSettings(prev => ({ ...prev, scrollSpeed: value }))}
                      min={5}
                      max={300}
                      step={5}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-white/60 mt-1">
                      <span>Very Slow</span>
                      <span>Very Fast</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-white mb-2 block">
                      Line Height: {settings.lineHeight}
                    </label>
                    <Slider
                      value={[settings.lineHeight]}
                      onValueChange={([value]) => setSettings(prev => ({ ...prev, lineHeight: value }))}
                      min={1.0}
                      max={3.0}
                      step={0.1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-white/60 mt-1">
                      <span>Tight</span>
                      <span>Loose</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-white mb-2 block">
                      Padding: {settings.padding}px
                    </label>
                    <Slider
                      value={[settings.padding]}
                      onValueChange={([value]) => setSettings(prev => ({ ...prev, padding: value }))}
                      min={10}
                      max={150}
                      step={10}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-white/60 mt-1">
                      <span>Narrow</span>
                      <span>Wide</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-white mb-2 block">
                        Background
                      </label>
                      <input
                        type="color"
                        value={settings.backgroundColor}
                        onChange={(e) => setSettings(prev => ({ ...prev, backgroundColor: e.target.value }))}
                        className="w-full h-10 rounded border border-white/20"
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-white mb-2 block">
                        Text Color
                      </label>
                      <input
                        type="color"
                        value={settings.textColor}
                        onChange={(e) => setSettings(prev => ({ ...prev, textColor: e.target.value }))}
                        className="w-full h-10 rounded border border-white/20"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSettings(defaultSettings)}
                    className="flex-1 bg-black/50 text-white border-white/20 hover:bg-black/70"
                  >
                    Reset
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowSettings(false)}
                    className="flex-1 bg-black/50 text-white border-white/20 hover:bg-black/70"
                  >
                    Close
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Keyboard shortcuts hint */}
      <div className={cn(
        "fixed bottom-4 left-4 text-xs text-white/60 pointer-events-none transition-opacity duration-300",
        showControls ? "opacity-100" : "opacity-0"
      )}>
        <div className="space-y-1">
          <div>Press SPACE to play/pause • ESC to return to editor</div>
          <div>Ctrl+↑/↓ font size • Ctrl+←/→ speed • Ctrl+R reset</div>
        </div>
      </div>

      {/* CSS for hiding scrollbar */}
      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  )
} 