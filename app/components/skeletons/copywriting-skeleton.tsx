import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "../ui/card"
import { Skeleton } from "../ui/skeleton"

export function CopywritingSkeleton() {
  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="px-8 py-6">
        <CardTitle className="text-xl font-semibold">
          <Skeleton className="h-7 w-48" />
        </CardTitle>
        <Skeleton className="h-4 w-80 mt-1" />
      </CardHeader>
      
      <CardContent className="px-8 py-6">
        <div className="space-y-6">
          {/* Empty state skeleton */}
          <div className="text-center py-12">
            <Skeleton className="mx-auto h-12 w-12 rounded-full" />
            <Skeleton className="mt-4 h-6 w-40 mx-auto" />
            <Skeleton className="mt-2 h-4 w-64 mx-auto" />
          </div>
          
          {/* Add button skeleton */}
          <div className="flex justify-center">
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="px-8 py-6 bg-gray-50/50 border-t">
        <div className="flex items-center justify-between w-full">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-36" />
        </div>
      </CardFooter>
    </Card>
  )
}

export function CopywritingItemsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="px-8 py-6">
        <CardTitle className="text-xl font-semibold">
          <Skeleton className="h-7 w-48" />
        </CardTitle>
        <Skeleton className="h-4 w-80 mt-1" />
      </CardHeader>
      
      <CardContent className="px-8 py-6">
        <div className="space-y-6">
          {Array.from({ length: count }).map((_, index) => (
            <Card key={index} className="border border-gray-200">
              <CardContent className="p-6">
                <div className="space-y-4">
                  {/* Title and Type row */}
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                  
                  {/* Title input */}
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                  
                  {/* Content textarea */}
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                  
                  {/* Optional fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  </div>
                  
                  {/* Delete button */}
                  <div className="flex justify-end">
                    <Skeleton className="h-8 w-8 rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {/* Add button */}
          <div className="flex justify-center">
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="px-8 py-6 bg-gray-50/50 border-t">
        <div className="flex items-center justify-between w-full">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-36" />
        </div>
      </CardFooter>
    </Card>
  )
}
