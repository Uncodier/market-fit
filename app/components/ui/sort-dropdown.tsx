"use client"

import { ToolbarIconButton } from "@/app/components/ui/toolbar-icon-button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu"
import { ListOrdered, Check } from "@/app/components/ui/icons"
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
  const currentOption = options.find(o => o.value === sortBy) || options[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ToolbarIconButton variant="secondary" className="md:h-9 md:w-9"
          label={title} tooltipLabel={currentOption ? `${title}: ${currentOption.label}` : title}>
          <ListOrdered className="h-4 w-4" aria-hidden />
        </ToolbarIconButton>
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
