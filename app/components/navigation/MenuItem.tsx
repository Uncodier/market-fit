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
  className
}: MenuItemProps) {
  const content = (
    <>
      <div className={cn(
        "flex items-center justify-center",
        isCollapsed ? "w-full" : "w-auto"
      )}>
        {customIcon ? customIcon : avatarUrl ? (
          <MenuAvatar className="h-8 w-8">
            <MenuAvatarImage src={avatarUrl} alt={title} />
            <MenuAvatarFallback>
              {title.split(' ').map(word => word[0]).join('').toUpperCase()}
            </MenuAvatarFallback>
          </MenuAvatar>
        ) : Icon && (
          <Icon className="h-[25px] w-[25px] shrink-0" />
        )}
      </div>
      
      <div
        className={cn(
          "flex flex-col min-w-0",
          isCollapsed ? "hidden" : "flex"
        )}
      >
        <span className="truncate">{title}</span>
        {subtitle && (
          <span className={cn(
            "text-xs truncate",
            isActive ? "text-white/70" : "text-gray-400"
          )}>
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
      href={href}
      className={cn(
        className,
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors relative group",
        isActive
          ? "bg-primary text-primary-foreground [&_svg]:text-primary-foreground [&_span]:text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        isCollapsed ? "justify-center h-[39px]" : "justify-start h-[39px]"
      )}
    >
      {isCollapsed ? (
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
      ) : (
        content
      )}
    </Link>
  )

  return linkContent
} 