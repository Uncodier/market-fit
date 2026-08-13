"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { useBtnGlassMotion } from "./use-btn-glass-motion"

const buttonVariants = cva(
  "font-inter inline-flex items-center justify-center whitespace-nowrap rounded-full overflow-hidden text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "btn-primary",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors duration-200",
        outline:
          "ring-1 ring-inset ring-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors duration-200",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors duration-200",
        ghost: "hover:bg-accent hover:text-accent-foreground transition-colors duration-200",
        link: "text-primary underline-offset-4 hover:underline transition-colors duration-200",
      },
      size: {
        default: "h-9 px-3.5 py-2",
        sm: "h-8 px-2.5",
        lg: "h-10 px-7",
        icon: "h-9 w-9 !min-w-0 !p-0 aspect-square flex items-center justify-center shrink-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const isPrimary = variant === undefined || variant === "default"
    const setGlassNode = useBtnGlassMotion(isPrimary)

    const assignRef = React.useCallback(
      (node: HTMLButtonElement | null) => {
        setGlassNode(node)
        if (typeof ref === "function") ref(node)
        else if (ref) ref.current = node
      },
      [setGlassNode, ref]
    )

    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size }), className)}
          ref={assignRef}
          {...props}
        >
          {children}
        </Slot>
      )
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size }), className)}
        ref={assignRef}
        {...props}
      >
        {children}
        {isPrimary ? (
          <>
            <span className="btn-glass-cursor" aria-hidden="true" />
            <span className="btn-glass-rim" aria-hidden="true" />
          </>
        ) : null}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
