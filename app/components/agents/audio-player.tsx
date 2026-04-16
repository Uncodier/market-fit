"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Play, AlertCircle } from "@/app/components/ui/icons"

const BAR_COUNT = 70

interface AudioPlayerProps {
  src: string
  className?: string
}

function analyzeAudio(arrayBuffer: ArrayBuffer): Promise<number[]> {
  const ctx = new AudioContext()
  return ctx.decodeAudioData(arrayBuffer).then(buffer => {
    const raw = buffer.getChannelData(0)
    const blockSize = Math.floor(raw.length / BAR_COUNT)
    const peaks: number[] = []
    for (let i = 0; i < BAR_COUNT; i++) {
      let sum = 0
      const start = i * blockSize
      for (let j = start; j < start + blockSize; j++) {
        sum += Math.abs(raw[j])
      }
      peaks.push(sum / blockSize)
    }
    const max = Math.max(...peaks, 0.001)
    ctx.close()
    return peaks.map(p => {
      const normalized = p / max
      return Math.max(0.06, Math.pow(normalized, 0.6))
    })
  })
}

export function AudioPlayer({ src, className = "" }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [waveform, setWaveform] = useState<number[]>([])
  const blobUrlRef = useRef<string | null>(null)
  const waveContainerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)

  const loadAudio = useCallback(async () => {
    if (!src) return
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(src)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const arrayBuffer = await res.arrayBuffer()

      try {
        const peaks = await analyzeAudio(arrayBuffer.slice(0))
        setWaveform(peaks)
      } catch {
        setWaveform(Array.from({ length: BAR_COUNT }, () => 0.15 + Math.random() * 0.7))
      }

      const blob = new Blob([arrayBuffer], { type: 'audio/wav' })
      const url = URL.createObjectURL(blob)
      blobUrlRef.current = url
      setBlobUrl(url)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [src])

  useEffect(() => {
    loadAudio()
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    }
  }, [loadAudio])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onLoadedMetadata = () => setDuration(audio.duration)
    const onEnded = () => { setPlaying(false); cancelAnimationFrame(rafRef.current) }
    const onPlay = () => {
      setPlaying(true)
      const tick = () => {
        if (audioRef.current) setCurrentTime(audioRef.current.currentTime)
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    const onPause = () => { setPlaying(false); cancelAnimationFrame(rafRef.current) }
    const onError = () => setError(true)

    audio.addEventListener("loadedmetadata", onLoadedMetadata)
    audio.addEventListener("ended", onEnded)
    audio.addEventListener("play", onPlay)
    audio.addEventListener("pause", onPause)
    audio.addEventListener("error", onError)

    return () => {
      cancelAnimationFrame(rafRef.current)
      audio.removeEventListener("loadedmetadata", onLoadedMetadata)
      audio.removeEventListener("ended", onEnded)
      audio.removeEventListener("play", onPlay)
      audio.removeEventListener("pause", onPause)
      audio.removeEventListener("error", onError)
    }
  }, [blobUrl])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    playing ? audio.pause() : audio.play()
  }

  const handleWaveClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    const container = waveContainerRef.current
    if (!audio || !container || !duration) return
    const rect = container.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    audio.currentTime = ratio * duration
    setCurrentTime(audio.currentTime)
  }

  const progress = duration > 0 ? currentTime / duration : 0

  const fmt = (s: number) => {
    if (!s || !isFinite(s)) return "0:00"
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, "0")}`
  }

  if (error) {
    return (
      <div className={`flex items-center gap-2 p-3 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs ${className}`}>
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>Failed to load audio</span>
        <button onClick={loadAudio} className="ml-auto underline text-xs hover:text-destructive/80">Retry</button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/10 ${className}`}>
        <div className="w-10 h-10 rounded-full bg-primary/10 shrink-0 animate-pulse" />
        <div className="flex-1 flex items-center gap-[1px] h-10">
          {Array.from({ length: BAR_COUNT }).map((_, i) => (
            <div
              key={i}
              className="flex-1 rounded-[1px] bg-primary/10 animate-pulse"
              style={{
                height: `${20 + Math.sin(i * 0.5) * 18 + Math.random() * 12}%`,
                animationDelay: `${i * 25}ms`
              }}
            />
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">--:--</span>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/10 ${className}`}>
      {blobUrl && <audio ref={audioRef} src={blobUrl} preload="metadata" />}

      <button
        onClick={togglePlay}
        className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 hover:bg-primary/90 active:scale-95 transition-all shadow-md shadow-primary/20"
      >
        {playing ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="3" y="2" width="3.5" height="12" rx="1.2" />
            <rect x="9.5" y="2" width="3.5" height="12" rx="1.2" />
          </svg>
        ) : (
          <Play className="w-[18px] h-[18px] ml-0.5" />
        )}
      </button>

      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <div
          ref={waveContainerRef}
          onClick={handleWaveClick}
          className="flex items-center gap-[1px] h-10 cursor-pointer group relative"
        >
          {waveform.map((peak, i) => {
            const barProgress = i / waveform.length
            const isPlayed = barProgress <= progress
            const h = Math.round(peak * 100)
            return (
              <div
                key={i}
                className="flex-1 flex flex-col items-center justify-center h-full"
              >
                <div
                  className={`w-full rounded-[1px] transition-colors duration-100 ${
                    isPlayed
                      ? "bg-primary shadow-[0_0_3px_rgba(var(--primary-rgb,59,130,246),0.3)]"
                      : "bg-muted-foreground/15 group-hover:bg-muted-foreground/25"
                  }`}
                  style={{ height: `${h}%`, minHeight: '2px' }}
                />
              </div>
            )
          })}
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground px-0.5 tabular-nums">
          <span>{fmt(currentTime)}</span>
          <span>{fmt(duration)}</span>
        </div>
      </div>
    </div>
  )
}
