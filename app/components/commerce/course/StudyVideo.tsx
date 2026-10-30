'use client'

import { useRef, useState } from 'react'
import { Button } from '@/app/components/ui/button'
import { Label } from '@/app/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select'
import { resolveCourseMedia, type CourseVideo } from './course-model'

export function StudyVideo({ video, position, onPosition, onComplete }: {
  video: CourseVideo
  position: number
  onPosition: (position: number) => void
  onComplete: () => void
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState(false)
  const [buffering, setBuffering] = useState(false)
  const [speed, setSpeed] = useState('1')
  const lastPosition = useRef(position)
  const media = resolveCourseMedia(video.url)

  if (!media) return <div role="alert" className="flex aspect-video items-center justify-center rounded-2xl border bg-muted p-8 text-center">This lesson does not have a supported video URL.</div>

  return <div className="overflow-hidden rounded-2xl border bg-card">
    <div className="relative aspect-video bg-black">
      {media.kind === 'embed' ? <iframe
        src={media.url} title={video.title || 'Course lesson'} className="absolute inset-0 h-full w-full"
        allow="fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"
      /> : <video
        ref={ref} src={media.url} controls playsInline preload="metadata"
        aria-label={video.title || 'Course lesson'} className="h-full w-full object-contain"
        onLoadedMetadata={event => {
          const element = event.currentTarget
          if (Number.isFinite(element.duration) && position < element.duration - 1) element.currentTime = position
          element.playbackRate = Number(speed)
        }}
        onTimeUpdate={event => {
          const time = event.currentTarget.currentTime
          if (Math.abs(time - lastPosition.current) >= 2) { lastPosition.current = time; onPosition(time) }
        }}
        onPause={event => onPosition(event.currentTarget.currentTime)}
        onEnded={event => { onPosition(event.currentTarget.currentTime); onComplete() }}
        onWaiting={() => setBuffering(true)} onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)} onError={() => { setError(true); setBuffering(false) }}
      >Your browser does not support video playback.</video>}
      {buffering && !error && <div role="status" className="pointer-events-none absolute inset-x-0 top-4 text-center text-sm text-white">Buffering video…</div>}
      {error && <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/95 p-6 text-center">
        <p>We couldn’t load this video. Check your connection and try again.</p>
        <Button variant="outline" onClick={() => { setError(false); ref.current?.load() }}>Retry video</Button>
      </div>}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <p className="text-xs text-muted-foreground">{media.kind === 'video' ? 'Sample footage · Use the controls for volume, seeking, and fullscreen.' : 'Use the embedded player controls. Mark this lesson complete when you finish.'}</p>
      {media.kind === 'video' && <div className="flex items-center gap-2">
        <Label htmlFor="course-speed" className="text-xs text-muted-foreground">Speed</Label>
        <Select value={speed} onValueChange={value => { setSpeed(value); if (ref.current) ref.current.playbackRate = Number(value) }}>
          <SelectTrigger id="course-speed" className="h-8 w-24"><SelectValue /></SelectTrigger>
          <SelectContent>{['0.75', '1', '1.25', '1.5', '2'].map(value => <SelectItem key={value} value={value}>{value}×</SelectItem>)}</SelectContent>
        </Select>
      </div>}
    </div>
  </div>
}