import { Button } from '@/app/components/ui/button'
import { Card, CardContent } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Eye, FlaskConical, PlayCircle, PenSquare, StopCircle } from '@/app/components/ui/icons'
import { Skeleton } from '@/app/components/ui/skeleton'
import { LoadingSkeleton } from '@/app/components/ui/loading-skeleton'
import { EmptyState } from '@/app/components/ui/empty-state'
import { Collapsible, CollapsibleContent } from '@/app/components/ui/collapsible'
import { cn } from '@/lib/utils'
import type { ExperimentIndexRow as Experiment } from './read-experiment-index'

// Experiment Row Skeleton component
export function ExperimentRowSkeleton() {
  return (
    <Card className="border border-border overflow-hidden">
      <div className="flex items-center">
        <CardContent className="flex-1 p-4 w-full overflow-x-auto">
          <div className="flex items-start gap-4 min-w-[1000px]">
            <div className="w-[500px] min-w-[500px] pr-2 flex-grow space-y-2">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </div>
            <div className="w-[120px] min-w-[120px] flex-shrink-0">
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4 mx-auto" />
            </div>
            <div className="w-[100px] min-w-[100px] flex-shrink-0">
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3 mx-auto" />
            </div>
            <div className="w-[120px] min-w-[120px] flex-shrink-0 hidden lg:block">
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3 mx-auto" />
            </div>
            <div className="w-[100px] min-w-[100px] flex-shrink-0">
              <Skeleton className="h-4 w-full mb-2" />
              <div className="flex items-center justify-center gap-0.5">
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-5 w-10 rounded-full flex-shrink-0 ml-1" />
              </div>
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  )
}

// Empty state component
export const ExperimentEmptyState = ({ status }: { status: "all" | "active" | "completed" | "draft" }) => {
  const emptyStateProps = {
    all: {
      icon: <FlaskConical className="w-24 h-24 text-primary/40" />,
      title: "No experiments yet",
      description: "Start creating experiments to test your hypotheses and improve your product.",
    },
    active: {
      icon: <PlayCircle className="w-24 h-24 text-primary/40" />,
      title: "No active experiments",
      description: "Start an experiment from your drafts or create a new one to begin testing.",
    },
    completed: {
      icon: <StopCircle className="w-24 h-24 text-primary/40" />,
      title: "No completed experiments",
      description: "Your completed experiments will appear here once they're finished.",
    },
    draft: {
      icon: <PenSquare className="w-24 h-24 text-primary/40" />,
      title: "No draft experiments",
      description: "Create a new experiment to start testing your ideas.",
    },
  }

  return (
    <EmptyState {...emptyStateProps[status]} />
  )
}

// Experiment Row component
export function ExperimentRow({
  experiment,
  isExpanded,
  isLoading,
  onStart,
  onStop,
  onView,
}: {
  experiment: Experiment;
  isExpanded: boolean;
  isLoading: boolean;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onView: (experiment: Experiment) => void;
}) {
  return (
    <Collapsible
      key={experiment.id}
      open={isExpanded}
      onOpenChange={() => {}} // Disable automatic toggle
      className="w-full"
    >
      {/* Wrap entire card in a clickable div that routes to experiment details */}
      <div
        className="cursor-pointer"
        onClick={(e) => {
          e.preventDefault();
          onView(experiment);
        }}
      >
        <Card className="border border-border hover:border-foreground/20 transition-colors overflow-hidden">
          <div className="flex items-center hover:bg-muted/50 transition-colors w-full">
            <CardContent className="flex-1 p-4 w-full overflow-x-auto">
              <div className="flex items-start gap-4 min-w-[1000px]">
                <div className="w-[500px] min-w-[500px] pr-2 flex-grow">
                  <h3 className="font-semibold text-lg truncate">{experiment.name}</h3>
                  <p className="text-sm text-muted-foreground/80 truncate">
                    {experiment.description || 'No description available'}
                  </p>
                </div>
                <div className="w-[120px] min-w-[120px] flex-shrink-0">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 text-center">Participants</p>
                  <p className="text-sm font-medium truncate text-center">
                    {experiment.segments.reduce((acc, segment) => acc + segment.participants, 0).toLocaleString()}
                  </p>
                </div>
                <div className="w-[100px] min-w-[100px] flex-shrink-0">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 text-center">Conversion</p>
                  <p className="text-sm font-medium text-center">
                    {experiment.conversion !== null ? `${experiment.conversion}%` : 'N/A'}
                  </p>
                </div>
                <div className="w-[120px] min-w-[120px] flex-shrink-0 hidden lg:block">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 text-center">Start Date</p>
                  <p className="text-sm font-medium text-center">
                    {experiment.start_date ? new Date(experiment.start_date).toLocaleDateString() : 'Not started'}
                  </p>
                </div>
                <div className="w-[100px] min-w-[100px] flex-shrink-0">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 text-center">Status</p>
                  <div className="flex items-center justify-center">
                    <Badge
                      className={cn(
                        "text-xs font-semibold px-3 py-1 border shadow-sm transition-colors duration-200",
                        experiment.status === "draft" && "bg-secondary/20 text-secondary-foreground border-secondary/20 hover:bg-secondary/30 hover:border-secondary/30",
                        experiment.status === "active" && "bg-success/20 text-success border-success/20 hover:bg-success/30 hover:border-success/30",
                        experiment.status === "completed" && "bg-info/20 text-info border-info/20 hover:bg-info/30 hover:border-info/30"
                      )}
                    >
                      {experiment.status === "draft" ? "Draft" :
                        experiment.status === "active" ? "Active" : "Completed"}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </div>
          <CollapsibleContent>
            <CardContent className="pt-0 pb-6 px-6 border-t" onClick={(e) => e.stopPropagation()}>
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onView(experiment);
                      }}
                      className="flex items-center justify-center hover:bg-secondary/80 transition-colors relative min-w-[160px]"
                    >
                      <div className="flex items-center justify-center min-w-0">
                        <Eye className="h-3.5 w-3.5 mr-1.5" />
                        <span className="transition-all duration-200">
                          View Details
                        </span>
                      </div>
                    </Button>
                    {experiment.status === 'draft' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onStart(experiment.id);
                        }}
                        className="flex items-center justify-center hover:bg-secondary/80 transition-colors relative min-w-[160px] text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/30 hover:bg-green-50 dark:hover:bg-green-900/20"
                        disabled={isLoading}
                      >
                        <div className="flex items-center justify-center min-w-0">
                          {isLoading ? (
                            <LoadingSkeleton variant="button" size="sm" className="text-green-700" />
                          ) : (
                            <PlayCircle className="h-3.5 w-3.5 mr-1.5 text-green-700 dark:text-green-400" />
                          )}
                          <span className="transition-all duration-200">
                            {isLoading ? "Starting..." : "Start Experiment"}
                          </span>
                        </div>
                      </Button>
                    )}
                    {experiment.status === 'active' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onStop(experiment.id);
                        }}
                        className="flex items-center justify-center transition-colors relative min-w-[160px] text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/30 hover:bg-red-50 dark:hover:bg-red-900/20"
                        disabled={isLoading}
                      >
                        <div className="flex items-center justify-center min-w-0">
                          {isLoading ? (
                            <LoadingSkeleton variant="button" size="sm" className="text-red-700" />
                          ) : (
                            <StopCircle className="h-3.5 w-3.5 mr-1.5 text-red-700 dark:text-red-400" />
                          )}
                          <span className="transition-all duration-200">
                            {isLoading ? "Stopping..." : "Stop Experiment"}
                          </span>
                        </div>
                      </Button>
                    )}
                    {experiment.status === 'draft' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onView(experiment);
                        }}
                        className="flex items-center justify-center transition-colors relative min-w-[160px] text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/30 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      >
                        <div className="flex items-center justify-center min-w-0">
                          <PenSquare className="h-3.5 w-3.5 mr-1.5 text-blue-700 dark:text-blue-400" />
                          <span className="transition-all duration-200">
                            Edit Experiment
                          </span>
                        </div>
                      </Button>
                    )}
                  </div>
                </div>
                {experiment.hypothesis && (
                  <div className="space-y-4 mt-6 border-t pt-4">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-base">Hypothesis</h4>
                    </div>
                    <div className="bg-background/50 p-3 rounded-lg">
                      <p className="text-sm">{experiment.hypothesis}</p>
                    </div>
                  </div>
                )}
                {experiment.segments.length > 0 && (
                  <div className="space-y-4 mt-6 border-t pt-4">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-base">Target Segments</h4>
                    </div>
                    <div className="flex flex-wrap gap-2 bg-background/50 p-3 rounded-lg">
                      {experiment.segments.map((segment) => (
                        <Badge
                          key={segment.id}
                          variant="secondary"
                          className="px-3 py-1 cursor-pointer hover:bg-secondary/80 transition-colors text-xs sm:text-sm"
                        >
                          {segment.name} ({segment.participants.toLocaleString()})
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {experiment.preview_url && (
                  <div className="relative mt-6 border-t pt-4">
                    <h4 className="font-medium text-base mb-3">Preview</h4>
                    <div className="w-full h-[300px] bg-background rounded-md border">
                      <div className="relative w-full h-full overflow-hidden flex items-center justify-center">
                        <iframe
                          src={experiment.preview_url}
                          className="absolute w-[150%] h-[150%] origin-center rounded-md"
                          style={{ transform: 'scale(0.65)', transformOrigin: 'center' }}
                          sandbox="allow-same-origin allow-scripts"
                          loading="lazy"
                          allow="fullscreen"
                          referrerPolicy="no-referrer" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </div>
    </Collapsible>
  )
}
