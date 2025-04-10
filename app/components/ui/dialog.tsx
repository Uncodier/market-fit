"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"
import { SafariCloseButtonAbsolute } from "@/app/components/common/SafariCloseButtonAbsolute"
import { useTheme } from "@/app/context/ThemeContext"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

// Exportamos el DialogClose original por compatibilidad
const DialogCloseOriginal = DialogPrimitive.Close

// Versión personalizada que funciona bien en Safari
const DialogClose = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Close>
>(({ className, children, ...props }, ref) => {
  // Detectar si estamos en Safari en el cliente
  const [isSafari, setIsSafari] = React.useState(false);

  React.useEffect(() => {
    const isBrowser = typeof window !== 'undefined';
    if (isBrowser) {
      const isSafariCheck = 
        navigator.userAgent.match(/AppleWebKit\/[\d.]+/g) &&
        navigator.userAgent.match(/Version\/[\d.]+.*Safari/) &&
        !navigator.userAgent.match(/Chrome\/[\d.]+/g);
      
      setIsSafari(Boolean(isSafariCheck));
    }
  }, []);

  if (isSafari) {
    // Para Safari usamos nuestro componente especial
    return (
      <SafariCloseButtonAbsolute 
        onClick={() => props.onClick && props.onClick({} as any)} 
        top="10px" 
        right="10px"
        className={className}
      />
    );
  }

  // Para otros navegadores, usamos el componente original
  return (
    <DialogPrimitive.Close
      ref={ref}
      className={cn(
        "absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground",
        className
      )}
      {...props}
    >
      {children || (
        <>
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </>
      )}
    </DialogPrimitive.Close>
  );
});
DialogClose.displayName = "DialogClose";

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => {
  // Use the useTheme hook to detect current theme
  const { isDarkMode } = useTheme();
  
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        "fixed inset-0 z-50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        // Apply different background color based on theme
        isDarkMode ? "bg-black/80" : "bg-white/80",
        className
      )}
      {...props}
    />
  )
})
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  // Detectar si estamos en Safari en el cliente
  const [isSafari, setIsSafari] = React.useState(false);

  React.useEffect(() => {
    const isBrowser = typeof window !== 'undefined';
    if (isBrowser) {
      const isSafariCheck = 
        navigator.userAgent.match(/AppleWebKit\/[\d.]+/g) &&
        navigator.userAgent.match(/Version\/[\d.]+.*Safari/) &&
        !navigator.userAgent.match(/Chrome\/[\d.]+/g);
      
      setIsSafari(Boolean(isSafariCheck));
    }
  }, []);
  
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
          className
        )}
        {...props}
      >
        {children}
        {/* Usamos el componente mejorado para Safari o el original para otros navegadores */}
        {isSafari ? (
          <SafariCloseButtonAbsolute top="16px" right="16px" />
        ) : (
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
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
  DialogCloseOriginal,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} 