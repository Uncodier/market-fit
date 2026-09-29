"use client"

import { useEffect, useRef } from "react"
import type { UseFormReturn } from "react-hook-form"
import type { SiteFormValues } from "./form-schema"
import { normalizeActivitySettings } from "./activity-settings"

/** Settings arrive after optimistic site selection. Hydrate them without overwriting local edits. */
export function useActivityHydration(form: UseFormReturn<SiteFormValues>, activities: unknown, siteId?: string) {
  const incoming = JSON.stringify(normalizeActivitySettings(activities))
  const previous = useRef({ siteId, incoming })
  useEffect(() => {
    if (previous.current.siteId === siteId && previous.current.incoming !== incoming) {
      const current = JSON.stringify(normalizeActivitySettings(form.getValues("activities")))
      if (current === previous.current.incoming) {
        form.setValue("activities", JSON.parse(incoming), { shouldDirty: false })
      }
    }
    previous.current = { siteId, incoming }
  }, [form, incoming, siteId])
}