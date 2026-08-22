"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "@/app/components/ui/icons"
import { buttonVariants } from "@/app/components/ui/button"
import { cn } from "@/lib/utils"
import {
  dialogContentOverflowClassName,
  dialogSizeClassName,
  overlayClassName,
  preventDismissFromFloatingLayer,
  type DialogSize,
} from "@/app/components/ui/overlay-styles"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(overlayClassName, "z-[1000000]", className)}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const dialogContentVariants = cva(
  [
    "fixed z-[1000001] flex w-full flex-col border bg-background shadow-lg outline-none duration-200",
    dialogContentOverflowClassName,
    "max-h-[min(90vh,720px)] p-0",
    "inset-x-0 bottom-0 top-auto translate-x-0 translate-y-0 rounded-t-2xl",
    "data-[state=open]:animate-in data-[state=closed]:animate-out",
    "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
    "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
    "sm:inset-auto sm:bottom-auto sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-xl",
    "sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=closed]:slide-out-to-top-[48%]",
    "sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[48%]",
    "sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95",
  ],
  {
    variants: {
      flush: {
        true: "",
        false: "[&>:not([data-slot])]:px-6 [&>:not([data-slot])]:py-4",
      },
    },
    defaultVariants: {
      flush: false,
    },
  }
)

interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof dialogContentVariants> {
  size?: DialogSize
  showClose?: boolean
  busy?: boolean
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(
  (
    {
      className,
      children,
      size = "md",
      showClose = true,
      busy = false,
      flush = false,
      onEscapeKeyDown,
      onPointerDownOutside,
      onFocusOutside,
      onInteractOutside,
      ...props
    },
    ref
  ) => {
    const guardDismiss = (
      event: { target: EventTarget | null; preventDefault: () => void }
    ) => {
      if (busy) event.preventDefault()
      preventDismissFromFloatingLayer(event)
    }

    return (
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          ref={ref}
          className={cn(
            dialogContentVariants({ flush }),
            dialogSizeClassName(size),
            className
          )}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault()
            onEscapeKeyDown?.(event)
          }}
          onPointerDownOutside={(event) => {
            guardDismiss(event)
            onPointerDownOutside?.(event)
          }}
          onFocusOutside={(event) => {
            guardDismiss(event)
            onFocusOutside?.(event)
          }}
          onInteractOutside={(event) => {
            guardDismiss(event)
            onInteractOutside?.(event)
          }}
          {...props}
        >
          {children}
          {showClose ? (
            <DialogPrimitive.Close
              data-slot="dialog-close"
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "absolute right-3 top-3 opacity-70 hover:opacity-100"
              )}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPortal>
    )
  }
)
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-slot="dialog-header"
    className={cn(
      "flex shrink-0 flex-col space-y-1.5 border-b bg-background px-6 py-4 pr-12 text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-slot="dialog-body"
    className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4", className)}
    {...props}
  />
)
DialogBody.displayName = "DialogBody"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-slot="dialog-footer"
    className={cn(
      "flex shrink-0 flex-col-reverse gap-2 border-t bg-background px-6 py-4 sm:flex-row sm:justify-end",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogForm = React.forwardRef<
  HTMLFormElement,
  React.FormHTMLAttributes<HTMLFormElement>
>(({ className, onKeyDown, ...props }, ref) => (
  <form
    ref={ref}
    data-slot="dialog-form"
    className={cn(
      "flex min-h-0 max-h-[inherit] flex-1 flex-col overflow-hidden",
      className
    )}
    onKeyDown={(event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.currentTarget.requestSubmit()
      }
      onKeyDown?.(event)
    }}
    {...props}
  />
))
DialogForm.displayName = "DialogForm"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-base font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogForm,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
