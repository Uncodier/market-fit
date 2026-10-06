import type { ReactNode } from 'react'

// Allow the API's bounded image workflow to finish for create and edit actions.
export const maxDuration = 300

export default function PromotionsLayout({ children }: { children: ReactNode }) {
  return children
}