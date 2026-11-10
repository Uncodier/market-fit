"use client"

import { useEffect, useRef, useState } from 'react'
import { Loader, Pause, Play } from '@/app/components/ui/icons'
import { useLocalization } from '@/app/context/LocalizationContext'

function time(value: number): string {
  const seconds = Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export function ChatAudioPlayer({ url, name }: { url: string; name: string }) {
  const { t } = useLocalization()
  const audioRef = useRef<HTMLAudioElement>(null)
  const desiredPlayback = useRef(false)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState(1)
  useEffect(() => () => { desiredPlayback.current = false }, [])
  const readDuration = () => {
    const value = audioRef.current?.duration
    setDuration(value && Number.isFinite(value) && value > 0 ? value : 0)
  }
  const toggle = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (desiredPlayback.current || !audio.paused) {
      desiredPlayback.current = false
      audio.pause()
      setPlaying(false)
      setLoading(false)
      return
    }
    desiredPlayback.current = true
    setLoading(true)
    setFailed(false)
    try {
      await audio.play()
      if (!desiredPlayback.current) audio.pause()
    } catch {
      if (desiredPlayback.current) setFailed(true)
      desiredPlayback.current = false
      setPlaying(false)
      setLoading(false)
    }
  }
  const retry = () => {
    desiredPlayback.current = false
    audioRef.current?.pause()
    audioRef.current?.load()
    setFailed(false)
    setPlaying(false)
    setLoading(false)
    setElapsed(0)
    setDuration(0)
  }
  return (
    <div role="group" aria-label={`${t('chat.attachment.audio')}: ${name}`} className="w-full max-w-md rounded-2xl border border-border/60 bg-muted/30 p-3">
      <audio ref={audioRef} src={url} preload="none" aria-label={name}
        onLoadedMetadata={readDuration} onDurationChange={readDuration}
        onTimeUpdate={() => setElapsed(audioRef.current?.currentTime || 0)}
        onPlay={() => { desiredPlayback.current = true; setPlaying(true); setLoading(false) }}
        onPlaying={() => { setLoading(false); setPlaying(true) }}
        onPause={() => { setPlaying(false); setLoading(false) }}
        onWaiting={() => setLoading(true)}
        onEnded={() => { desiredPlayback.current = false; setPlaying(false); setLoading(false) }}
        onError={() => { desiredPlayback.current = false; setFailed(true); setLoading(false); setPlaying(false) }}
        className="hidden" />
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => void toggle()} disabled={failed}
          aria-label={t(playing || loading ? 'chat.audio.pause' : 'chat.audio.play')}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50">
          {loading ? <Loader className="h-4 w-4 animate-spin" aria-hidden={true} />
            : playing ? <Pause className="h-4 w-4" aria-hidden={true} /> : <Play className="h-4 w-4" aria-hidden={true} />}
        </button>
        <div className="min-w-0 flex-1">
          <a href={url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"
            className="mb-1 block truncate text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" title={name}>
            {name}
          </a>
          <input type="range" min={0} max={duration || 1} step={0.1} value={Math.min(elapsed, duration || 0)}
            disabled={!duration || failed} aria-label={t('chat.audio.seek')}
            aria-valuetext={`${time(elapsed)} / ${duration ? time(duration) : '—:—'}`}
            onChange={event => {
              const value = Number(event.target.value)
              if (audioRef.current && duration) { audioRef.current.currentTime = value; setElapsed(value) }
            }} className="block h-1.5 w-full cursor-pointer accent-primary disabled:cursor-default" />
          <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-muted-foreground">
            <span aria-label={t('chat.audio.elapsed')}>{time(elapsed)}</span>
            <span aria-label={t('chat.audio.duration')}>{duration ? time(duration) : '—:—'}</span>
          </div>
        </div>
        <button type="button" aria-label={`${t('chat.audio.speed')}: ${speed}×`}
          onClick={() => {
            const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1
            if (audioRef.current) audioRef.current.playbackRate = next
            setSpeed(next)
          }} className="rounded-full px-2 py-1 text-xs font-medium tabular-nums text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {speed}×
        </button>
      </div>
      {loading && <span role="status" className="sr-only">{t('chat.audio.loading')}</span>}
      {failed && <div role="status" className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{t('chat.audio.error')}</span>
        <button type="button" onClick={retry} className="shrink-0 rounded px-1 py-0.5 font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {t('chat.audio.retry')}
        </button>
      </div>}
    </div>
  )
}