import { useScopedPreviewState } from "../hooks/useScopedPreviewState"
import { buildPreviewRequests, mergePreviewRequests, fieldPreviewKey, fetchPreviewBatches } from "../lib/entity-preview-request"
import { useState, useEffect } from "react"
import { RecordCategory, RecordItem, resolveRelationsForSidebar } from "../actions"
import { Button } from "@/app/components/ui/button"
import { Folder, Settings, Plus, ChevronRight, ChevronDown, FileText, Users, Building, Briefcase, Megaphone, CheckSquare, Banknote, ShoppingCart, Quotes, Trash2 } from "@/app/components/ui/icons"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { Skeleton } from "@/app/components/ui/skeleton"
import { useLocalization } from "@/app/context/LocalizationContext"
import { getCategoryIconComponent, isEmojiIcon } from "./category-icon"

interface RecordsSidebarProps {
  categories: RecordCategory[]
  records: RecordItem[]
  selectedCategory: string
  selectedRelation: { fieldName: string, targetId: string } | null
  onSelectCategory: (id: string, relation: { fieldName: string, targetId: string } | null) => void
  isCollapsed: boolean
  onEditTemplate?: (category: RecordCategory) => void
  onCreateCategory?: () => void
  onOpenTrash?: () => void
}

const getIcon = (target: string) => {
  switch (target) {
    case 'lead': return <Users className="h-3.5 w-3.5" />
    case 'company': return <Building className="h-3.5 w-3.5" />
    case 'deal': return <Briefcase className="h-3.5 w-3.5" />
    case 'team_member': return <Users className="h-3.5 w-3.5" />
    case 'campaign': return <Megaphone className="h-3.5 w-3.5" />
    case 'content': return <FileText className="h-3.5 w-3.5" />
    case 'task': return <CheckSquare className="h-3.5 w-3.5" />
    case 'sale': return <Banknote className="h-3.5 w-3.5" />
    case 'purchase': return <ShoppingCart className="h-3.5 w-3.5" />
    case 'quotation': return <Quotes className="h-3.5 w-3.5" />
    case 'record': return <FileText className="h-3.5 w-3.5" />
    default: return <FileText className="h-3.5 w-3.5" />
  }
}

function CategoryItem({
  category,
  records,
  selectedCategory,
  selectedRelation,
  onSelectCategory,
  onEditTemplate
}: {
  category: RecordCategory
  records: RecordItem[]
  selectedCategory: string
  selectedRelation: { fieldName: string, targetId: string } | null
  onSelectCategory: (id: string, relation: { fieldName: string, targetId: string } | null) => void
  onEditTemplate?: (category: RecordCategory) => void
}) {
  const { t } = useLocalization()
  const [isExpanded, setIsExpanded] = useState(selectedCategory === category.id)
  const [expandedRelations, setExpandedRelations] = useState<Record<string, boolean>>(() => {
    // Si hay una relación seleccionada para esta categoría, la expandimos por defecto
    if (selectedCategory === category.id && selectedRelation) {
      return { [selectedRelation.fieldName]: true }
    }
    return {}
  })
  const [resolvedNames, setResolvedNames] = useScopedPreviewState<Record<string, string>>(category.site_id, {})
  const [isLoading, setIsLoading] = useState(false)

  // Find relation fields in this category
  const relationFields = (category.template_fields || []).filter((f: any) => f.type === 'relation')

  // Find unique target IDs used in records for this category
  const categoryRecords = records.filter(r => r.category_id === category.id)
  
  const relationsTree: Record<string, { fieldName: string, target: string, entityIds: Set<string> }> = {}
  
  relationFields.forEach((field: any) => {
    const ids = new Set<string>()
    categoryRecords.forEach(r => {
      const targetId = r.relations?.[field.name]
      if (targetId) ids.add(targetId)
    })
    
    if (ids.size > 0) {
      relationsTree[field.id] = {
        fieldName: field.name,
        target: field.relationTarget || 'lead',
        entityIds: ids
      }
    }
  })

  useEffect(() => {
    let active = true
    setResolvedNames({})
    setIsLoading(false)
    const fetchNames = async () => {
      const entitiesToResolve = categoryRecords.flatMap(record =>
        buildPreviewRequests(relationFields, record.relations || {}))
      if (entitiesToResolve.length > 0 && category.site_id) {
        setIsLoading(true)
        const names = await fetchPreviewBatches(mergePreviewRequests(entitiesToResolve), category.site_id, resolveRelationsForSidebar)
        if (active) { setResolvedNames(names); setIsLoading(false) }
      }
    }
    if (isExpanded) void fetchNames()
    return () => { active = false }
  }, [isExpanded, records, category])

  const toggleRelation = (fieldName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedRelations(prev => ({ ...prev, [fieldName]: !prev[fieldName] }))
  }

  const hasSubfolders = Object.keys(relationsTree).length > 0
  const isSelected = selectedCategory === category.id && !selectedRelation

  return (
    <div>
      <div className="group relative flex items-center mb-[2px]">
        <Button
          variant={isSelected ? "secondary" : "ghost"}
          className="w-full min-w-0 max-w-full justify-start relative pr-10 pl-2"
          title={category.name}
          style={{
            height: '31.5px',
            fontSize: '11.3px'
          }}
          onClick={() => {
            setIsExpanded(true)
            onSelectCategory(category.id, null)
          }}
        >
          {(() => {
            const IconComponent = getCategoryIconComponent(category.icon)
            if (IconComponent) {
              return <IconComponent className="mr-[6.5px] h-3.5 w-3.5 text-muted-foreground shrink-0" />
            }
            if (isEmojiIcon(category.icon)) {
              return <span className="mr-[6.5px] text-sm leading-none shrink-0 flex items-center justify-center h-3.5 w-3.5">{category.icon}</span>
            }
            return <Folder className="mr-[6.5px] h-3.5 w-3.5 text-muted-foreground shrink-0" />
          })()}
          <span className="min-w-0 truncate flex-1 text-left">{category.name}</span>
          
          {hasSubfolders && (
            <div 
              className="flex items-center justify-center cursor-pointer hover:bg-muted/50 rounded-md h-5 w-5 shrink-0 ml-1"
              onClick={(e) => {
                e.stopPropagation()
                setIsExpanded(!isExpanded)
              }}
            >
              {isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            </div>
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 opacity-0 group-hover:opacity-100 h-6 w-6 z-10"
          aria-label={`Edit template: ${category.name}`}
          onClick={(e) => {
            e.stopPropagation()
            onEditTemplate?.(category)
          }}
        >
          <Settings className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>

      {isExpanded && hasSubfolders && (
        <div className="pl-4 border-l ml-[14px] pr-2 mt-1 border-border/50">
          {isLoading ? (
            <div className="pl-4 py-2 space-y-2">
              <Skeleton className="h-4 w-3/4 rounded-sm" />
              <Skeleton className="h-4 w-2/3 rounded-sm" />
              <Skeleton className="h-4 w-1/2 rounded-sm" />
            </div>
          ) : (
            Object.values(relationsTree).map(tree => {
              const isRelExpanded = expandedRelations[tree.fieldName] || false

              return (
                <div key={tree.fieldName}>
                  <div className="group flex items-center mb-[2px]">
                    <Button
                      variant="ghost"
                      className="w-full min-w-0 max-w-full justify-start pl-2 pr-2 relative"
                      title={tree.fieldName}
                      style={{
                        height: '31.5px',
                        fontSize: '11.3px'
                      }}
                      onClick={(e) => toggleRelation(tree.fieldName, e)}
                    >
                      <Folder className="mr-[6.5px] h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="min-w-0 truncate flex-1 text-left">{tree.fieldName}</span>
                      <div 
                        className="flex items-center justify-center cursor-pointer hover:bg-muted/50 rounded-md h-5 w-5 shrink-0 ml-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleRelation(tree.fieldName, e);
                        }}
                      >
                        {isRelExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                      </div>
                    </Button>
                  </div>

                  {isRelExpanded && (
                    <div className="pl-4">
                      {Array.from(tree.entityIds).map(entityId => {
                        const isEntitySelected = selectedCategory === category.id && 
                                                 selectedRelation?.fieldName === tree.fieldName && 
                                                 selectedRelation?.targetId === entityId
                        const entityName = resolvedNames[fieldPreviewKey(relationFields.find(field => field.name === tree.fieldName)!, entityId)] || (t("records.sidebar.unnamed") || 'Unnamed')
                        
                        return (
                          <div key={entityId} className="flex items-center mb-[2px]">
                            <Button
                              variant={isEntitySelected ? "secondary" : "ghost"}
                              className="w-full min-w-0 max-w-full justify-start pl-2"
                              title={entityName}
                              style={{
                                height: '31.5px',
                                fontSize: '11.3px'
                              }}
                              onClick={() => onSelectCategory(category.id, { fieldName: tree.fieldName, targetId: entityId })}
                            >
                              <span className="mr-[6.5px] text-muted-foreground shrink-0 flex items-center justify-center">
                                {getIcon(tree.target)}
                              </span>
                              <span className="min-w-0 truncate flex-1 text-left">{entityName}</span>
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

export function RecordsSidebar({
  categories,
  records,
  selectedCategory,
  selectedRelation,
  onSelectCategory,
  isCollapsed,
  onEditTemplate,
  onCreateCategory,
  onOpenTrash
}: RecordsSidebarProps) {
  const { t } = useLocalization()

  if (isCollapsed) return null

  return (
    <div className="h-full w-full min-w-0 flex flex-col bg-background border-r border-border">
      <div className="h-[71px] px-4 border-b border-border flex justify-end items-center gap-2 shrink-0">
        <Button 
          variant="secondary" 
          size="icon" 
          className="h-8 w-8 shrink-0 rounded-full"
          onClick={onCreateCategory}
          title={t("records.sidebar.newCategory") || "New Category"}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 min-w-0 p-4 [&_[data-radix-scroll-area-viewport]>div]:!block">
        <div>
          <Button
            variant={selectedCategory === "all" ? "secondary" : "ghost"}
            className="w-full min-w-0 max-w-full justify-start font-medium pl-2"
            style={{
              height: '31.5px',
              fontSize: '11.3px',
              marginBottom: '6.5px'
            }}
            onClick={() => onSelectCategory("all", null)}
          >
            <Folder className="mr-[6.5px] h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="min-w-0 truncate flex-1 text-left">{t("records.sidebar.allRecords") || "All Records"}</span>
          </Button>

          <div className="space-y-0">
            {categories.filter(c => !c.parent_category_id).map(category => (
              <div key={category.id}>
                <CategoryItem
                  category={category}
                  records={records}
                  selectedCategory={selectedCategory}
                  selectedRelation={selectedRelation}
                  onSelectCategory={onSelectCategory}
                  onEditTemplate={onEditTemplate}
                />
                
                {/* Child categories */}
                {categories.filter(c => c.parent_category_id === category.id).length > 0 && (
                  <div className="pl-4 border-l ml-[14px] my-1 border-border/50">
                    {categories.filter(c => c.parent_category_id === category.id).map(childCategory => (
                      <CategoryItem
                        key={childCategory.id}
                        category={childCategory}
                        records={records}
                        selectedCategory={selectedCategory}
                        selectedRelation={selectedRelation}
                        onSelectCategory={onSelectCategory}
                        onEditTemplate={onEditTemplate}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>
      {onOpenTrash && <div className="p-4 border-t">
        <Button variant="ghost" className="w-full justify-start" onClick={onOpenTrash}>
          <Trash2 className="mr-2 h-4 w-4" />Trash
        </Button>
      </div>}
    </div>
  )
}