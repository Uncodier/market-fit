import { toast } from "sonner"
import { type SiteFormValues } from "./form-schema"
import { validateActivitiesForSave } from "./outreach-save-validation"
import { mergeActivitySettings, validatedActivityUpdates } from "./activity-settings"

import { type SaveOptions, shouldPreventRefresh } from "./save-settings-shared"

// Partial save handler for Activities section
export const handleSaveActivities = async (data: SiteFormValues, options: SaveOptions) => {
  const { currentSite, updateSettings, refreshSites, setIsSaving } = options

  if (!currentSite) return false

  try {
    setIsSaving(true)

    // Activity-only saves must validate against persisted channels, not unsaved connection edits.
    const activitiesData = await validateActivitiesForSave(mergeActivitySettings(currentSite.settings?.activities, data.activities), currentSite.settings?.channels, currentSite.id, currentSite.settings?.business_hours)

    const settingsUpdate: any = {
      site_id: currentSite.id,
      activities: validatedActivityUpdates(activitiesData, data.activities)
    }

    // Preserve existing settings ID if it exists
    if (currentSite.settings?.id) {
      settingsUpdate.id = currentSite.settings.id
    }

    await updateSettings(currentSite.id, settingsUpdate)

    // The settings writer publishes the latest-row merge. Never replace it with
    // the pre-hydration context or the partial request in an optimistic site update.
    if (!shouldPreventRefresh()) {
      await refreshSites()
    }

    toast.success("Activities saved successfully")
    return true
  } catch (error) {
    console.error("Error saving activities:", error)
    if (error instanceof Error) {
      toast.error(`Error: ${error.message}`)
    } else {
      toast.error("Error saving activities")
    }
    throw error
  } finally {
    setIsSaving(false)
  }
}

