"use client"

import { useLocalization } from "@/app/context/LocalizationContext"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Archive, DatabaseIcon, Boxes } from "@/app/components/ui/icons"

type CatalogKind = 'all' | 'product' | 'service' | 'variant'
type CatalogStatus = 'active' | 'archived'

interface CatalogFilterTabsProps {
  kind: CatalogKind
  status: CatalogStatus
  onChange: (kind: CatalogKind, status: CatalogStatus) => void
}

const triggerClassName = "w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5"

export function CatalogFilterTabs({ kind, status, onChange }: CatalogFilterTabsProps) {
  const { t } = useLocalization()

  const handleChange = (value: string) => {
    if (value === 'archived') onChange('all', 'archived')
    else if (value === 'all' || value === 'product' || value === 'service' || value === 'variant') {
      onChange(value, 'active')
    }
  }

  return (
    <Tabs value={status === 'archived' ? 'archived' : kind} onValueChange={handleChange} className="w-full md:w-auto min-w-0">
      <TabsList aria-label="Catalog filters" className="h-auto md:h-8 p-0 md:p-0.5 bg-transparent md:bg-muted/30 rounded-none md:rounded-full flex flex-wrap md:flex-nowrap md:flex-row w-full md:max-w-full overflow-y-visible md:overflow-x-auto justify-start items-center gap-2 md:gap-0">
        <TabsTrigger value="all" className={triggerClassName}>{t('status.active') || 'Active'}</TabsTrigger>
        <TabsTrigger value="product" className={triggerClassName}><Archive className="shrink-0 h-4 w-4 md:hidden" />{t('catalog.kind.product') || 'Products'}</TabsTrigger>
        <TabsTrigger value="service" className={triggerClassName}><DatabaseIcon className="shrink-0 h-4 w-4 md:hidden" />{t('catalog.kind.service') || 'Services'}</TabsTrigger>
        <TabsTrigger value="variant" className={triggerClassName}><Boxes className="shrink-0 h-4 w-4 md:hidden" />{t('catalog.kind.variant') || 'Variants'}</TabsTrigger>
        <TabsTrigger value="archived" className={triggerClassName}>{t('status.archived') || 'Archived'}</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}