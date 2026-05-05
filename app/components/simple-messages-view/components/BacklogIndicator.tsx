import React from 'react'
import { CheckCircle, ChevronUp, ChevronDown, ListTodo } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"

interface BacklogItem {
  id: string
  title: string
  status: string // 'done', 'in_progress', 'pending'
  kind?: string
  tier?: string
  acceptance?: string[]
}

interface BacklogData {
  items: BacklogItem[]
}

interface BacklogIndicatorProps {
  backlog: BacklogData | string
  expanded: boolean
  onToggleExpanded: () => void
}

export const BacklogIndicator: React.FC<BacklogIndicatorProps> = ({
  backlog,
  expanded,
  onToggleExpanded,
}) => {
  // Parse backlog if it's a string
  let parsedBacklog: BacklogData | null = null
  if (typeof backlog === 'string') {
    try {
      parsedBacklog = JSON.parse(backlog)
    } catch (e) {
      console.error('Failed to parse backlog JSON', e)
    }
  } else {
    parsedBacklog = backlog
  }

  const items = parsedBacklog?.items || []
  if (items.length === 0) return null

  const sortedItems = [...items].sort((a, b) => {
    const getScore = (status: string) => {
      if (status === 'in_progress' || status === 'in-progress') return 0;
      if (status === 'done' || status === 'completed') return 2;
      return 1; // pending/others
    };
    const scoreA = getScore(a.status);
    const scoreB = getScore(b.status);
    if (scoreA !== scoreB) return scoreA - scoreB;
    // preserve original order if same status
    return items.indexOf(a) - items.indexOf(b);
  });
  const allCompleted = items.length > 0 && items.every(item => item.status === 'done' || item.status === 'completed')

  return (
    <div className="step-indicator-root flex-none w-full mb-4 shrink-0">
      <div className="mx-auto" style={{ width: '100%', maxWidth: '800px' }}>
        <div className="rounded-lg backdrop-blur-md border shadow-lg transition-all duration-500 bg-background/80 dark:bg-background/80 dark:border-white/10 border-black/10">
        <div style={{padding: '0.75rem'}}>
          {expanded ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ListTodo className="h-4 w-4" />
                  <span className="font-medium">Requirement Backlog</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggleExpanded}
                  className="h-6 w-6 p-0 hover:bg-muted"
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {allCompleted ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="font-medium whitespace-nowrap text-green-600">All backlog items completed!</span>
                  </>
                ) : (
                  <>
                    <span className="font-medium whitespace-nowrap">
                      {items.filter(i => i.status === 'done' || i.status === 'completed').length} / {items.length} done
                    </span>
                  </>
                )}
              </div>

              {!allCompleted && (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {sortedItems.map((item, index) => {
                    const isCompleted = item.status === 'done' || item.status === 'completed'
                    const isInProgress = item.status === 'in_progress' || item.status === 'in-progress'
                    
                    return (
                      <div 
                        key={item.id} 
                        className={`text-sm py-1.5 px-2 rounded-md flex items-center justify-between ${
                          isInProgress 
                            ? 'bg-muted border border-border dark:border-white/5' 
                            : 'hover:bg-muted/50 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden mr-2">
                          {isCompleted ? (
                            <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                          ) : isInProgress ? (
                            <div className="h-3.5 w-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin flex-shrink-0" />
                          ) : (
                            <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />
                          )}
                          <span className={`truncate ${isCompleted ? 'text-muted-foreground line-through' : isInProgress ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                            {item.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {item.kind && (
                            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-muted-foreground/10 text-muted-foreground font-medium">
                              {item.kind}
                            </span>
                          )}
                          {!isCompleted && (
                            <span className={`text-xs ${isInProgress ? 'text-primary' : 'text-muted-foreground'}`}>
                              {isInProgress ? 'In Progress' : 'Pending'}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <div 
              className="flex items-center justify-between cursor-pointer"
              onClick={onToggleExpanded}
            >
              <div className="flex items-center gap-2 overflow-hidden text-sm">
                {allCompleted ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="font-medium text-green-600 truncate">All backlog items completed</span>
                  </>
                ) : (
                  <>
                    {(sortedItems[0]?.status === 'in_progress' || sortedItems[0]?.status === 'in-progress') ? (
                      <span className="truncate font-medium text-foreground">{sortedItems[0].title}</span>
                    ) : (
                      <span className="font-medium whitespace-nowrap text-foreground flex-shrink-0">
                        Requirement Backlog
                      </span>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <span>{items.filter(i => i.status === 'done' || i.status === 'completed').length}</span>
                  <span>/</span>
                  <span>{items.length}</span>
                  <span className="hidden sm:inline ml-1">done</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-muted"
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  )
}
