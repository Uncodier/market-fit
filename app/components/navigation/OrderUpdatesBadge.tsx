import { cn } from "@/lib/utils"

export function OrderUpdatesBadge({
  count,
  className,
}: {
  count: number
  className?: string
}) {
  if (count <= 0) return null

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1",
        "text-[10px] font-bold leading-none text-white shadow-sm ring-1 ring-background",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  )
}
