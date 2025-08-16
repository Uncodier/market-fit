"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ModalFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
}

export function ModalFooter({
  children,
  className,
  ...props
}: ModalFooterProps) {
  return (
    <div
      className={cn(
        "px-8 py-6 border-t bg-muted/50 flex justify-between items-center relative z-51",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

interface ModalFooterActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
}

export function ModalFooterActions({
  children,
  className,
  ...props
}: ModalFooterActionsProps) {
  return (
    <div
      className={cn("flex gap-4", className)}
      {...props}
    >
      {children}
    </div>
  )
}

interface ModalFooterInfoProps extends React.HTMLAttributes<HTMLSpanElement> {
  className?: string
}

export function ModalFooterInfo({
  children,
  className,
  ...props
}: ModalFooterInfoProps) {
  return (
    <span
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    >
      {children}
    </span>
  )
}
