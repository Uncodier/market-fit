"use client"

import { createContext, useContext, type ReactNode } from 'react'
import type { PromptImageDelivery } from '@/app/lib/prompt-image-url'

const ImageDeliveryContext = createContext<PromptImageDelivery | undefined>(undefined)

export function PublicImageDelivery({ delivery, children }: { delivery: PromptImageDelivery; children: ReactNode }) {
  return <ImageDeliveryContext.Provider value={delivery}>{children}</ImageDeliveryContext.Provider>
}

export function usePromptImageDelivery() {
  return useContext(ImageDeliveryContext)
}