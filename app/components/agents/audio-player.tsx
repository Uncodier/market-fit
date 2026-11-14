"use client"
import React, { useState, useRef, useEffect } from "react"
import { Play, Pause } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"

export function AudioPlayer({ src, className = "" }: { src: string; className?: string }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const updateProgress = () => setProgress(Number.isFinite(audio.duration) && audio.duration > 0
      ? Math.max(0, Math.min(100, (audio.currentTime / audio.duration) * 100)) : 0)
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleEnded = () => {
      setIsPlaying(false)
      setProgress(0)
    }
    audio.addEventListener("timeupdate", updateProgress)
    audio.addEventListener("ended", handleEnded)
    audio.addEventListener("play", handlePlay)
    audio.addEventListener("pause", handlePause)
    audio.addEventListener("error", handleEnded)
    return () => {
      audio.removeEventListener("timeupdate", updateProgress)
      audio.removeEventListener("ended", handleEnded)
      audio.removeEventListener("play", handlePlay)
      audio.removeEventListener("pause", handlePause)
      audio.removeEventListener("error", handleEnded)
    }
  }, [])

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause()
      else void audioRef.current.play().catch(() => setIsPlaying(false))
    }
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Button
        variant="secondary"
        size="icon"
        className="h-8 w-8 rounded-full bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary border-0"
        onClick={togglePlay}
        aria-label={isPlaying ? "Pause audio" : "Play audio"}
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden relative cursor-pointer"
        onClick={(e) => {
          if (audioRef.current && Number.isFinite(audioRef.current.duration) && audioRef.current.duration > 0) {
            const rect = e.currentTarget.getBoundingClientRect()
            if (rect.width <= 0) return
            const x = e.clientX - rect.left
            const ratio = Math.max(0, Math.min(1, x / rect.width))
            audioRef.current.currentTime = ratio * audioRef.current.duration
            setProgress(ratio * 100)
          }
        }}
      >
        <div
          className="absolute top-0 left-0 h-full bg-primary transition-all duration-75"
          style={{ width: `${progress || 0}%` }}
        />
      </div>
      <audio ref={audioRef} src={src} preload="metadata" />
    </div>
  )
}
