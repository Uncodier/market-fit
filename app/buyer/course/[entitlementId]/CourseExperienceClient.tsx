"use client"

import { useState } from "react"
import { CoursePdpLayout } from "@/app/components/commerce/pdp/CoursePdpLayout"
import { BuyerExperienceShell } from "@/app/components/commerce/pdp/BuyerExperienceShell"
import { PdpExperience } from "@/app/components/commerce/pdp/pdp-experience"
import { saveCourseProgress } from "@/app/commerce/course-progress"

export function CourseExperienceClient({
  item,
  entitlement,
  backUrl,
}: {
  item: any
  entitlement: any
  backUrl: string
}) {
  const initial = entitlement.metadata?.course_progress || {
    lastIndex: 0,
    completedIndexes: [],
  }
  const [progress, setProgress] = useState(initial)

  const handleProgressUpdate = async (index: number, completed: boolean) => {
    const next = {
      lastIndex: index,
      completedIndexes: completed
        ? Array.from(new Set([...(progress.completedIndexes || []), index]))
        : progress.completedIndexes || [],
    }
    setProgress(next)
    await saveCourseProgress(entitlement.id, next)
  }

  const experience: PdpExperience = {
    kind: "entitlement",
    backUrl,
    entitlement,
    extras: {
      progress,
      onProgressUpdate: handleProgressUpdate,
    },
  }

  return (
    <BuyerExperienceShell backUrl={backUrl} variant="course">
      <CoursePdpLayout item={item} backUrl={backUrl} experience={experience} />
    </BuyerExperienceShell>
  )
}
