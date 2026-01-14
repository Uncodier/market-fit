"use client"

import { cn } from "@/lib/utils"
import { type LucideIcon } from "@/app/components/ui/icons"
import { NavigationLink } from "./NavigationLink"
import { MenuAvatar, MenuAvatarImage, MenuAvatarFallback } from "../ui/menu-avatar"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip"
import { useRef } from "react"
import { useTheme } from "@/app/context/ThemeContext"

// Wrapper component for emoji icons with grayscale filter that adapts to theme
interface EmojiIconProps {
  emoji: string
  className?: string
  intensity?: number // 0-1, where 1 is full grayscale, 0 is no filter
  isActive?: boolean
  isCollapsed?: boolean
}

export function EmojiIcon({ emoji, className, intensity = 1, isActive = false, isCollapsed = false }: EmojiIconProps) {
  const { isDarkMode } = useTheme()
  
  const emojiSize = isCollapsed ? 'text-sm' : 'text-sm'
  
  // In collapsed mode, show only the emoji without container
  if (isCollapsed) {
    return (
      <span 
        className={cn("leading-none", emojiSize, className)}
      >
        {emoji}
      </span>
    )
  }
  
  // In expanded mode, show emoji with container
  return (
    <span 
      className={cn(
        "inline-flex items-center justify-center",
        "rounded-md",
        "border",
        "w-[24px] h-[24px]",
        "flex-shrink-0",
        isActive
          ? isDarkMode
            ? "border-white/20 bg-white/10"
            : "border-white/30 bg-white/20"
          : isDarkMode 
            ? "border-gray-700/50 bg-gray-800/30" 
            : "border-gray-300/50 bg-gray-100/50",
        className
      )}
      style={{
        transition: 'all 0.2s ease-in-out',
        lineHeight: 1
      }}
    >
      <span 
        className={cn("leading-none", emojiSize)}
        style={{
          display: 'inline-block',
          lineHeight: 1,
          verticalAlign: 'middle'
        }}
      >
        {emoji}
      </span>
    </span>
  )
}

interface MenuItemProps {
  href: string
  icon?: LucideIcon
  customIcon?: React.ReactNode
  emoji?: string
  title: string
  subtitle?: string
  avatarUrl?: string
  isActive?: boolean
  isCollapsed?: boolean
  children?: React.ReactNode
  className?: string
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
}

export function MenuItem({ 
  href, 
  icon: Icon, 
  customIcon,
  emoji,
  title, 
  subtitle,
  avatarUrl,
  isActive, 
  isCollapsed,
  children,
  className,
  onClick
}: MenuItemProps) {
  const linkRef = useRef<HTMLAnchorElement>(null);

  const content = (
    <>
      <div className={cn(
        "flex items-center justify-center safari-icon-fix flex-shrink-0",
        isCollapsed ? "w-[32px] h-[32px] mx-auto" : "w-[24px] h-[24px]",
        href === "/notifications" ? "notifications-icon-container" : ""
      )}>
        {customIcon ? customIcon : avatarUrl ? (
          <MenuAvatar className="h-7 w-7">
            <MenuAvatarImage src={avatarUrl} alt={title} />
            <MenuAvatarFallback>
              {title.split(' ').map(word => word[0]).join('').toUpperCase()}
            </MenuAvatarFallback>
          </MenuAvatar>
        ) : emoji ? (
          <EmojiIcon emoji={emoji} isActive={isActive} isCollapsed={isCollapsed} />
        ) : Icon && (
          <Icon className="h-[16.2px] w-[16.2px] shrink-0" />
        )}
      </div>
      
      <div
        className={cn(
          "flex flex-col min-w-0",
          isCollapsed ? "hidden" : "flex",
          "justify-center"
        )}
        style={{ fontSize: '11.3px', lineHeight: 1 }}
      >
        <span 
          className={href.includes('settings') ? "" : "truncate"}
          style={{ lineHeight: 'normal' }}
        >
          {title}
        </span>
        {subtitle && (
          <span className={cn(
            href.includes('settings') ? "" : "truncate",
            isActive ? "text-white/70" : "text-gray-400"
          )}
          style={{ fontSize: '9.7px' }}
          >
            {subtitle}
          </span>
        )}
      </div>

      {children && !isCollapsed && (
        <div className="ml-auto">{children}</div>
      )}
    </>
  )

  const linkContent = (
    <NavigationLink
      ref={linkRef}
      href={href}
      className={cn(
        className,
        "flex items-center text-sm transition-all duration-200 relative group hover:scale-105 active:scale-95",
        isCollapsed 
          ? isActive 
            ? "rounded-full justify-center h-[32px] w-[32px]" 
            : "rounded-md justify-center h-[32px] w-[32px]"
          : "rounded-md justify-start h-[32px]",
        isActive
          ? "bg-primary text-primary-foreground [&_svg]:text-primary-foreground [&_span]:text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:shadow-md hover:shadow-accent/20"
      )}
      style={{ 
        paddingLeft: isCollapsed ? '0px' : '9.7px', 
        paddingRight: isCollapsed ? '0px' : '9.7px', 
        paddingTop: isCollapsed ? '0px' : '6.5px', 
        paddingBottom: isCollapsed ? '0px' : '6.5px',
        gap: isCollapsed ? '0px' : '9.7px',
        fontSize: '11.3px'
      }}
      onClick={onClick}
    >
      {isCollapsed ? (
        <>
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-full h-full flex items-center justify-center p-0 m-0">{content}</div>
              </TooltipTrigger>
              <TooltipContent 
                side="right" 
                align="start" 
                className="flex flex-col gap-1 bg-popover text-popover-foreground border-border shadow-lg z-[9999]"
                sideOffset={5}
              >
                <p className="font-medium">{title}</p>
                {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {children && (
            <div className="absolute -top-1 -right-[0.65rem] z-10">{children}</div>
          )}
        </>
      ) : (
        content
      )}
    </NavigationLink>
  )

  return linkContent
} 