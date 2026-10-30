"use client"

import { CheckCircle, PlayCircle } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"

export function CourseCurriculum({ videos, currentIndex, completed, onSelect }: {
  videos: { url: string; title?: string }[]
  currentIndex: number
  completed: number[]
  onSelect: (index: number) => void
}) {
  const { t } = useLocalization()
  const copy = (key: string, fallback: string) => { const value = t(key); return value && value !== key ? value : fallback }
  const percentage = Math.round(completed.length / videos.length * 100)
  return <aside aria-label={copy("pdp.course.content", "Course Content")} className="flex min-w-0 flex-col border-t border-border/50 lg:border-l lg:border-t-0">
    <div className="space-y-4 border-b border-border/50 p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{copy("pdp.course.content", "Course Content")}</h3>
        <span className="text-sm font-semibold tabular-nums">{percentage}%</span>
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {t("pdp.course.progress", { completed: completed.length, total: videos.length })}
      </p>
      <div role="progressbar" aria-label={copy("pdp.course.progressLabel", "Course progress")}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage} className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${percentage}%` }} />
      </div>
    </div>
    <nav aria-label={copy("pdp.course.lessons", "Lessons")} className="max-h-[420px] overflow-y-auto p-2 lg:max-h-[560px]">
      <ol className="space-y-1">
        {videos.map((video, index) => <li key={index}>
          <button type="button" onClick={() => onSelect(index)} aria-current={currentIndex === index ? "step" : undefined}
            className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${currentIndex === index ? "border-primary/20 bg-primary/5" : "border-transparent hover:bg-muted/50"}`}>
            <span className="mt-0.5 shrink-0 text-muted-foreground">
              {completed.includes(index) ? <CheckCircle size={18} className="text-primary" /> : <PlayCircle size={18} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block text-sm font-medium ${currentIndex === index ? "text-foreground" : "text-muted-foreground"}`}>
                {index + 1}. {video.title || t("pdp.course.lesson", { number: index + 1 })}
              </span>
              {completed.includes(index) && <span className="mt-1 block text-xs text-muted-foreground">{copy("pdp.course.completed", "Completed")}</span>}
            </span>
          </button>
        </li>)}
      </ol>
    </nav>
  </aside>
}