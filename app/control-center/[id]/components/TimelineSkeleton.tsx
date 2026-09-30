import { Card, CardContent } from "@/app/components/ui/card"
import { ActionFooter } from "@/app/components/ui/card-footer"
export function TimelineSkeleton() {
    return (
      <div className="space-y-6">
        {/* Comment input skeleton */}
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="h-[100px] w-full bg-muted animate-pulse rounded-md" />
              <div className="flex items-center justify-between">
                <div className="h-9 w-32 bg-muted animate-pulse rounded-md" />
                <div className="flex items-center gap-4">
                  <div className="h-9 w-32 bg-muted animate-pulse rounded-md" />
                  <div className="h-9 w-32 bg-muted animate-pulse rounded-md" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Comments list skeleton */}
        <div className="space-y-4">
          {/* Comment with image */}
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                    <div className="space-y-2">
                      <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                      <div className="h-3 w-32 bg-muted animate-pulse rounded" />
                    </div>
                  </div>
                  <div className="h-8 w-20 bg-muted animate-pulse rounded" />
                </div>
                <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                <div className="h-48 w-full bg-muted animate-pulse rounded-md" />
              </div>
            </CardContent>
          </Card>

          {/* Comment with text only */}
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                    <div className="space-y-2">
                      <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                      <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-20 bg-muted animate-pulse rounded" />
                    <div className="h-8 w-8 bg-muted animate-pulse rounded" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-full bg-muted animate-pulse rounded" />
                  <div className="h-4 w-2/3 bg-muted animate-pulse rounded" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Task description skeleton */}
          <Card className="mt-8 bg-muted/50">
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <div className="flex -space-x-2">
                  <div className="h-10 w-10 rounded-full bg-muted animate-pulse ring-2 ring-background" />
                  <div className="h-10 w-10 rounded-full bg-muted animate-pulse ring-2 ring-background" />
                </div>
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                    <div className="h-4 w-4 bg-muted animate-pulse rounded-full" />
                    <div className="h-4 w-48 bg-muted animate-pulse rounded" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 w-full bg-muted animate-pulse rounded" />
                    <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                  </div>
                  <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )

}
