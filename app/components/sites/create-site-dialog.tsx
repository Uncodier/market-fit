"use client"

import { useRouter } from "next/navigation"
import { Plus } from "@/app/components/ui/icons"
import { DropdownMenuItem } from "@/app/components/ui/dropdown-menu"

export function CreateSiteDialog() {
  const router = useRouter()

  return (
    <DropdownMenuItem
      className="flex items-center gap-2 p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 w-full"
      onSelect={(e: Event) => {
        e.preventDefault()
        router.push("/create-site")
      }}
    >
      <div className="h-6 w-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 flex-shrink-0">
        <Plus className="h-4 w-4" />
      </div>
      <span className="text-sm font-medium flex-1">Añadir nuevo sitio</span>
    </DropdownMenuItem>
  )
} 