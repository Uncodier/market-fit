import { cva } from "class-variance-authority"

export const agentStatusVariants = cva(
  "flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold",
  {
    variants: {
      status: {
        active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800/30",
        inactive: "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400 border border-gray-200 dark:border-gray-700/30",
        learning: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800/30",
        error: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800/30",
      },
    },
    defaultVariants: {
      status: "inactive",
    },
  }
)

export const agentCardVariants = cva(
  "group transition-all duration-200 ease-in-out bg-card border-border",
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
  "rounded-md transition-colors duration-200",
  {
    variants: {
      hover: {
        true: "hover:bg-muted/50",
      },
    },
    defaultVariants: {
      hover: false,
    },
  }
) 