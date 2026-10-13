"use client"

import { Button } from "@/app/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu"
import { ListOrdered, Check, ChevronDown } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"

export function SortDropdown<SortValue extends string>({
  sortBy, 
  setSortBy,
  className,
  options = [
    { value: "newest" as SortValue, label: "Newest" },
    { value: "oldest" as SortValue, label: "Oldest" },
    { value: "updated_at" as SortValue, label: "Updated" }
  ]
}: { 
  sortBy: SortValue,
  setSortBy: (value: SortValue) => void,
  className?: string,
  options?: { value: SortValue, label: string }[]
}) {
  const currentOption = options.find(o => o.value === sortBy) || options[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className={cn("w-full md:w-auto h-10 md:h-9 gap-2 rounded-md md:rounded-full px-4 justify-between md:justify-center", className)} title="Sort by">
          <div className="flex min-w-0 items-center gap-2">
            <ListOrdered className="h-4 w-4 shrink-0" />
            <span className="truncate font-normal">
              {currentOption.label}
            </span>
          </div>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
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
