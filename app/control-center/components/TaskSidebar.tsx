"use client"

import { ScrollArea } from "@/app/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { Category } from "@/app/types"
import { Badge } from "@/app/components/ui/badge"
import { CategoriesHeader } from "./CategoriesHeader"
import { useTheme } from "@/app/context/ThemeContext"
import { Check, Tag } from "@/app/components/ui/icons"
import { EmptyCard } from "@/app/components/ui/empty-card"

// Emoji mapping for task types
const TYPE_EMOJIS: Record<string, string> = {
  website_visit: "🌐",
  demo: "🎮",
  meeting: "👥",
  email: "📧",
  call: "📞",
  quote: "💰",
  contract: "📝",
  payment: "💳",
  referral: "🤝",
  feedback: "💭",
  trial: "🔬",
  onboarding: "🚀",
  refund: "💸",
  ticket: "🎫",
  kyc: "🔐",
  training: "🎓",
  consultation: "👨‍💼",
  follow_up: "🔄",
  survey: "📊",
  review: "⭐",
  support: "🆘",
  billing: "🧾",
  documentation: "📚",
  integration: "🔗"
}

// Function to get emoji for task type with fallback
const getTypeEmoji = (type: string): string => {
  return TYPE_EMOJIS[type] || "📋"
}

// Function to get category icon with fallback
const getCategoryIcon = (category: Category): string => {
  return category.icon || "📁"
}

interface TaskSidebarProps {
  categories: Category[]
  taskTypes: string[]
  selectedItem: string
  onSelectItem: (id: string) => void
  taskCountByCategory: Record<string, number>
  taskCountByType: Record<string, number>
  isCollapsed: boolean
  searchQuery: string
  onSearchChange: (value: string) => void
}

export function TaskSidebar({
  categories,
  taskTypes,
  selectedItem,
  onSelectItem,
  taskCountByCategory,
  taskCountByType,
  isCollapsed,
  searchQuery,
  onSearchChange
}: TaskSidebarProps) {
  const { isDarkMode } = useTheme()

  // Calculate total tasks from taskCountByType since a task can only have one type
  const totalTasks = Object.values(taskCountByType).reduce((sum, count) => sum + count, 0)

  return (
    <div className={cn(
      "h-full transition-all duration-200 ease-in-out",
      !isDarkMode && "border-r",
      isCollapsed ? "w-0 opacity-0" : "w-[319px]"
    )}>
      <CategoriesHeader 
        isDarkMode={isDarkMode} 
        isCollapsed={isCollapsed}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
      />
      <div className="h-[calc(100vh-64px)] overflow-hidden pt-[71px]">
        <ScrollArea className={cn(
          "h-full bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60"
        )}>
          <div className={cn(
            "w-[319px] transition-all duration-200 ease-in-out",
            isCollapsed ? "opacity-0" : "opacity-100"
          )}>
            {/* Show single empty state if no categories and no task types */}
            {categories.length === 0 && taskTypes.length === 0 ? (
              <div className="h-[calc(100vh-135px)] flex items-center justify-center p-4">
                <EmptyCard 
                  icon={<Tag className="h-8 w-8 text-muted-foreground" />}
                  title="No task organization"
                  description="Create categories or different task types to organize your work better."
                  variant="fancy"
                  showShadow={false}
                  contentClassName="py-8"
                />
              </div>
            ) : (
              <>
                {/* Categories Section */}
                {categories.length > 0 && (
                  <div className="p-1">
                    <div className="space-y-0.5">
                      {categories.map((category) => (
                        <button
                          key={category.id}
                          onClick={() => onSelectItem(`category-${category.id}`)}
                          className={cn(
                            "w-full text-left py-2 px-3 rounded-md transition-colors text-sm",
                            selectedItem === `category-${category.id}`
                              ? "bg-primary/15 text-primary"
                              : "hover:bg-accent/20"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{getCategoryIcon(category)}</span>
                              <span>{category.name}</span>
                            </div>
                            <Badge variant="outline">
                              {taskCountByCategory[category.id] || 0}
                            </Badge>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Types Section */}
                {taskTypes.length > 0 && (
                  <div className="p-1">
                    <div className="px-3 py-2">
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        <span>Task Types</span>
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      {/* All Tasks button */}
                      <button
                        onClick={() => onSelectItem("all")}
                        className={cn(
                          "w-full text-left py-2 px-3 rounded-md transition-colors text-sm",
                          selectedItem === "all"
                            ? "bg-primary/15 text-primary"
                            : "hover:bg-accent/20"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4" />
                            <span>All Tasks</span>
                          </div>
                          <Badge variant="outline">
                            {totalTasks}
                          </Badge>
                        </div>
                      </button>

                      {taskTypes.map((type) => (
                        <button
                          key={type}
                          onClick={() => onSelectItem(`type-${type}`)}
                          className={cn(
                            "w-full text-left py-2 px-3 rounded-md transition-colors text-sm",
                            selectedItem === `type-${type}`
                              ? "bg-primary/15 text-primary"
                              : "hover:bg-accent/20"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{getTypeEmoji(type)}</span>
                              <span className="capitalize">{type.replace('_', ' ')}</span>
                            </div>
                            <Badge variant="outline">
                              {taskCountByType[type] || 0}
                            </Badge>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
} 