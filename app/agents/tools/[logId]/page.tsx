import { getInstanceLogById } from "@/app/agents/actions"
import ToolDetail from "./tool-detail"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Card, CardContent } from "@/app/components/ui/card"

// Skeleton component for loading state
function ToolDetailSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="px-16 pt-0">
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>

      <div className="container flex-1 items-start py-6 max-w-screen-2xl">
        <div className="flex flex-col space-y-6 lg:flex-row lg:space-x-6 lg:space-y-0">
          {/* Left Column: Log Details */}
          <div className="space-y-6 lg:flex-1">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {/* Loading skeletons for log details */}
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-muted/40 rounded-lg p-4 border border-border/30">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-12 w-12 rounded-md" />
                        <div className="flex-1">
                          <Skeleton className="h-4 w-24 mb-2" />
                          <Skeleton className="h-5 w-48" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Overview Card */}
          <div className="lg:w-1/3">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {/* Loading skeletons for overview */}
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-muted/40 rounded-lg p-4 border border-border/30">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-12 w-12 rounded-md" />
                        <div className="flex-1">
                          <Skeleton className="h-4 w-24 mb-2" />
                          <Skeleton className="h-5 w-48" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function ToolDetailPage({ params }: { params: { logId: string } }) {
  const { logId } = await params
  let logData = null
  
  try {
    // Get the instance log
    const response = await getInstanceLogById(logId)
    logData = response.log
    
    if (response.error) {
      console.error('Error loading log:', response.error)
    }
  } catch (error) {
    console.error('Error loading log:', error)
  }
  
  // Show skeleton while data is being fetched or if no data was found
  if (!logData) {
    return <ToolDetailSkeleton />
  }
  
  return (
    <ToolDetail 
      log={logData as any} 
      logId={logId} 
    />
  )
}


