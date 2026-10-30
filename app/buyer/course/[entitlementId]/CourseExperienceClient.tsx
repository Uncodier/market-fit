"use client"

import { CoursePdpLayout } from "@/app/components/commerce/pdp/CoursePdpLayout"
import { BuyerExperienceShell } from "@/app/components/commerce/pdp/BuyerExperienceShell"
import { PdpExperience } from "@/app/components/commerce/pdp/pdp-experience"
import { Button } from "@/app/components/ui/button"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useCourseProgress } from "./use-course-progress"
import type { CatalogItem } from "@/app/types"

type CourseExperienceProps = {
  item: CatalogItem
  entitlement: { id: string; metadata?: { course_progress?: unknown } | null }
  backUrl: string
  demo?: boolean
}

export function CourseExperienceClient({
  item,
  entitlement,
  backUrl,
  demo = false,
}: CourseExperienceProps) {
  // Match the layout's filtered lesson indexes, not raw metadata indexes.
  const videos = item.metadata?.videos
  const count = Array.isArray(videos) ? videos.filter(video => video && typeof video.url === 'string' && video.url.trim()).length : 0
  return <CourseProgressExperience key={JSON.stringify([entitlement.id, item.id, count, demo])}
    item={item} entitlement={entitlement} backUrl={backUrl} demo={demo} count={count} />
}

function CourseProgressExperience({ item, entitlement, backUrl, demo = false, count }: CourseExperienceProps & { count: number }) {
  const { t } = useLocalization()
  const copy = (key: string, fallback: string) => {
    const translated = t(key)
    return translated && translated !== key ? translated : fallback
  }
  const { progress, onProgressUpdate, saving, error, retry } = useCourseProgress(
    entitlement.id, entitlement.metadata?.course_progress, count, demo,
  )

  const experience: PdpExperience = {
    kind: "entitlement",
    demo,
    backUrl,
    entitlement,
    extras: {
      progress,
      onProgressUpdate,
    },
  }

  return (
    <BuyerExperienceShell backUrl={backUrl} variant="course">
      {!demo && (saving || error) && (
        <div className="max-w-7xl mx-auto w-full px-4 md:px-8 pb-4">
          {saving ? (
            <p role="status" className="text-sm text-muted-foreground">{copy("common.saving", "Saving...")}</p>
          ) : (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
              <p role="alert" className="text-sm text-destructive">{copy("pdp.course.progressSaveError", "Progress could not be saved. Your changes are still here. Please retry.")}</p>
              <Button type="button" variant="outline" size="sm" onClick={retry}>{copy("common.retry", "Retry")}</Button>
            </div>
          )}
        </div>
      )}
      <CoursePdpLayout item={item} backUrl={backUrl} experience={experience} />
    </BuyerExperienceShell>
  )
}
