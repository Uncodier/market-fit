"use client"

import { Eye } from "@/app/components/ui/icons"
import { useOptionalPermissions } from "@/app/context/PermissionContext"

export default function ViewOnlyBanner() {
  const permissions = useOptionalPermissions()
  if (!permissions?.isViewOnly) return null

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <div className="bg-amber-100 text-amber-800 text-xs font-medium px-3 py-1.5 rounded-full border border-amber-300 shadow-sm flex items-center gap-2">
        <Eye className="h-3.5 w-3.5 shrink-0" />
        View only — you cannot save or create on this site
      </div>
    </div>
  )
}
