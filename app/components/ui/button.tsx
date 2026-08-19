"use client"

import * as React from "react"
import { Slot, Slottable } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { useBtnGlassMotion } from "./use-btn-glass-motion"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import { inferButtonCommand, getNodeText } from "@/lib/permissions/button-heuristic"
import { notifyPermissionDenied } from "@/lib/permissions/notify"
import { PERMISSION_DENIED_TITLE } from "@/lib/permissions/types"

const buttonVariants = cva(
  "font-inter inline-flex items-center justify-center whitespace-nowrap rounded-full overflow-hidden select-none text-sm font-medium transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
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

const OUTER_CLASS_RE =
  /(?:^|\s)((?:sm:|md:|lg:|xl:|2xl:)?(?:w-full|flex-1|grow|shrink-0|(?:m|mt|mb|ml|mr|mx|my|ms|me)-(?:\[[^\]]+\]|[\w./]+)|self-[\w-]+|!?h-(?:\[[^\]]+\]|[\w./]+)|!?min-h-(?:\[[^\]]+\]|[\w./]+)|!?mt-(?:\[[^\]]+\]|[\w./]+)))(?=\s|$)/g

const RADIUS_CLASS_RE =
  /(?:^|\s)((?:sm:|md:|lg:|xl:|2xl:)?(?:rounded(?:-(?:\[[^\]]+\]|[\w]+))?))/g

function splitOuterClasses(className?: string) {
  if (!className) return { outer: "", inner: undefined as string | undefined }
  const outer: string[] = []
  const inner = className
    .replace(OUTER_CLASS_RE, (match, token: string) => {
      outer.push(token)
      if (token.match(/(?:^|:)(?:!?h-|!?min-h-|w-full)/)) {
        return match
      }
      return " "
    })
    .replace(/\s+/g, " ")
    .trim()
  const radius = [...className.matchAll(RADIUS_CLASS_RE)].map((match) => match[1])
  return { outer: [...outer, ...radius].join(" "), inner: inner || undefined }
}

function safariRgbChannels(value: string) {
  return value.replace(/,/g, " ").replace(/\s+/g, " ").trim()
}

function withSafariRgbVars(style?: React.CSSProperties) {
  if (!style) return undefined
  const next: Record<string, unknown> = { ...style }
  for (const key of ["--btn-tint", "--btn-fill"]) {
    const value = next[key]
    if (typeof value === "string") next[key] = safariRgbChannels(value)
  }
  return next as React.CSSProperties
}

function pickCssVars(style?: React.CSSProperties) {
  const normalized = withSafariRgbVars(style)
  if (!normalized) return undefined
  const vars: Record<string, string> = {}
  for (const [key, value] of Object.entries(normalized)) {
    if (key.startsWith("--") && value != null) vars[key] = String(value)
  }
  return Object.keys(vars).length ? (vars as React.CSSProperties) : undefined
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  tint?: "default" | "destructive"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, tint, children, onClick, ...props }, ref) => {
    const isPrimary = variant === undefined || variant === "default"
    const wellTintClass = tint === "destructive" ? "btn-tint-red" : undefined
    const setGlassNode = useBtnGlassMotion(isPrimary)
    const permissions = useOptionalPermissions()
    const dataPermission =
      (props as Record<string, unknown>)["data-permission"] as string | undefined
    const inferredCommand = inferButtonCommand({
      type: props.type,
      variant,
      tint,
      childrenText: getNodeText(children),
      dataPermission,
    })
    const blockedCommand =
      !props.disabled && inferredCommand && permissions && !permissions.can(inferredCommand)
        ? inferredCommand
        : null

    const isCircular =
      size === "icon" ||
      (className?.includes("aspect-square") && !className?.match(/(?:sm|md|lg|xl|2xl):!?aspect-auto/))
    const innerCircularClass = isCircular ? "btn-primary-circular" : undefined

    const assignRef = React.useCallback(
      (node: HTMLButtonElement | null) => {
        setGlassNode(node)
        if (typeof ref === "function") ref(node)
        else if (ref) ref.current = node
      },
      [setGlassNode, ref]
    )

    const style = withSafariRgbVars(props.style)
    const gatedClassName = blockedCommand ? "opacity-50 cursor-not-allowed" : undefined
    const blockClick = (event: React.SyntheticEvent) => {
      event.preventDefault()
      event.stopPropagation()
      if (blockedCommand) notifyPermissionDenied(blockedCommand)
    }
    const gatedHandlers = blockedCommand
      ? {
          "aria-disabled": true as const,
          title: props.title || PERMISSION_DENIED_TITLE,
          onClick: blockClick,
          onClickCapture: blockClick,
        }
      : { onClick }

    if (asChild && !isPrimary) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size }), gatedClassName, className)}
          ref={assignRef}
          {...props}
          {...gatedHandlers}
          style={style}
        >
          {children}
        </Slot>
      )
    }

    if (asChild) {
      const { outer, inner } = splitOuterClasses(className)
      return (
        <span className={cn("btn-primary-well", wellTintClass, outer)} style={pickCssVars(style)}>
          <Slot
            className={cn(buttonVariants({ variant, size }), gatedClassName, innerCircularClass, inner)}
            ref={assignRef}
            {...props}
            {...gatedHandlers}
            style={style}
          >
            <Slottable>{children}</Slottable>
            <span className="btn-glass-cursor" aria-hidden="true" />
            <span className="btn-glass-rim" aria-hidden="true" />
          </Slot>
        </span>
      )
    }

    if (!isPrimary) {
      return (
        <button
          className={cn(buttonVariants({ variant, size }), gatedClassName, className)}
          ref={assignRef}
          {...props}
          {...gatedHandlers}
          style={style}
        >
          {children}
        </button>
      )
    }

    const { outer, inner } = splitOuterClasses(className)
    return (
      <span className={cn("btn-primary-well", wellTintClass, outer)} style={pickCssVars(style)}>
        <button
          className={cn(buttonVariants({ variant, size }), gatedClassName, innerCircularClass, inner)}
          ref={assignRef}
          {...props}
          {...gatedHandlers}
          style={style}
        >
          {children}
          <span className="btn-glass-cursor" aria-hidden="true" />
          <span className="btn-glass-rim" aria-hidden="true" />
        </button>
      </span>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
