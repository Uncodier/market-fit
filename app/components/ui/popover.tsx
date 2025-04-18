"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface PopoverProps {
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

interface PopoverTriggerProps {
  asChild?: boolean
  children: React.ReactNode
}

interface PopoverContentProps {
  className?: string
  children: React.ReactNode
  position?: "top" | "bottom" | "left" | "right"
  onClose?: () => void
}

export const PopoverContext = React.createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement>;
  contentRef: React.RefObject<HTMLDivElement>;
}>({
  open: false,
  setOpen: () => {},
  triggerRef: { current: null },
  contentRef: { current: null }
});

export function Popover({ children, open: controlledOpen, onOpenChange }: PopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)
  
  // Use controlled or uncontrolled state
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen
  
  // Handle state changes
  const setOpen = React.useCallback((value: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(value)
    }
    if (onOpenChange) {
      onOpenChange(value)
    }
  }, [isControlled, onOpenChange])
  
  // Close popover when clicking outside
  React.useEffect(() => {
    if (!open) return
    
    const handleOutsideClick = (e: MouseEvent) => {
      // If clicked on trigger or content, don't close
      if (
        (triggerRef.current && triggerRef.current.contains(e.target as Node)) ||
        (contentRef.current && contentRef.current.contains(e.target as Node))
      ) {
        return
      }
      
      // Otherwise close
      setOpen(false)
    }
    
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [open, setOpen])
  
  return (
    <PopoverContext.Provider value={{ open, setOpen, triggerRef, contentRef }}>
      <div className="relative inline-block">
        {children}
      </div>
    </PopoverContext.Provider>
  )
}

export function PopoverTrigger({ asChild, children }: PopoverTriggerProps) {
  const { open, setOpen, triggerRef } = React.useContext(PopoverContext)
  
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setOpen(!open)
  }
  
  if (asChild) {
    return (
      <div onClick={handleClick} ref={triggerRef as React.RefObject<HTMLDivElement>}>
        {children}
      </div>
    )
  }
  
  return (
    <button onClick={handleClick} ref={triggerRef as React.RefObject<HTMLButtonElement>}>
      {children}
    </button>
  )
}

export function PopoverContent({ className, children, position = "bottom", onClose }: PopoverContentProps) {
  const { open, contentRef } = React.useContext(PopoverContext)
  const { triggerRef } = React.useContext(PopoverContext)
  
  React.useEffect(() => {
    if (open && contentRef.current && triggerRef.current) {
      const adjustPosition = () => {
        const trigger = triggerRef.current!
        const content = contentRef.current!
        const triggerRect = trigger.getBoundingClientRect()
        const contentRect = content.getBoundingClientRect()
        const viewportHeight = window.innerHeight
        const viewportWidth = window.innerWidth
        
        // Reset styles
        content.style.top = ""
        content.style.bottom = ""
        content.style.left = ""
        content.style.right = ""
        content.style.transform = ""
        
        // Calculate positions based on props or available space
        const actualPosition = calculatePosition(position, triggerRect, contentRect, viewportHeight, viewportWidth)
        
        // Apply the calculated position with specific spacing for bottom position
        switch (actualPosition) {
          case "top":
            content.style.bottom = `${window.innerHeight - triggerRect.top}px`
            content.style.left = `${triggerRect.left}px`
            content.style.transform = ""
            break
          case "bottom":
            content.style.top = `${triggerRect.bottom + 20}px` // Set to 20px below the button
            content.style.left = `${triggerRect.left}px`
            content.style.transform = ""
            break
          case "left":
            content.style.top = `${triggerRect.top}px`
            content.style.right = `${window.innerWidth - triggerRect.left}px`
            content.style.transform = ""
            break
          case "right":
            content.style.top = `${triggerRect.top}px`
            content.style.left = `${triggerRect.right}px`
            content.style.transform = ""
            break
        }
        
        // Check for overflow and adjust if needed
        const newRect = content.getBoundingClientRect()
        
        if (newRect.bottom > viewportHeight) {
          content.style.top = ""
          content.style.bottom = "10px"
        }
        
        if (newRect.right > viewportWidth) {
          content.style.left = ""
          content.style.right = "10px"
          content.style.transform = ""
        }
        
        if (newRect.top < 0) {
          content.style.top = "10px"
          content.style.bottom = ""
        }
        
        if (newRect.left < 0) {
          content.style.left = "10px"
          content.style.right = ""
          content.style.transform = ""
        }
      }
      
      adjustPosition()
      
      // Reapply position on window resize
      window.addEventListener('resize', adjustPosition)
      return () => window.removeEventListener('resize', adjustPosition)
    }
  }, [open, position])
  
  if (!open) return null
  
  // Function to determine the best position based on available space
  function calculatePosition(
    preferredPosition: string,
    triggerRect: DOMRect,
    contentRect: DOMRect,
    viewportHeight: number,
    viewportWidth: number
  ) {
    // Check if there's enough space for the preferred position
    switch (preferredPosition) {
      case "top":
        if (triggerRect.top < contentRect.height + 10) {
          return "bottom"
        }
        break
      case "bottom":
        if (viewportHeight - triggerRect.bottom < contentRect.height + 10) {
          return "top"
        }
        break
      case "left":
        if (triggerRect.left < contentRect.width + 10) {
          return "right"
        }
        break
      case "right":
        if (viewportWidth - triggerRect.right < contentRect.width + 10) {
          return "left"
        }
        break
    }
    
    return preferredPosition
  }
  
  const handleContentClick = (e: React.MouseEvent) => {
    // Prevent click from propagating to document
    e.stopPropagation()
  }
  
  return (
    <div 
      ref={contentRef}
      className={cn(
        "fixed z-[100] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95",
        className
      )}
      onClick={handleContentClick}
    >
      {children}
    </div>
  )
} 