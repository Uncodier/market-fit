"use client"

import { useState } from 'react'
import { Button } from './button'
import { AIActionModal } from './ai-action-modal'

// Import the Cpu icon from Sidebar.tsx
const Cpu = ({ className = "", size = 20, ...props }: { className?: string, size?: number, [key: string]: any }) => (
  <div 
    className={`inline-flex items-center justify-center safari-icon-fix ${className}`}
    style={{ 
      width: size, 
      height: size, 
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      ...props.style 
    }}
    onClick={props.onClick}
    aria-hidden={props["aria-hidden"] ?? true}
  >
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
      <rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" />
      <line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" />
      <line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" />
      <line x1="20" y1="14" x2="23" y2="14" />
      <line x1="1" y1="9" x2="4" y2="9" />
      <line x1="1" y1="14" x2="4" y2="14" />
    </svg>
  </div>
)

interface BuildWithAIButtonProps {
  className?: string
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  modalTitle?: string
  modalDescription?: string
  modalActionLabel?: string
  onAction?: () => Promise<any>
  estimatedTime?: number
  refreshOnComplete?: boolean
}

export function BuildWithAIButton({
  className = '',
  variant = 'default',
  size = 'default',
  modalTitle = "Build with AI",
  modalDescription = "Use AI to enhance your workflow and create better content.",
  modalActionLabel = "Start Building",
  onAction = async () => { 
    // Default action - can be overridden by props
    return new Promise(resolve => setTimeout(resolve, 2000)) 
  },
  estimatedTime = 30,
  refreshOnComplete = false
}: BuildWithAIButtonProps) {
  const [isAIModalOpen, setIsAIModalOpen] = useState(false)

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setIsAIModalOpen(true)}
      >
        <Cpu className="mr-2 h-4 w-4" />
        Build with AI
      </Button>

      <AIActionModal
        isOpen={isAIModalOpen}
        setIsOpen={setIsAIModalOpen}
        title={modalTitle}
        description={modalDescription}
        actionLabel={modalActionLabel}
        onAction={onAction}
        creditsAvailable={10} // This would come from user's account data
        creditsRequired={1}
        icon={<Cpu className="h-5 w-5 text-primary" />}
        estimatedTime={estimatedTime}
        refreshOnComplete={refreshOnComplete}
      />
    </>
  )
} 