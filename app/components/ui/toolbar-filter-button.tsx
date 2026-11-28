import type { ComponentProps } from "react"
import { Filter } from "./icons"
import { ToolbarIconButton } from "./toolbar-icon-button"
import { cn } from "@/lib/utils"

export function ToolbarFilterButton({ count = 0, label, className, ...props }: Omit<ComponentProps<typeof ToolbarIconButton>, "children" | "variant"> & {
  count?: number
}) {
  return (
    <ToolbarIconButton {...props} label={label} variant="secondary" className={cn("relative md:h-9 md:w-9", className)}>
      <Filter className="h-4 w-4" aria-hidden />
      {count > 0 && <span aria-hidden className="absolute right-0 top-0 min-w-4 rounded-full bg-primary px-0.5 text-center text-[10px] leading-4 text-primary-foreground">{count}</span>}
    </ToolbarIconButton>
  )
}