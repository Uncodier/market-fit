import { notFound } from "next/navigation"
import { BuyerLibraryExperience } from "@/app/buyer/components/BuyerLibraryExperience"
import { CourseExperienceClient } from "@/app/buyer/course/[entitlementId]/CourseExperienceClient"
import { getDemoLibraryData, demoLibrarySlots } from "./demo-library-data"

/** Route adapter for /home/preview/library/[id]; only exact local library IDs are supported. */
export function DemoLibraryDetail({ id }: { id: string }) {
  const data = getDemoLibraryData(id)
  if (!data) return notFound()
  const backUrl = `/home/library?subtype=${data.subtype}`
  if (data.subtype === "course") {
    return <CourseExperienceClient item={data.item} entitlement={data.entitlement} backUrl={backUrl} demo />
  }
  return <BuyerLibraryExperience item={data.item} subtype={data.subtype} experience={{
    kind: "entitlement", demo: true, backUrl, entitlement: data.entitlement,
    extras: { ...data.extras, ...(data.subtype === "pass" ? { previewSlots: demoLibrarySlots() } : {}) },
  }} />
}