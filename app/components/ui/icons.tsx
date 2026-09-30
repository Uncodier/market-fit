"use client"

import type { ComponentType } from "react"
import type { IconProps } from "./icons/icon-wrapper"
export type LucideIcon = ComponentType<IconProps>

// Public icon entry point. Implementations are grouped by UI responsibility.
export * from './icons/navigation'
export * from './icons/actions'
export * from './icons/communication'
export * from './icons/documents'
export * from './icons/media'
export * from './icons/commerce'
export * from './icons/technology'
export * from './icons/brands'
export { CheckCircle2 as CheckCircle } from './icons/actions'
export { CalendarIcon as Calendar } from './icons/documents'
export { Loader as Loader2 } from './icons/actions'
export { UploadCloud as FileUp } from './icons/actions'
