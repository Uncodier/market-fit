"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu"
import { MenuAvatar, MenuAvatarFallback } from "../ui/menu-avatar"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"
import { useSite, Site } from "@/app/context/SiteContext"

interface SiteSelectorProps {
  isCollapsed?: boolean
}

export function SiteSelector({ 
  isCollapsed 
}: SiteSelectorProps) {
  const { sites, currentSite, setCurrentSite } = useSite()
  
  const getInitials = (name: string) => {
    const words = name.split(" ")
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
    return (words[0][0] + words[1][0]).toUpperCase()
  }

  return (
    <div className={cn(!isCollapsed && "w-full")}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors relative group cursor-pointer",
            !isCollapsed && "border border-gray-200 hover:border-gray-300 hover:bg-gray-50 w-full",
            isCollapsed && "justify-center"
          )}>
            <MenuAvatar className="h-8 w-8">
              <MenuAvatarFallback>
                {getInitials(currentSite.name)}
              </MenuAvatarFallback>
            </MenuAvatar>
            
            {!isCollapsed && (
              <div className="flex flex-col min-w-0 flex-1">
                <span className="font-medium truncate">{currentSite.name}</span>
                <span className="text-xs text-gray-400 truncate">
                  {currentSite.domain}
                </span>
              </div>
            )}
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align={isCollapsed ? "start" : "center"}
          sideOffset={5}
          className={cn(
            "p-1",
            isCollapsed ? "w-[240px]" : "w-[231px]"
          )}
        >
          {sites.map((site) => {
            const isSelected = site.id === currentSite.id;
            return (
              <DropdownMenuItem
                key={site.id}
                className={cn(
                  "flex items-center gap-2 p-2 w-full",
                  isSelected && "bg-gray-50"
                )}
                onClick={() => setCurrentSite(site)}
              >
                <MenuAvatar className="h-6 w-6 flex-shrink-0">
                  <MenuAvatarFallback className="text-xs">
                    {getInitials(site.name)}
                  </MenuAvatarFallback>
                </MenuAvatar>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-sm font-medium truncate">{site.name}</span>
                  <span className="text-xs text-gray-500 truncate">{site.domain}</span>
                </div>
                {isSelected && (
                  <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                )}
              </DropdownMenuItem>
            );
          })}
          
          <div className="h-px bg-gray-100 my-1" />
          
          <DropdownMenuItem
            className="flex items-center gap-2 p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 w-full"
            onClick={() => {
              // Aquí iría la lógica para añadir un nuevo sitio
              alert("Añadir nuevo sitio")
            }}
          >
            <div className="h-6 w-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <span className="text-sm font-medium flex-1">Añadir nuevo sitio</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
} 