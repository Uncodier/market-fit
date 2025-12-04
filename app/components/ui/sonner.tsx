'use client'

import { Toaster as Sonner } from 'sonner'
import { useTheme } from '@/app/context/ThemeContext'

export interface ToasterProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center'
  expand?: boolean
  visibleToasts?: number
  closeButton?: boolean
  offset?: string | number
  theme?: 'light' | 'dark' | 'system'
}

export function Toaster({ 
  ...props 
}: ToasterProps) {
  const { theme } = useTheme()
  
  return (
    <Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  )
} 
