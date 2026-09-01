"use client"

import { useForm, FormProvider } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMemo, useEffect, useState } from "react"
import { useSite } from "@/app/context/SiteContext"
import { AgentEmailSection } from "@/app/components/settings/AgentEmailSection"
import { WhatsAppSection } from "@/app/components/settings/WhatsAppSection"
import { SmtpEmailSection } from "@/app/components/settings/SmtpEmailSection"
import { siteFormSchema, type SiteFormValues } from "@/app/components/settings/form-schema"
import { adaptSiteToForm } from "@/app/components/settings/data-adapter"
import { handleSaveChannels } from "@/app/components/settings/save-handlers"

export function ChannelsSection() {
  const { currentSite, updateSite, updateSettings, refreshSites } = useSite()
  const [isSaving, setIsSaving] = useState(false)

  // Adapt site data to form values
  const adaptedSiteData = useMemo(() => {
    if (!currentSite) return null
    return adaptSiteToForm(currentSite)
  }, [currentSite])

  const form = useForm<SiteFormValues>({
    resolver: zodResolver(siteFormSchema),
    defaultValues: adaptedSiteData || {}
  })

  // Update form when adapted data changes
  useEffect(() => {
    if (adaptedSiteData) {
      form.reset(adaptedSiteData)
    }
  }, [adaptedSiteData, form])

  const onSaveChannels = async (data: SiteFormValues) => {
    if (!currentSite) return
    setIsSaving(true)
    try {
      await handleSaveChannels(data, {
        currentSite,
        updateSite,
        updateSettings,
        refreshSites,
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (!currentSite) {
    return null
  }

  return (
    <FormProvider {...form}>
      <div className="space-y-6">
        <AgentEmailSection
          active={true}
          siteId={currentSite.id}
          onSave={onSaveChannels}
        />
        <SmtpEmailSection
          active={true}
          siteId={currentSite.id}
          onSave={onSaveChannels}
        />
        <WhatsAppSection
          active={true}
          siteId={currentSite.id}
          form={form}
          onSave={onSaveChannels}
        />
      </div>
    </FormProvider>
  )
}