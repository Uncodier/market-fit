import type { ComponentType } from "react"
import * as Icons from "@/app/components/ui/icons"

export function isEmojiIcon(icon?: string | null): boolean {
  if (!icon) return false
  return !/[A-Za-z_]/.test(icon)
}

export function getCategoryIconComponent(icon?: string | null) {
  if (!icon) return null
  const candidate = (Icons as Record<string, unknown>)[icon]
  return typeof candidate === "function" ? (candidate as ComponentType<{ className?: string }>) : null
}
