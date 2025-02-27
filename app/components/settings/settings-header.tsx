"use client"

import { Button } from "../ui/button"
import { SaveIcon } from "@/app/components/ui/icons"

interface SettingsHeaderProps {
  onSave: () => void
  isSaving?: boolean
}

export function SettingsHeader({
  onSave,
  isSaving
}: SettingsHeaderProps) {
  return (
    <div className="flex items-center justify-end border-b border-gray-200 px-6 py-4 sticky top-0 bg-white z-10">
      <Button 
        onClick={onSave}
        disabled={isSaving}
      >
        <SaveIcon className="h-4 w-4 mr-2" />
        {isSaving ? "Guardando..." : "Guardar cambios"}
      </Button>
    </div>
  )
} 