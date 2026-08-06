"use client"

import { useLocalization } from "@/app/context/LocalizationContext"

const KIND_OPTIONS = [
  ["all", "marketplace.categories.all", "All Items"],
  ["product", "marketplace.categories.products", "Products"],
  ["service", "marketplace.categories.services", "Services"],
  ["digital_asset", "marketplace.categories.digitalAssets", "Digital Assets"],
  ["recurring", "marketplace.categories.subscriptions", "Subscriptions"],
] as const

const SUBTYPE_OPTIONS = [
  ["all", "marketplace.subtypes.all", "All"],
  ["course", "marketplace.subtypes.courses", "Courses"],
  ["ticket", "marketplace.subtypes.tickets", "Tickets"],
  ["pass", "marketplace.subtypes.passes", "Passes"],
  ["license", "marketplace.subtypes.licenses", "Licenses"],
  ["file", "marketplace.subtypes.files", "Files"],
] as const

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-shrink-0 px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 border ${
        active
          ? "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white shadow-sm"
          : "bg-white/90 text-gray-700 border-black/5 hover:bg-white dark:bg-[#030303]/80 dark:text-gray-300 dark:border-white/10 dark:hover:bg-[#030303] backdrop-blur-md shadow-sm"
      }`}
    >
      {children}
    </button>
  )
}

function SidebarButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
        active
          ? "bg-primary/10 text-primary font-medium"
          : "hover:bg-muted text-muted-foreground"
      }`}
    >
      {children}
    </button>
  )
}

type FilterProps = {
  selectedKind: string
  setSelectedKind: (kind: string) => void
  selectedSubtype: string
  setSelectedSubtype: (subtype: string) => void
  effectiveKind: string
}

/** Mobile-only horizontal chips (shop-style). */
export function MarketplaceCategoryChips({
  selectedKind,
  setSelectedKind,
  selectedSubtype,
  setSelectedSubtype,
  effectiveKind,
}: FilterProps) {
  const { t } = useLocalization()

  return (
    <div className="md:hidden sticky top-[72px] z-30 pointer-events-none -mx-4 px-4 pt-1 pb-3 mb-6 space-y-3">
      <div className="flex overflow-x-auto gap-3 scrollbar-hide w-full items-center pointer-events-auto pb-2">
        {KIND_OPTIONS.map(([value, key, fallback]) => (
          <Chip
            key={value}
            active={selectedKind === value}
            onClick={() => setSelectedKind(value)}
          >
            {t(key) || fallback}
          </Chip>
        ))}
      </div>

      {effectiveKind === "digital_asset" && (
        <div className="flex overflow-x-auto gap-3 scrollbar-hide w-full items-center pointer-events-auto pb-2">
          {SUBTYPE_OPTIONS.map(([value, key, fallback]) => (
            <Chip
              key={value}
              active={selectedSubtype === value}
              onClick={() => setSelectedSubtype(value)}
            >
              {t(key) || fallback}
            </Chip>
          ))}
        </div>
      )}
    </div>
  )
}

/** Desktop left filter sidebar. */
export function MarketplaceFilterSidebar({
  selectedKind,
  setSelectedKind,
  selectedSubtype,
  setSelectedSubtype,
  effectiveKind,
}: FilterProps) {
  const { t } = useLocalization()

  return (
    <aside className="w-full md:w-64 shrink-0 space-y-8 hidden md:block sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto overflow-x-hidden pb-4">
      <div>
        <h3 className="font-bold text-lg mb-4">
          {t("marketplace.categories.title") || "Categories"}
        </h3>
        <div className="space-y-1">
          {KIND_OPTIONS.map(([value, key, fallback]) => (
            <SidebarButton
              key={value}
              active={selectedKind === value}
              onClick={() => setSelectedKind(value)}
            >
              {t(key) || fallback}
            </SidebarButton>
          ))}
        </div>
      </div>

      {effectiveKind === "digital_asset" && (
        <div>
          <h3 className="font-bold text-lg mb-4">
            {t("marketplace.subtypes.title") || "Subtypes"}
          </h3>
          <div className="space-y-1">
            {SUBTYPE_OPTIONS.map(([value, key, fallback]) => (
              <SidebarButton
                key={value}
                active={selectedSubtype === value}
                onClick={() => setSelectedSubtype(value)}
              >
                {t(key) || fallback}
              </SidebarButton>
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}
