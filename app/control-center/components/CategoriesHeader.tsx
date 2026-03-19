"use client"

import { cn } from "@/lib/utils"
import { useLocalization } from "@/app/context/LocalizationContext"

import { SearchInput } from "@/app/components/ui/search-input"

interface CategoriesHeaderProps {
  isDarkMode?: boolean
  isCollapsed?: boolean
  searchQuery?: string
  onSearchChange?: (value: string) => void
}

export function CategoriesHeader({
  isDarkMode = false,
  isCollapsed = false,
  searchQuery = "",
  onSearchChange
}: CategoriesHeaderProps) {
  const { t } = useLocalization()

  return (
    <div className={cn(
      "flex items-center justify-between h-[71px] border-b transition-all duration-300 flex-shrink-0 px-6 gap-4",
      "fixed z-[999] bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/80",
      isCollapsed ? "w-0 opacity-0 px-0" : "w-[319px]"
    )}>
      {onSearchChange && !isCollapsed && (
        <SearchInput 
          placeholder={t('controlCenter.search') === 'controlCenter.search' ? 'Search tasks...' : t('controlCenter.search')} 
          className="bg-background border-border focus:border-muted-foreground/20 focus:ring-muted-foreground/20" 
          value={searchQuery}
          onSearch={onSearchChange}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      )}
    </div>
  )
} 