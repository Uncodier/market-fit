"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/app/components/ui/button"

export function sectionCardShellClassName(className?: string) {
  return cn(
    "overflow-hidden rounded-xl border border-border/70 bg-card text-card-foreground",
    className
  )
}

export function isSectionDirty(
  dirtyFields: object | undefined,
  paths: string | string[]
): boolean {
  if (!dirtyFields) return false
  const list = Array.isArray(paths) ? paths : [paths]
  return list.some((path) => {
    const parts = path.split(".")
    let current: unknown = dirtyFields
    for (const part of parts) {
      if (!current || typeof current !== "object") return false
      current = (current as Record<string, unknown>)[part]
    }
    if (current === true) return true
    if (current && typeof current === "object") {
      return Object.keys(current as object).length > 0
    }
    return false
  })
}

export function snapshotsDiffer(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)
}

const SectionCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={sectionCardShellClassName(className)}
    {...props}
  />
))
SectionCard.displayName = "SectionCard"

interface SectionCardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
}

const SectionCardHeader = React.forwardRef<HTMLDivElement, SectionCardHeaderProps>(
  ({ className, title, description, actions, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "px-5 py-4",
        children ? "flex flex-col gap-1" : "flex items-start justify-between gap-3",
        className
      )}
      {...props}
    >
      {children ?? (
        <>
          <div className="min-w-0 space-y-1">
            {title ? (
              <h3 className="text-lg font-semibold tracking-tight text-foreground">
                {title}
              </h3>
            ) : null}
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </>
      )}
    </div>
  )
)
SectionCardHeader.displayName = "SectionCardHeader"

const SectionCardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-lg font-semibold tracking-tight text-foreground", className)}
    {...props}
  />
))
SectionCardTitle.displayName = "SectionCardTitle"

const SectionCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
))
SectionCardDescription.displayName = "SectionCardDescription"

const SectionCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("space-y-4 px-5 pb-5 pt-0", className)} {...props} />
))
SectionCardContent.displayName = "SectionCardContent"

interface SectionCardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  dirty?: boolean
  saving?: boolean
  onSave?: () => void
  saveLabel?: React.ReactNode
  savingLabel?: React.ReactNode
  saveDisabled?: boolean
}

const SectionCardFooter = React.forwardRef<HTMLDivElement, SectionCardFooterProps>(
  (
    {
      className,
      children,
      dirty,
      saving,
      onSave,
      saveLabel = "Save",
      savingLabel = "Saving...",
      saveDisabled,
      ...props
    },
    ref
  ) => {
    const showSave = typeof onSave === "function"
    const disabled =
      saveDisabled !== undefined
        ? saveDisabled
        : Boolean(saving) || (typeof dirty === "boolean" && !dirty)

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-end gap-2 border-t border-border/70 bg-muted/30 px-5 py-3",
          className
        )}
        {...props}
      >
        {children}
        {showSave ? (
          <Button type="button" variant="outline" size="sm" onClick={onSave} disabled={disabled}>
            {saving ? savingLabel : saveLabel}
          </Button>
        ) : null}
      </div>
    )
  }
)
SectionCardFooter.displayName = "SectionCardFooter"

export {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardDescription,
  SectionCardContent,
  SectionCardFooter,
}
export type { SectionCardHeaderProps, SectionCardFooterProps }
