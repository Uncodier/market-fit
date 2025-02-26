"use client"

import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"
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
  children
}: MenuItemProps) {
  const content = (
    <>
      {customIcon ? customIcon : avatarUrl ? (
        <MenuAvatar className="h-8 w-8">
          <MenuAvatarImage src={avatarUrl} alt={title} />
          <MenuAvatarFallback>
            {title.split(' ').map(word => word[0]).join('').toUpperCase()}
          </MenuAvatarFallback>
        </MenuAvatar>
      ) : Icon && (
        <Icon className="h-5 w-5 shrink-0" />
      )}
      
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
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors relative group",
        isActive
          ? "bg-[#282828] text-white [&_svg]:text-white [&_span]:text-white"
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-900",
        isCollapsed && "justify-center"
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
              className="flex flex-col gap-1 bg-white border border-gray-200 shadow-lg"
              sideOffset={5}
            >
              <p className="font-medium">{title}</p>
              {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
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