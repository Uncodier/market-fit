"use client"

import { useSite } from "@/app/context/SiteContext"
import { useAuth } from "@/app/hooks/use-auth"
import {
  SectionCard,
  SectionCardContent,
  SectionCardDescription,
  SectionCardHeader,
  SectionCardTitle,
} from "@/app/components/ui/section-card"
import { SiteArchiveDialog } from "./SiteArchiveDialog"

export function SiteArchiveSection({ siteId }: { siteId?: string }) {
  const { currentSite, isLoading: isSiteLoading } = useSite()
  const { user, isLoading: isAuthLoading } = useAuth()

  // Visibility is owner-only; the API independently verifies ownership and password.
  if (
    isSiteLoading || isAuthLoading || !currentSite || !user ||
    currentSite.user_id !== user.id || (siteId && siteId !== currentSite.id)
  ) return null

  return (
    <SectionCard id="site-danger-zone" className="border-destructive/30">
      <SectionCardHeader>
        <SectionCardTitle className="text-destructive">Danger Zone</SectionCardTitle>
        <SectionCardDescription>
          Archiving removes this site from active workspaces. Its data is preserved,
          but its URL and allowed domains are released for reuse. There is no
          self-service restore.
        </SectionCardDescription>
      </SectionCardHeader>
      <SectionCardContent>
        <SiteArchiveDialog
          key={`${currentSite.id}:${user.id}`}
          siteId={currentSite.id}
          siteName={currentSite.name}
        />
      </SectionCardContent>
    </SectionCard>
  )
}