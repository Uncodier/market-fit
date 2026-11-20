"use client"

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { ConnectorLogo } from "./connector-logo"
import { useLocalization } from "@/app/context/LocalizationContext"
import type { Toolkit } from "./types"

export function ConnectorCard({ toolkit, domains }: { toolkit: Toolkit; domains: Record<string, string> }) {
  const { t } = useLocalization()
  return <Link href={`/connectors/${encodeURIComponent(toolkit.slug)}`} aria-label={toolkit.name}
    className="group block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
    <Card className="h-full transition-colors group-hover:border-primary/50">
    <CardHeader>
      <div className="mb-3 flex items-center justify-between gap-2">
        <ConnectorLogo src={toolkit.logo} name={toolkit.name} />
        {toolkit.connection_count > 0 && <Badge variant="secondary">{t("connectors.accountCount", { count: toolkit.connection_count })}</Badge>}
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
  </Link>
}