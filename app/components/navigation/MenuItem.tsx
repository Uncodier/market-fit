"use client"

import { cn } from "@/lib/utils"
import { type LucideIcon } from "@/app/components/ui/icons"
import Link from "next/link"
import { MenuAvatar, MenuAvatarImage, MenuAvatarFallback } from "../ui/menu-avatar"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip"
import { useEffect, useRef, useState } from "react"
import { SafariSettingsLink } from "../common/SafariSettingsLink"

interface MenuItemProps {
  href: string
  icon?: LucideIcon
  customIcon?: React.ReactNode
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
  const [isSafari, setIsSafari] = useState(false);
  const isSettingsLink = href.includes('settings');

  // Detectamos si estamos en Safari
  useEffect(() => {
    const isBrowser = typeof window !== 'undefined';
    if (isBrowser) {
      const isSafariCheck = 
        navigator.userAgent.match(/AppleWebKit\/[\d.]+/g) &&
        navigator.userAgent.match(/Version\/[\d.]+.*Safari/) &&
        !navigator.userAgent.match(/Chrome\/[\d.]+/g);
      
      setIsSafari(Boolean(isSafariCheck));
    }
  }, []);

  // Si es un enlace a settings y estamos en Safari, usamos el componente especializado
  if (isSafari && isSettingsLink) {
    return (
      <SafariSettingsLink
        href={href}
        label={title}
        className={cn(
          className,
          "rounded-md text-sm transition-all duration-200 relative group hover:scale-105 active:scale-95",
          isActive
            ? "bg-primary text-primary-foreground [&_svg]:text-primary-foreground [&_span]:text-primary-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:shadow-md hover:shadow-accent/20",
          isCollapsed ? "justify-center h-[32px] w-[32px]" : "justify-start h-[32px] px-[9.7px]",
        )}
        iconSize={16.2}
        isCollapsed={Boolean(isCollapsed)}
      />
    );
  }

  const content = (
    <>
      <div className={cn(
        "flex items-center justify-center safari-icon-fix",
        isCollapsed ? "w-[32px] h-[32px] mx-auto" : "w-[21px] h-[21px]",
        isSettingsLink ? "safari-settings-icon" : "",
        href === "/settings" || href.includes("settings") ? "settings-icon-container" : "",
        href === "/notifications" ? "notifications-icon-container" : ""
      )}>
        {customIcon ? customIcon : avatarUrl ? (
          <MenuAvatar className="h-7 w-7">
            <MenuAvatarImage src={avatarUrl} alt={title} />
            <MenuAvatarFallback>
              {title.split(' ').map(word => word[0]).join('').toUpperCase()}
            </MenuAvatarFallback>
          </MenuAvatar>
        ) : Icon && (
          <Icon className="h-[16.2px] w-[16.2px] shrink-0" />
        )}
      </div>
      
      <div
        className={cn(
          "flex flex-col min-w-0",
          isCollapsed ? "hidden" : "flex"
        )}
        style={{ fontSize: '11.3px' }}
      >
        <span className="truncate">{title}</span>
        {subtitle && (
          <span className={cn(
            "truncate",
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
    <Link
      ref={linkRef}
      href={href}
      className={cn(
        className,
        "flex items-center rounded-md text-sm transition-all duration-200 relative group hover:scale-105 active:scale-95",
        isActive
          ? "bg-primary text-primary-foreground [&_svg]:text-primary-foreground [&_span]:text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:shadow-md hover:shadow-accent/20",
        isCollapsed ? "justify-center h-[32px] w-[32px]" : "justify-start h-[32px]",
        isSettingsLink ? "safari-settings-link" : ""
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
    </Link>
  )

  return linkContent
} 