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
          "rounded-md px-3 py-2 text-sm transition-colors relative group",
          isActive
            ? "bg-primary text-primary-foreground [&_svg]:text-primary-foreground [&_span]:text-primary-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          isCollapsed ? "justify-center" : "justify-start"
        )}
        iconSize={25}
      />
    );
  }

  const content = (
    <>
      <div className={cn(
        "flex items-center justify-center safari-icon-fix",
        isCollapsed ? "w-[35px]" : "w-[23px]",
        "h-[23px]",
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
          <Icon className="h-[18px] w-[18px] shrink-0" />
        )}
      </div>
      
      <div
        className={cn(
          "flex flex-col min-w-0",
          isCollapsed ? "hidden" : "flex"
        )}
        style={{ fontSize: '12.6px' }}
      >
        <span className="truncate">{title}</span>
        {subtitle && (
          <span className={cn(
            "truncate",
            isActive ? "text-white/70" : "text-gray-400"
          )}
          style={{ fontSize: '10.8px' }}
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
        "flex items-center rounded-md text-sm transition-colors relative group",
        isActive
          ? "bg-primary text-primary-foreground [&_svg]:text-primary-foreground [&_span]:text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        isCollapsed ? "justify-center h-[35px] w-[35px]" : "justify-start h-[35px]",
        isSettingsLink ? "safari-settings-link" : ""
      )}
      style={{ 
        paddingLeft: isCollapsed ? '0px' : '10.8px', 
        paddingRight: isCollapsed ? '0px' : '10.8px', 
        paddingTop: isCollapsed ? '0px' : '7.2px', 
        paddingBottom: isCollapsed ? '0px' : '7.2px',
        gap: isCollapsed ? '0px' : '10.8px',
        fontSize: '12.6px'
      }}
      onClick={onClick}
    >
      {isCollapsed ? (
        <>
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>{content}</div>
              </TooltipTrigger>
              <TooltipContent 
                side="right" 
                align="start" 
                className="flex flex-col gap-1 bg-popover text-popover-foreground border-border shadow-lg"
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