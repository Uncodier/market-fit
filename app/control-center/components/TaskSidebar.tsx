"use client"

import { ScrollArea } from "@/app/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { Category } from "@/app/types"
import { Badge } from "@/app/components/ui/badge"
import { useTheme } from "@/app/context/ThemeContext"
import { 
  Check, 
  Tag, 
  Globe, 
  Play, 
  Users, 
  Mail, 
  Phone, 
  DollarSign, 
  FileText, 
  CreditCard, 
  NetworkTree, 
  MessageCircle, 
  Microscope, 
  Rocket, 
  Archive, 
  Ticket, 
  Lock, 
  GraduationCap, 
  Briefcase, 
  RotateCcw, 
  BarChart, 
  Star, 
  Info, 
  Printer, 
  BookOpen, 
  LinkIcon,
  Folder
} from "@/app/components/ui/icons"

import { EmptyCard } from "@/app/components/ui/empty-card"
import { useLocalization } from "@/app/context/LocalizationContext"
const TYPE_ICONS: Record<string, React.ComponentType<any>> = {
  website_visit: Globe,
  demo: Play,
  meeting: Users,
  email: Mail,
  call: Phone,
  quote: DollarSign,
  contract: FileText,
  payment: CreditCard,
  referral: NetworkTree,
  feedback: MessageCircle,
  trial: Microscope,
  onboarding: Rocket,
  refund: Archive,
  ticket: Ticket, // Needs to be added or use an alternative if not present in icons.tsx. Let's use File
  kyc: Lock,
  training: GraduationCap,
  consultation: Briefcase,
  follow_up: RotateCcw,
  survey: BarChart,
  review: Star,
  support: Info,
  billing: Printer,
  documentation: BookOpen,
  integration: LinkIcon
}

// Function to get icon for task type with fallback
const getTypeIcon = (type: string) => {
  return TYPE_ICONS[type] || FileText
}

// Function to get category icon with fallback
const getCategoryIcon = (category: Category): React.ComponentType<any> => {
  return Folder
}

type StatusFilterType = 'all' | 'new' | 'completed'

interface TaskSidebarProps {
  categories: Category[]
  taskTypes: string[]
  selectedItem: string
  onSelectItem: (id: string) => void
  taskCountByCategory: Record<string, number>
  taskCountByType: Record<string, number>
  isCollapsed: boolean
}

export function TaskSidebar({
  categories,
  taskTypes,
  selectedItem,
  onSelectItem,
  taskCountByCategory,
  taskCountByType,
  isCollapsed
}: TaskSidebarProps) {
  const { isDarkMode } = useTheme()
  const { t } = useLocalization()

  // Calculate total tasks from taskCountByType since a task can only have one type
  const totalTasks = Object.values(taskCountByType).reduce((sum, count) => sum + count, 0)

  return (
    <div className={cn(
      "h-full transition-all duration-300 ease-in-out",
      !isDarkMode && "border-r",
      isCollapsed ? "w-0 opacity-0" : "w-[319px]",
      "bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60",
      // Scoped class for Safari-specific fixes
      "task-sidebar"
    )}>
      <div className="h-[calc(100vh-var(--topbar-height,64px))] overflow-hidden">
        <ScrollArea className="h-full" style={{ minHeight: 'calc(100vh - var(--topbar-height, 64px))' }}>
          <div className={cn(
            "w-[319px] transition-all duration-300 ease-in-out py-2",
            isCollapsed ? "opacity-0" : "opacity-100"
          )}>

            {/* Show single empty state if no categories and no task types */}
            {categories.length === 0 && taskTypes.length === 0 ? (
              <div className="h-[calc(100vh-135px)] flex items-center justify-center p-4">
                <EmptyCard 
                  icon={<Tag className="h-8 w-8 text-muted-foreground" />}
                  title={t('controlCenter.sidebar.empty.title') || "No task organization"}
                  description={t('controlCenter.sidebar.empty.desc') || "Create categories or different task types to organize your work better."}
                  variant="fancy"
                  showShadow={false}
                  contentClassName="py-8"
                />
              </div>
            ) : (
              <>
                {/* Categories Section */}
                {categories.length > 0 && (
                  <div className="task-categories-list" style={{ padding: '3.6px' }}>
                    <div className="space-y-0.5">
                      {categories.map((category) => (
                        <button
                          key={category.id}
                          onClick={() => onSelectItem(`category-${category.id}`)}
                          className={cn(
                            "w-full text-left rounded-md transition-colors",
                            selectedItem === `category-${category.id}`
                              ? "bg-primary/15 text-primary"
                              : "hover:bg-accent/20"
                          )}
                          style={{ 
                            paddingTop: '7.2px', 
                            paddingBottom: '7.2px', 
                            paddingLeft: '10.8px', 
                            paddingRight: '10.8px',
                            fontSize: '12.6px'
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center" style={{ gap: '7.2px' }}>
                              {(() => {
                                const Icon = getCategoryIcon(category)
                                return <Icon className="text-muted-foreground" size={16} />
                              })()}
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
                  <div className="task-types-list" style={{ padding: '3.6px' }}>
                    <div style={{ paddingLeft: '10.8px', paddingRight: '10.8px', paddingTop: '14.4px', paddingBottom: '7.2px' }}>
                      <div className="flex items-center text-xs font-medium text-muted-foreground uppercase tracking-wider" style={{ gap: '7.2px', fontSize: '10.8px' }}>
                        <span>{t('controlCenter.sidebar.taskTypes') || 'Task Types'}</span>
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      {/* All Tasks button */}
                      <button
                        onClick={() => onSelectItem("all")}
                        className={cn(
                          "w-full text-left rounded-md transition-colors",
                          selectedItem === "all"
                            ? "bg-primary/15 text-primary"
                            : "hover:bg-accent/20"
                        )}
                        style={{ 
                          paddingTop: '7.2px', 
                          paddingBottom: '7.2px', 
                          paddingLeft: '10.8px', 
                          paddingRight: '10.8px',
                          fontSize: '12.6px'
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center" style={{ gap: '7.2px' }}>
                            <Check className="h-4 w-4" style={{ height: '14.4px', width: '14.4px' }} />
                            <span>{t('controlCenter.sidebar.allTasks') || 'All Tasks'}</span>
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
                            "w-full text-left rounded-md transition-colors",
                            selectedItem === `type-${type}`
                              ? "bg-primary/15 text-primary"
                              : "hover:bg-accent/20"
                          )}
                          style={{ 
                            paddingTop: '7.2px', 
                            paddingBottom: '7.2px', 
                            paddingLeft: '10.8px', 
                            paddingRight: '10.8px',
                            fontSize: '12.6px'
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center" style={{ gap: '7.2px' }}>
                              {(() => {
                                const Icon = getTypeIcon(type)
                                return <Icon className="text-muted-foreground" size={16} />
                              })()}
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