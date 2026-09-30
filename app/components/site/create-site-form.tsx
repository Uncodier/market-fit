"use client"

import { Form } from "../ui/form"

import type { Site } from "@/app/context/SiteContext"
import { useCreateSiteForm } from "./use-create-site-form"
import { SiteFocusModeCard } from "./SiteFocusModeCard"
import { SiteInformationCard } from "./SiteInformationCard"
import { SiteCompetitorsCard } from "./SiteCompetitorsCard"
import { SiteResourcesCard } from "./SiteResourcesCard"
import { SiteLocationsCard } from "./SiteLocationsCard"
interface CreateSiteFormProps {
  onSubmit: (data: Omit<Site, 'id' | 'created_at' | 'updated_at'>) => void
  isSaving?: boolean
}

export function CreateSiteForm(props: CreateSiteFormProps) {
 const model = useCreateSiteForm(props)
 const { onSubmit, form, handleSubmit } = model
  return (
    <Form {...form}>
      <form id="create-site-form" onSubmit={form.handleSubmit(handleSubmit)} className="space-y-12">
        <div className="space-y-12">
          <SiteFocusModeCard {...model} />

          <SiteInformationCard {...model} />

          <SiteCompetitorsCard {...model} />

          <SiteResourcesCard {...model} />

          <SiteLocationsCard {...model} />
        </div>
      </form>
    </Form>
  )
} 