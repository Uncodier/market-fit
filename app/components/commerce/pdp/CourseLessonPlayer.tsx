"use client"

import { useRef, useState } from "react"
import { CheckCircle, ChevronLeft, ChevronRight, Maximize } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { useLocalization } from "@/app/context/LocalizationContext"
import { resolveCourseMedia } from "@/app/components/commerce/course/course-model"
import { CourseCurriculum } from "./CourseCurriculum"

export function CourseLessonPlayer({ videos, title, progress, onProgressUpdate }: {
  videos: { url: string; title?: string }[]
  title: string
  progress?: { lastIndex: number; completedIndexes: number[] }
  onProgressUpdate?: (index: number, completed: boolean) => void
}) {
  const { t } = useLocalization()
  const initialIndex = progress?.lastIndex ?? 0
  const [selectedIndex, setCurrentIndex] = useState(Number.isInteger(initialIndex) && initialIndex >= 0 && initialIndex < videos.length ? initialIndex : 0)
  const [wide, setWide] = useState(false)
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const currentIndex = Math.min(selectedIndex, Math.max(0, videos.length - 1))
  const completed = [...new Set(progress?.completedIndexes || [])].filter(index => Number.isInteger(index) && index >= 0 && index < videos.length)
  const copy = (key: string, fallback: string) => { const value = t(key); return value && value !== key ? value : fallback }
  if (!videos.length) return null
  const currentVideo = videos[currentIndex]
  const media = resolveCourseMedia(currentVideo.url)
  const lessonTitle = currentVideo.title || t("pdp.course.lessonTitle", { title, number: currentIndex + 1 })
  const select = (index: number) => {
    if (index < 0 || index >= videos.length) return
    videoRef.current?.pause()
    setCurrentIndex(index)
    setFailedUrl(null)
    onProgressUpdate?.(index, completed.includes(index))
  }
  return <section aria-label={copy("pdp.course.player", "Course player")}
    className={`overflow-hidden rounded-3xl border border-border/50 bg-card shadow-sm ${wide ? "" : "lg:grid lg:grid-cols-[minmax(0,1fr)_320px]"}`}>
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-5 py-3">
        <span className="text-xs font-medium text-muted-foreground">{t("pdp.course.lesson", { number: currentIndex + 1 })} · {currentIndex + 1} / {videos.length}</span>
        <Button variant="ghost" size="sm" className="hidden lg:inline-flex" onClick={() => setWide(value => !value)} aria-pressed={wide}>
          <Maximize className="mr-2 h-4 w-4" />{copy("pdp.course.focusMode", "Focus mode")}
        </Button>
      </div>
      <div className="aspect-video max-h-[70vh] bg-black relative">
        {!media || failedUrl === currentVideo.url ? <div role="alert" className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white">
          {copy("pdp.course.videoUnavailable", "This lesson video is unavailable. You can still navigate the course content.")}
        </div> : media.kind === "embed" ? <iframe key={`${currentIndex}:${media.url}`} src={media.url} title={lessonTitle}
          className="absolute inset-0 h-full w-full" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" /> : <video
          ref={videoRef} key={`${currentIndex}:${media.url}`} src={media.url} controls playsInline preload="metadata"
          aria-label={lessonTitle} className="absolute inset-0 h-full w-full object-contain"
          onError={() => setFailedUrl(currentVideo.url)} />}
      </div>
      <div className="space-y-5 p-5 sm:p-6">
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl" tabIndex={-1}>{lessonTitle}</h2>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant={completed.includes(currentIndex) ? "secondary" : "outline"} size="sm"
            disabled={!onProgressUpdate} aria-pressed={completed.includes(currentIndex)}
            onClick={() => onProgressUpdate?.(currentIndex, !completed.includes(currentIndex))}>
            <CheckCircle size={16} className="mr-2" />
            {copy(completed.includes(currentIndex) ? "pdp.course.completed" : "pdp.course.markComplete", completed.includes(currentIndex) ? "Completed" : "Mark as complete")}
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" disabled={currentIndex === 0} onClick={() => select(currentIndex - 1)}>
              <ChevronLeft className="mr-1 h-4 w-4" />{copy("pdp.course.previousLesson", "Previous")}
            </Button>
            <Button variant="outline" size="sm" disabled={currentIndex === videos.length - 1} onClick={() => select(currentIndex + 1)}>
              {copy("pdp.course.nextLesson", "Next lesson")}<ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
        {completed.length === videos.length && <p role="status" className="text-sm font-medium text-primary">{copy("pdp.course.allComplete", "All lessons completed. You can revisit any lesson at any time.")}</p>}
      </div>
    </div>
    <div className={wide ? "lg:hidden" : "contents"}>
      <CourseCurriculum videos={videos} currentIndex={currentIndex} completed={completed} onSelect={select} />
    </div>
  </section>
}
