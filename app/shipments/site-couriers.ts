"use client"

import { siteMembersService } from "@/app/services/site-members-service"

export interface SiteCourier {
  id: string
  name: string
}

/** Load active site members + owner for courier assignment UI. */
export async function listSiteCouriers(siteId: string): Promise<SiteCourier[]> {
  return siteMembersService.getAssigneeOptions(siteId)
}
