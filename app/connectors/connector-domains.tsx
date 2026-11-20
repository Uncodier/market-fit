"use client"

import { Button } from "@/app/components/ui/button"
import { badgeVariants } from "@/app/components/ui/badge"
import {
  BarChart, Brain, Briefcase, Calendar, Code, CreditCard, Database, FolderOpen, HelpCircle,
  LayoutGrid, ListTodo, Megaphone, MessageSquare, PanelLeftOpen, Plug, Receipt, ShieldCheck,
  Truck, Users, type LucideIcon,
} from "@/app/components/ui/icons"
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/app/components/ui/sheet"
import { useLocalization } from "@/app/context/LocalizationContext"
import { cn } from "@/lib/utils"
import { ConnectorDomainRowsSkeleton } from "./connector-skeletons"
import type { z } from "zod"
import type { Catalog, connectorDomainCountsSchema } from "./types"

type DomainProps = {
  domains: Catalog["domains"]
  domainCounts?: z.infer<typeof connectorDomainCountsSchema>
  loading: boolean
  selected: string
  onSelect: (domain: string) => void
}

const subtitleClassName = "px-[10.8px] pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
const domainIcons = new Map<string, LucideIcon>([
  ["", LayoutGrid],
  ["ai", Brain],
  ["crm", Users],
  ["marketing", Megaphone],
  ["communication", MessageSquare],
  ["productivity", ListTodo],
  ["calendar", Calendar],
  ["files", FolderOpen],
  ["commerce", CreditCard],
  ["support", HelpCircle],
  ["developer", Code],
  ["analytics", BarChart],
  ["storage", Database],
  ["hr", Briefcase],
  ["finance", Receipt],
  ["security", ShieldCheck],
  ["procurement", Truck],
])

function DomainList({ domains, domainCounts, loading, selected, onSelect, inSheet = false }: DomainProps & { inSheet?: boolean }) {
  const { t } = useLocalization()
  if (loading) return <ConnectorDomainRowsSkeleton />
  return <ul className="space-y-0.5">
    {[{ id: "", label: t("connectors.allDomains") }, ...domains].map(({ id, label }) => {
      const isSelected = selected === id
      const count = id ? domainCounts?.counts[id] : domainCounts?.total
      const Icon = domainIcons.get(id) ?? Plug
      const button = <button type="button"
        className={cn(
          "block min-h-11 w-full rounded-md px-[10.8px] py-[7.2px] text-left text-[12.6px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:min-h-8",
          isSelected ? "bg-primary/15 text-primary" : "hover:bg-accent/20",
        )}
        aria-pressed={isSelected} onClick={() => { if (!isSelected) onSelect(id) }}>
        {/* Keep layout inside the button so Safari's global button styles cannot center the row contents. */}
        <span className="flex w-full min-w-0 items-center gap-2">
          <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <Icon size={16} className={cn(!isSelected && "text-muted-foreground")} aria-hidden />
            <span className="truncate">{label}</span>
          </span>
          {typeof count === "number" && <span className={cn(badgeVariants({ variant: "secondary" }), "min-w-[2ch] shrink-0 justify-end px-1.5 py-0 text-right text-[11px] tabular-nums", isSelected && "bg-primary/10 text-primary")}>
            {count}
          </span>}
        </span>
      </button>
      return <li key={id}>{inSheet ? <SheetClose asChild>{button}</SheetClose> : button}</li>
    })}
  </ul>
}

export function ConnectorDomainsSidebar(props: DomainProps) {
  const { t } = useLocalization()
  return <aside aria-label={t("connectors.domains")}
    className="sticky top-[var(--topbar-height,64px)] hidden h-[calc(100dvh-var(--topbar-height,64px))] w-[319px] max-w-[38%] shrink-0 self-start flex-col border-r bg-background md:flex">
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1 pt-6">
      <h2 className={subtitleClassName}>{t("connectors.domains")}</h2>
      <DomainList {...props} />
    </div>
  </aside>
}

export function ConnectorDomainsSheet(props: DomainProps) {
  const { t } = useLocalization()
  return <Sheet>
    <SheetTrigger asChild>
      <Button type="button" variant={props.selected ? "secondary" : "outline"} size="icon"
        aria-label={t("connectors.showDomains")} className="h-11 w-11 shrink-0 rounded-full md:hidden">
        <PanelLeftOpen aria-hidden />
      </Button>
    </SheetTrigger>
    <SheetContent side="left" aria-describedby={undefined} className="flex w-[min(90vw,319px)] flex-col gap-0 p-1 pt-6">
      <SheetTitle className={cn(subtitleClassName, "shrink-0 pb-4 pr-14")}>{t("connectors.domains")}</SheetTitle>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain"><DomainList {...props} inSheet /></div>
    </SheetContent>
  </Sheet>
}