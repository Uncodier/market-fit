import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground",
        indigo:
          "border-transparent bg-[rgb(99,102,241)] text-white",
      },
      interactive: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      {
        variant: "default",
        interactive: true,
        class: "hover:bg-primary/80 cursor-pointer",
      },
      {
        variant: "secondary",
        interactive: true,
        class: "hover:bg-secondary/80 cursor-pointer",
      },
      {
        variant: "destructive",
        interactive: true,
        class: "hover:bg-destructive/80 cursor-pointer",
      },
      {
        variant: "indigo",
        interactive: true,
        class: "hover:bg-[rgb(99,102,241)]/80 cursor-pointer",
      },
    ],
    defaultVariants: {
      variant: "default",
      interactive: false,
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  interactive?: boolean
}

function Badge({ className, variant, interactive, ...props }: BadgeProps) {
  // Auto-detect interactive state based on props if not explicitly set
  const isInteractive = interactive !== undefined 
    ? interactive 
    : !!(props.onClick || props.onMouseDown || props.onMouseUp || props.onKeyDown)

  return (
    <div className={cn(badgeVariants({ variant, interactive: isInteractive }), className)} {...props} />
  )
}

export { Badge, badgeVariants } 