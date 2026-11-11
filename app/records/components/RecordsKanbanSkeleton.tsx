import { Card, CardContent } from "@/app/components/ui/card"
import { Skeleton } from "@/app/components/ui/skeleton"

export function RecordsKanbanSkeleton() {
  return (
    <div className="w-full min-w-0 overflow-x-auto overflow-y-hidden pb-4">
      <div className="flex gap-4 min-w-max px-4 md:px-8 pb-4 items-stretch justify-start min-h-[calc(100vh-220px)] after:content-[''] after:w-px after:shrink-0">
        {Array.from({ length: 3 }).map((_, colIndex) => (
          <div key={colIndex} className="flex-shrink-0 w-80 flex flex-col max-h-full">
            <div className="flex items-center justify-between mb-4 flex-none px-1">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-6 rounded-full" />
              </div>
              <Skeleton className="h-4 w-12" />
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 px-1 pb-4">
              {Array.from({ length: 4 }).map((_, cardIndex) => (
                <Card key={cardIndex} className="bg-card shadow-sm border-border cursor-default">
                  <CardContent className="p-3">
                    <div className="flex gap-2">
                      <div className="pt-0.5">
                        <Skeleton className="h-4 w-4 rounded" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <div className="flex-1 min-w-0 space-y-1.5 mt-0.5">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-3 w-2/3" />
                          </div>
                          <Skeleton className="h-5 w-16 rounded-full shrink-0" />
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <Skeleton className="h-5 w-20 rounded-full" />
                          <div className="flex items-center gap-1.5">
                            <Skeleton className="h-3 w-16" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

