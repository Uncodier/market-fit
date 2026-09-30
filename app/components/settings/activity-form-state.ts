import cloneDeep from "lodash/cloneDeep"
import isEqual from "lodash/isEqual"
import type { FieldPath, UseFormReturn } from "react-hook-form"
import type { SiteFormValues } from "./form-schema"

type ActivityValues = Record<string, unknown>
const record = (value: unknown): ActivityValues => value && typeof value === "object" && !Array.isArray(value) ? value as ActivityValues : {}

/** Activity parameters (including selection arrays/maps) are the form's editable fields. */
function fields(activities: unknown) {
  return Object.entries(record(activities)).flatMap(([key, activity]) =>
    Object.entries(record(activity)).map(([parameter, value]) => ({
      key, parameter, value, path: `activities.${key}.${parameter}` as FieldPath<SiteFormValues>,
    })),
  )
}

export function getActivityFormUpdates(form: UseFormReturn<SiteFormValues>) {
  const defaults = record(form.formState.defaultValues?.activities)
  const updates: Record<string, ActivityValues> = {}
  for (const { key, parameter, value } of fields(form.getValues("activities"))) {
    if (!isEqual(value, record(defaults[key])[parameter])) {
      (updates[key] ??= {})[parameter] = cloneDeep(value)
    }
  }
  return updates
}

/** Rebase just activities, never the rest of the form or its unsaved state. */
export function hydrateActivityForm(form: UseFormReturn<SiteFormValues>, activities: SiteFormValues["activities"], preserveEdits: boolean) {
  const edits = preserveEdits ? getActivityFormUpdates(form) : {}
  // resetField also needs to work while the Activities tab is unmounted.
  form.register("activities")
  form.resetField("activities", { defaultValue: activities, keepTouched: preserveEdits, keepError: preserveEdits })
  // Controllers subscribe to their exact field names; a registered parent reset
  // alone does not notify those subscriptions in React Hook Form.
  for (const { path, value } of fields(activities)) form.setValue(path, value as never)
  for (const { path, value } of fields(edits)) form.setValue(path, value as never, { shouldDirty: true })
}

/** Acknowledge only submitted fields; edits made during the request remain dirty. */
export function acknowledgeActivitySave(form: UseFormReturn<SiteFormValues>, submitted: unknown) {
  for (const { path, value } of fields(submitted)) {
    const current = cloneDeep(form.getValues(path))
    form.register(path)
    form.resetField(path, { defaultValue: value as never, keepTouched: true, keepError: true })
    if (!isEqual(current, value)) form.setValue(path, current, { shouldDirty: true })
  }
}