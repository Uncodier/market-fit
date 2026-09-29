import { toast } from "sonner"
import { type SiteFormValues } from "./form-schema"
import { type Site } from "../../context/SiteContext"
import { createClient } from "@/lib/supabase/client"
import { copywritingService } from "../../context/copywriting-actions"

import { type SaveOptions } from "./save-settings-shared"

// Partial save handler for Copywriting section - saves only to copywriting table
export const handleSaveCopywriting = async (data: SiteFormValues, options: SaveOptions) => {
  const { currentSite, setIsSaving } = options

  if (!currentSite) return

  try {
    setIsSaving(true)

    const { copywriting } = data

    console.log("COPYWRITING SAVE: Starting copywriting-only save")
    console.log("COPYWRITING SAVE: Copywriting data:", JSON.stringify(copywriting, null, 2))
    console.log("COPYWRITING SAVE: Copywriting is array?", Array.isArray(copywriting))
    console.log("COPYWRITING SAVE: Copywriting length:", copywriting?.length || 0)

    if (!copywriting || !Array.isArray(copywriting)) {
      console.log("COPYWRITING SAVE: No copywriting data to save")
      toast.success("Copywriting saved successfully")
      return
    }

    const supabase = createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError) {
      console.error("COPYWRITING SAVE: Error getting user:", userError)
      toast.error("Failed to authenticate user for copywriting save")
      return
    }

    if (!user) {
      console.error("COPYWRITING SAVE: No user found")
      toast.error("Please log in to save copywriting data")
      return
    }

    console.log("COPYWRITING SAVE: User found:", user.id)
    console.log("COPYWRITING SAVE: Site ID:", currentSite.id)
    console.log("COPYWRITING SAVE: Copywriting items to sync:", copywriting.length)

    const result = await copywritingService.syncCopywritingItems(
      currentSite.id,
      user.id,
      copywriting
    )

    console.log("COPYWRITING SAVE: Sync result:", result)

    if (result.success) {
      console.log("COPYWRITING SAVE: Copywriting data synced successfully")
      toast.success("Copywriting saved successfully")
    } else {
      console.error("COPYWRITING SAVE: Failed to sync copywriting data:", result.error)
      toast.error(`Failed to save copywriting data: ${result.error}`)
    }
  } catch (error) {
    console.error("COPYWRITING SAVE: Exception during save:", error)
    if (error instanceof Error) {
      console.error("COPYWRITING SAVE: Error stack:", error.stack)
      toast.error(`Failed to save copywriting data: ${error.message}`)
    } else {
      toast.error("Failed to save copywriting data")
    }
  } finally {
    setIsSaving(false)
  }
} 