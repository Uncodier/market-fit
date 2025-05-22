"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { CardFooter } from "@/app/components/ui/card"

interface ActionFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
}

export function ActionFooter({
  children,
  className,
  ...props
}: ActionFooterProps) {
  return (
    <CardFooter
      className={cn(
        "px-8 py-6 border-t bg-muted/50 flex justify-end gap-4",
        className
      )}
      {...props}
    >
      {children}
    </CardFooter>
  )
} 