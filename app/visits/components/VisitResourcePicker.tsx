"use client"

import { Button } from "@/app/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { useLocalization } from "@/app/context/LocalizationContext"
import type { ReservationResourceType } from "@/app/types"
import { cn } from "@/lib/utils"

type Option = { id: string; label: string; hint?: string }

export function VisitResourcePicker({
  resourceType,
  onResourceTypeChange,
  availableTypes,
  services,
  locations,
  employees,
  catalogItemId,
  locationId,
  assigneeUserId,
  onSelectService,
  onSelectLocation,
  onSelectEmployee,
}: {
  resourceType: ReservationResourceType
  onResourceTypeChange: (type: ReservationResourceType) => void
  availableTypes: ReservationResourceType[]
  services: Option[]
  locations: Option[]
  employees: Option[]
  catalogItemId: string
  locationId: string
  assigneeUserId: string
  onSelectService: (id: string) => void
  onSelectLocation: (id: string) => void
  onSelectEmployee: (id: string) => void
}) {
  const { t } = useLocalization()

  if (availableTypes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground relative z-20">
        {t("visits.resource.empty")}
      </p>
    )
  }

  const options =
    resourceType === "catalog_item"
      ? services
      : resourceType === "location"
        ? locations
        : employees
  const selectedId =
    resourceType === "catalog_item"
      ? catalogItemId
      : resourceType === "location"
        ? locationId
        : assigneeUserId
  const onSelect =
    resourceType === "catalog_item"
      ? onSelectService
      : resourceType === "location"
        ? onSelectLocation
        : onSelectEmployee

  return (
    <div className="flex flex-col gap-4 min-h-0 flex-1 relative z-20">
      {availableTypes.length > 1 && (
        <Tabs
          value={resourceType}
          onValueChange={(v) => onResourceTypeChange(v as ReservationResourceType)}
        >
          <TabsList className="rounded-full w-full">
            {availableTypes.includes("catalog_item") && (
              <TabsTrigger value="catalog_item" className="rounded-full text-xs flex-1">
                {t("visits.resource.service")}
              </TabsTrigger>
            )}
            {availableTypes.includes("location") && (
              <TabsTrigger value="location" className="rounded-full text-xs flex-1">
                {t("visits.resource.location")}
              </TabsTrigger>
            )}
            {availableTypes.includes("employee") && (
              <TabsTrigger value="employee" className="rounded-full text-xs flex-1">
                {t("visits.resource.team")}
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>
      )}

      <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar min-h-0">
        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("visits.resource.empty")}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 pb-2">
            {options.map((option) => (
              <Button
                key={option.id}
                type="button"
                variant={selectedId === option.id ? "default" : "outline"}
                className={cn(
                  "w-full justify-center font-medium transition-all h-12",
                  selectedId === option.id ? "shadow-md" : "hover:border-primary/30 hover:bg-accent"
                )}
                onClick={() => onSelect(option.id)}
              >
                <span className="truncate">
                  {option.label}
                  {option.hint ? ` · ${option.hint}` : ""}
                </span>
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
