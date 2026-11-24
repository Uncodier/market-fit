"use client"

import { useLocalization } from "@/app/context/LocalizationContext"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import { useOptionalSite } from "@/app/context/SiteContext"
import { ChevronRight, CreditCard } from "@/app/components/ui/icons"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { CreditsWidget } from "./CreditsWidget"
import { NavigationLink } from "./NavigationLink"

export function SidebarBillingWidget({ actorId, isCollapsed }: { actorId?: string; isCollapsed: boolean }) {
  const site = useOptionalSite()
  const permissions = useOptionalPermissions()
  const { t } = useLocalization()
  const current = site?.currentSite
  const scope = site?.requestScope
  if (!current || site.isLoading || current.id.startsWith("demo-")) return null
  if (scope && (scope.actorId !== actorId || scope.siteId !== current.id)) return null

  const capabilities = permissions?.siteId === current.id ? permissions?.capabilities : null
  if (scope && capabilities?.select !== true) return null
  const isOwner = capabilities?.role === "owner" && capabilities.select === true
  if (!isOwner) return <CreditsWidget isCollapsed={isCollapsed} />
  if (!actorId || !scope) return null

  const label = t("billing.form.manageSub") || "Manage billing"
  return (
    <div className={cn("px-3 py-2", isCollapsed && "flex justify-center px-0")}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <NavigationLink
              href="/billing"
              aria-label={label}
              className={cn(
                "flex items-center rounded-lg border border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors",
                isCollapsed ? "h-8 w-8 justify-center" : "w-full gap-2 p-3 text-xs font-medium"
              )}
            >
              <CreditCard size={16} className="shrink-0" aria-hidden={true} />
              {!isCollapsed && <>
                <span className="min-w-0 flex-1">{label}</span>
                <ChevronRight size={14} className="shrink-0" aria-hidden={true} />
              </>}
            </NavigationLink>
          </TooltipTrigger>
          {isCollapsed && <TooltipContent side="right" className="z-[9999]">{label}</TooltipContent>}
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}