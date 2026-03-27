"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ModalHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
}

export function ModalHeader({
  children,
  className,
  ...props
}: ModalHeaderProps) {
  return (
    <div
      className={cn(
        "px-8 py-6 border-b bg-muted/50 flex justify-between items-center relative z-51",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

interface ModalHeaderTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  className?: string
}

export function ModalHeaderTitle({
  children,
  className,
  ...props
}: ModalHeaderTitleProps) {
  return (
    <h2
      className={cn("text-xl font-semibold tracking-tight", className)}
      {...props}
    >
      {children}
    </h2>
  )
}

interface ModalHeaderDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  className?: string
}

export function ModalHeaderDescription({
  children,
  className,
  ...props
}: ModalHeaderDescriptionProps) {
  return (
    <p
      className={cn("text-sm text-muted-foreground mt-1", className)}
      {...props}
    >
      {children}
    </p>
  )
}
