import { Skeleton } from "@/app/components/ui/skeleton"
import { cn } from "@/app/lib/utils"

interface LoadingSkeletonProps {
  className?: string
  size?: "sm" | "md" | "lg"
  variant?: "inline" | "button" | "form" | "card" | "fullscreen"
  text?: string
  lines?: number
}

export function LoadingSkeleton({ 
  className,
  size = "md",
  variant = "inline",
  text,
  lines = 1
}: LoadingSkeletonProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6", 
    lg: "h-8 w-8"
  }

  if (variant === "button") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Skeleton className={sizeClasses[size]} />
        {text && <Skeleton className="h-4 w-20" />}
      </div>
    )
  }

  if (variant === "form") {
    return (
      <div className={cn("space-y-3", className)}>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
        {lines > 1 && Array.from({ length: lines - 1 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (variant === "card") {
    return (
      <div className={cn("p-4 space-y-3", className)}>
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>
    )
  }

  if (variant === "fullscreen") {
    return (
      <div className={cn("flex items-center justify-center min-h-[200px]", className)}>
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <Skeleton className="h-12 w-12 rounded-full" />
          </div>
          {text && (
            <div className="space-y-2">
              <Skeleton className="h-4 w-32 mx-auto" />
              <Skeleton className="h-3 w-48 mx-auto" />
            </div>
          )}
        </div>
      </div>
    )
  }

  // Default inline variant
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Skeleton className={sizeClasses[size]} />
      {text && <span className="text-sm text-muted-foreground">{text}</span>}
    </div>
  )
}
