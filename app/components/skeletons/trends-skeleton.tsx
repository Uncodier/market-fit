import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Skeleton } from "../ui/skeleton"

// Individual Trend Card Skeleton
export function TrendCardSkeleton() {
  return (
    <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-6 w-6 rounded" />
            <Skeleton className="h-6 w-6 rounded" />
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Description */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          
          {/* Stats */}
          <div className="flex items-center gap-4 pt-2">
            <div className="flex items-center gap-1">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-8" />
            </div>
            <div className="flex items-center gap-1">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-12" />
            </div>
            <div className="flex items-center gap-1">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-10" />
            </div>
          </div>
          
          {/* Tags */}
          <div className="flex flex-wrap gap-1 pt-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-16 rounded-full" />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Cards View Skeleton
export function TrendsSectionCardsSkeleton({ trendsCount = 12 }: { trendsCount?: number }) {
  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <CardTitle className="text-xl font-semibold">
              <Skeleton className="h-7 w-48" />
            </CardTitle>
            <Skeleton className="h-4 w-80" />
          </div>
          
          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-9 rounded" />
          </div>
        </div>
        
        {/* Controls Bar */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-4">
            {/* Platform filters */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-16" />
              <div className="flex gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-20 rounded-full" />
                ))}
              </div>
            </div>
            
            {/* Sort dropdown */}
            <div className="flex items-center gap-2 ml-6">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-8 w-32 rounded" />
            </div>
          </div>
          
          {/* View mode toggle */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: trendsCount }).map((_, index) => (
            <TrendCardSkeleton key={index} />
          ))}
        </div>
        
        {/* Pagination */}
        <div className="flex items-center justify-center mt-8">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-8 rounded" />
            ))}
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Table View Skeleton
export function TrendsSectionTableSkeleton({ trendsCount = 10 }: { trendsCount?: number }) {
  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <CardTitle className="text-xl font-semibold">
              <Skeleton className="h-7 w-48" />
            </CardTitle>
            <Skeleton className="h-4 w-80" />
          </div>
          
          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-9 rounded" />
          </div>
        </div>
        
        {/* Controls Bar */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-4">
            {/* Platform filters */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-16" />
              <div className="flex gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-20 rounded-full" />
                ))}
              </div>
            </div>
            
            {/* Sort dropdown */}
            <div className="flex items-center gap-2 ml-6">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-8 w-32 rounded" />
            </div>
          </div>
          
          {/* View mode toggle */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="px-8 py-6">
        {/* Table */}
        <div className="border border-border rounded-lg overflow-hidden">
          {/* Table Header */}
          <div className="bg-muted/50 border-b border-border p-4">
            <div className="grid grid-cols-12 gap-4 items-center">
              <div className="col-span-5">
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="col-span-2">
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="col-span-2">
                <Skeleton className="h-4 w-14" />
              </div>
              <div className="col-span-2">
                <Skeleton className="h-4 w-12" />
              </div>
              <div className="col-span-1">
                <Skeleton className="h-4 w-12" />
              </div>
            </div>
          </div>
          
          {/* Table Rows */}
          <div className="divide-y divide-border">
            {Array.from({ length: trendsCount }).map((_, index) => (
              <div key={index} className="p-4 hover:bg-muted/30">
                <div className="grid grid-cols-12 gap-4 items-center">
                  {/* Title & Description */}
                  <div className="col-span-5 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-4 rounded-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-4/5" />
                    <div className="flex gap-1 mt-2">
                      {Array.from({ length: 2 }).map((_, i) => (
                        <Skeleton key={i} className="h-5 w-12 rounded-full" />
                      ))}
                    </div>
                  </div>
                  
                  {/* Platform */}
                  <div className="col-span-2">
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                  
                  {/* Score */}
                  <div className="col-span-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-4 rounded" />
                      <Skeleton className="h-4 w-8" />
                    </div>
                  </div>
                  
                  {/* Date */}
                  <div className="col-span-2">
                    <Skeleton className="h-4 w-16" />
                  </div>
                  
                  {/* Actions */}
                  <div className="col-span-1">
                    <div className="flex gap-1">
                      <Skeleton className="h-6 w-6 rounded" />
                      <Skeleton className="h-6 w-6 rounded" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Pagination controls */}
        <div className="flex items-center justify-between mt-6">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-8 w-16 rounded" />
            <Skeleton className="h-4 w-20" />
          </div>
          
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-8 rounded" />
            ))}
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Column/Kanban Style Skeleton (for TrendsColumn component)
export function TrendsColumnSkeleton({ trendsCount = 8 }: { trendsCount?: number }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
      
      {/* Sort and filter controls */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-8 w-28 rounded" />
        </div>
        
        <div className="flex gap-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-16 rounded-full" />
          ))}
        </div>
      </div>
      
      {/* Trends list */}
      <div className="space-y-4">
        {Array.from({ length: trendsCount }).map((_, index) => (
          <Card key={index} className="border border-border shadow-sm">
            <CardContent className="p-4">
              <div className="space-y-3">
                {/* Header with platform */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-6 w-6 rounded" />
                </div>
                
                {/* Title */}
                <Skeleton className="h-5 w-full" />
                
                {/* Description */}
                <div className="space-y-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
                
                {/* Stats */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <Skeleton className="h-3 w-3 rounded" />
                    <Skeleton className="h-3 w-6" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Skeleton className="h-3 w-3 rounded" />
                    <Skeleton className="h-3 w-8" />
                  </div>
                  <Skeleton className="h-3 w-12" />
                </div>
                
                {/* Tags */}
                <div className="flex gap-1">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-5 w-14 rounded-full" />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Load more */}
      <div className="flex justify-center">
        <Skeleton className="h-10 w-32 rounded" />
      </div>
    </div>
  )
}

// Empty State Skeleton
export function TrendsEmptySkeleton() {
  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <CardTitle className="text-xl font-semibold">
              <Skeleton className="h-7 w-48" />
            </CardTitle>
            <Skeleton className="h-4 w-80" />
          </div>
          
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-9 rounded" />
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="px-8 py-12">
        <div className="text-center space-y-6">
          {/* Icon placeholder */}
          <div className="mx-auto">
            <Skeleton className="h-16 w-16 rounded-lg mx-auto" />
          </div>
          
          {/* Text */}
          <div className="space-y-2">
            <Skeleton className="h-6 w-48 mx-auto" />
            <Skeleton className="h-4 w-80 mx-auto" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </div>
          
          {/* Action button */}
          <Skeleton className="h-10 w-40 mx-auto" />
        </div>
      </CardContent>
    </Card>
  )
}

// Loading overlay skeleton
export function TrendsLoadingSkeleton() {
  return (
    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg shadow-lg p-6 max-w-sm">
        <div className="flex items-center gap-4">
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        
        <div className="mt-4">
          <div className="w-full bg-muted rounded-full h-2">
            <Skeleton className="h-2 w-2/3 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

// Main export for different skeleton variants
export function TrendsSkeleton({ 
  mode = 'cards', 
  trendsCount,
  isEmpty = false,
  isLoading = false 
}: { 
  mode?: 'cards' | 'table' | 'column'
  trendsCount?: number
  isEmpty?: boolean
  isLoading?: boolean
}) {
  if (isEmpty) {
    return <TrendsEmptySkeleton />
  }
  
  const content = (() => {
    switch (mode) {
      case 'table':
        return <TrendsSectionTableSkeleton trendsCount={trendsCount} />
      case 'column':
        return <TrendsColumnSkeleton trendsCount={trendsCount} />
      case 'cards':
      default:
        return <TrendsSectionCardsSkeleton trendsCount={trendsCount} />
    }
  })()
  
  return (
    <div className="relative">
      {content}
      {isLoading && <TrendsLoadingSkeleton />}
    </div>
  )
}
