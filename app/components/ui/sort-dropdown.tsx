"use client"

import { ToolbarIconButton } from "@/app/components/ui/toolbar-icon-button"
import { Button } from "@/app/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu"
import { ListOrdered, Check, ChevronDown } from "@/app/components/ui/icons"
import { useIsMobile } from "@/app/hooks/use-mobile-view"
import { cn } from "@/lib/utils"

export function SortDropdown<SortValue extends string>({
  sortBy, 
  setSortBy,
  menuClassName,
  title = "Sort by",
  options = [
    { value: "newest" as SortValue, label: "Newest" },
    { value: "oldest" as SortValue, label: "Oldest" },
    { value: "updated_at" as SortValue, label: "Updated" }
  ]
}: { 
  sortBy: SortValue,
  setSortBy: (value: SortValue) => void,
  menuClassName?: string,
  title?: string,
  options?: { value: SortValue, label: string }[]
}) {
  const isMobile = useIsMobile()
  const currentOption = options.find(o => o.value === sortBy) || options[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {isMobile ? (
          <Button data-toolbar-icon-action="off" variant="secondary" size="sm" title={title} aria-label={title}
            className="h-10 w-full justify-between gap-2 rounded-md px-4">
            <ListOrdered className="h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0 truncate font-normal">{currentOption?.label || title}</span>
            <ChevronDown className="h-3 w-3 shrink-0 opacity-50" aria-hidden />
          </Button>
        ) : <ToolbarIconButton variant="secondary" className="md:h-9 md:w-9"
          label={title} tooltipLabel={currentOption ? `${title}: ${currentOption.label}` : title}>
          <ListOrdered className="h-4 w-4" aria-hidden />
        </ToolbarIconButton>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={cn("w-40", menuClassName)}>
        {options.map((option) => (
          <DropdownMenuItem key={option.value} className="cursor-pointer" onClick={() => setSortBy(option.value)}>
            <Check className={cn("mr-2 h-4 w-4", sortBy === option.value ? "opacity-100" : "opacity-0")} />
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
