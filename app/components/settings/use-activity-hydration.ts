"use client"

import { useEffect, useRef } from "react"
import isEqual from "lodash/isEqual"
import type { UseFormReturn } from "react-hook-form"
import type { SiteFormValues } from "./form-schema"
import { normalizeActivitySettings } from "./activity-settings"
import { hydrateActivityForm } from "./activity-form-state"

/** Settings arrive after optimistic site selection. Hydrate them without overwriting local edits. */
export function useActivityHydration(form: UseFormReturn<SiteFormValues>, activities: unknown, siteId?: string) {
  const previous = useRef<{ siteId?: string; incoming: unknown } | null>(null)
  useEffect(() => {
    const incoming = normalizeActivitySettings(activities)
    const sameSite = !previous.current || previous.current.siteId === siteId
    if (sameSite && isEqual(previous.current?.incoming, incoming)) return
    previous.current = { siteId, incoming }
    hydrateActivityForm(form, incoming, sameSite)
  }, [form, activities, siteId])
}