import { cva } from "class-variance-authority"

export const agentStatusVariants = cva(
  "transition-colors",
  {
    variants: {
      status: {
        active: "bg-green-100 text-green-800 hover:bg-green-200",
        training: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200",
        inactive: "bg-gray-100 text-gray-800 hover:bg-gray-200",
      },
      size: {
        default: "px-2.5 py-0.5 text-xs font-medium rounded-full",
        lg: "px-3 py-1 text-sm font-medium rounded-full",
      },
    },
    defaultVariants: {
      status: "inactive",
      size: "default",
    },
  }
)

export const agentCardVariants = cva(
  "group transition-all duration-200 ease-in-out",
  {
    variants: {
      hover: {
        true: "hover:shadow-lg hover:border-primary/20",
      },
      interactive: {
        true: "cursor-pointer",
      },
    },
    defaultVariants: {
      hover: true,
      interactive: false,
    },
  }
)

export const metricItemVariants = cva(
  "rounded-lg transition-colors duration-200",
  {
    variants: {
      hover: {
        true: "group-hover:bg-muted/50",
      },
    },
    defaultVariants: {
      hover: true,
    },
  }
) 