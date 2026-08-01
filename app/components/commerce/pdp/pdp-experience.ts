import { Reservation, Entitlement } from "@/app/types"

export type PdpExperienceKind = 'reservation' | 'entitlement' | 'subscription'

export interface PdpExperience {
  kind: PdpExperienceKind
  backUrl?: string
  // reservation manage
  reservation?: Reservation | any
  // entitlement experiences
  entitlement?: Entitlement | any
  // subscription manage
  subscription?: any
  // optional extras per layout (files, schedules, progress, etc.)
  extras?: Record<string, any>
}
