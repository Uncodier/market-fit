import { Skeleton } from "@/app/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/app/components/ui/card"

export function ProfileSkeleton() {
  return (
    <div className="flex-1">
      {/* Header Skeleton */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="flex items-center justify-between px-16 py-4 w-full">
          <div className="flex-1" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
      
      <div className="px-16 py-8 pb-16 max-w-[880px] mx-auto">
        <div className="space-y-12">
          {/* Personal Information Card Skeleton */}
          <Card className="border border-border shadow-sm">
            <CardHeader className="px-8 py-6">
              <Skeleton className="h-7 w-48" />
            </CardHeader>
            <CardContent className="space-y-8 px-8 pb-8">
              <div className="flex flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0">
                {/* Profile Picture Skeleton */}
                <div className="min-w-[240px] flex-shrink-0">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="w-[240px] h-[240px] rounded-full" />
                </div>
                
                {/* Form Fields Skeleton */}
                <div className="flex-1 space-y-4">
                  {/* Name Field */}
                  <div>
                    <Skeleton className="h-4 w-12 mb-2" />
                    <Skeleton className="h-12 w-full rounded-md" />
                  </div>
                  
                  {/* Email Field */}
                  <div>
                    <Skeleton className="h-4 w-12 mb-2" />
                    <Skeleton className="h-12 w-full rounded-md" />
                    <Skeleton className="h-3 w-32 mt-2" />
                  </div>
                  
                  {/* Role Field */}
                  <div>
                    <Skeleton className="h-4 w-12 mb-2" />
                    <Skeleton className="h-12 w-full rounded-md" />
                  </div>
                </div>
              </div>
              
              {/* Bio Field Skeleton */}
              <div>
                <Skeleton className="h-4 w-8 mb-2" />
                <Skeleton className="h-32 w-full rounded-md" />
              </div>
            </CardContent>
          </Card>

          {/* Preferences Card Skeleton */}
          <Card className="border border-border shadow-sm">
            <CardHeader className="px-8 py-6">
              <Skeleton className="h-7 w-32" />
            </CardHeader>
            <CardContent className="space-y-8 px-8 pb-8">
              {/* Language Field */}
              <div>
                <Skeleton className="h-4 w-16 mb-2" />
                <Skeleton className="h-12 w-full rounded-md" />
              </div>
              
              {/* Timezone Field */}
              <div>
                <Skeleton className="h-4 w-16 mb-2" />
                <Skeleton className="h-12 w-full rounded-md" />
              </div>
            </CardContent>
          </Card>

          {/* Notifications Card Skeleton */}
          <Card className="border border-border shadow-sm">
            <CardHeader className="px-8 py-6">
              <Skeleton className="h-7 w-32" />
            </CardHeader>
            <CardContent className="space-y-8 px-8 pb-8">
              {/* Email Notifications */}
              <div className="flex flex-row items-center justify-between rounded-lg border border-border p-4">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <Skeleton className="h-6 w-11 rounded-full" />
              </div>

              {/* Push Notifications */}
              <div className="flex flex-row items-center justify-between rounded-lg border border-border p-4">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-4 w-52" />
                </div>
                <Skeleton className="h-6 w-11 rounded-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
} 