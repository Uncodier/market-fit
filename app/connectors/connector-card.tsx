"use client"

import { DetailViewLink } from "@/app/components/navigation/DetailViewLink"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { ConnectorLogo } from "./connector-logo"
import { useLocalization } from "@/app/context/LocalizationContext"
import type { Toolkit } from "./types"

export function ConnectorCard({ toolkit, domains, siteId, orderedToolkits = [] }: { toolkit: Toolkit; domains: Record<string, string>; siteId?: string; orderedToolkits?: Toolkit[] }) {
  const { t } = useLocalization()
  return <DetailViewLink siteId={siteId} paths={() => orderedToolkits.map(item => `/connectors/${encodeURIComponent(item.slug)}`)} href={`/connectors/${encodeURIComponent(toolkit.slug)}`} aria-label={toolkit.name}
    aria-description={toolkit.managed_oauth ? t("connectors.managedOAuthBadgeHelp") : undefined}
    className="group block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
    <Card className="h-full transition-colors group-hover:border-primary/50">
    <CardHeader>
      <div className="mb-3 flex items-center justify-between gap-2">
        <ConnectorLogo src={toolkit.logo} name={toolkit.name} />
        <div className="flex flex-wrap justify-end gap-1">
          {toolkit.managed_oauth && <Badge variant="indigo" title={t("connectors.managedOAuthBadgeHelp")}>{t("connectors.managedOAuthBadge")}</Badge>}
          {toolkit.connection_count > 0 && <Badge variant="secondary">{t("connectors.accountCount", { count: toolkit.connection_count })}</Badge>}
        </div>
      </div>
      <CardTitle className="text-lg group-hover:underline">{toolkit.name}</CardTitle>
      <CardDescription className="line-clamp-3">{toolkit.description}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-3 text-xs text-muted-foreground">
      <div className="flex flex-wrap gap-1">{toolkit.domains.map(domain => <Badge key={domain} variant="outline">{domains[domain] || domain}</Badge>)}</div>
      <p>{t("connectors.toolCount", { count: toolkit.tools_count })}</p>
      <p>{t("connectors.accessSeparate")}</p>
    </CardContent>
    </Card>
  </DetailViewLink>
}