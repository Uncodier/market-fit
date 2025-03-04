"use client"

import { Button } from "@/app/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Badge } from "@/app/components/ui/badge"
import { Eye, PlayCircle, PenSquare, StopCircle, XCircle, Search, Beaker } from "@/app/components/ui/icons"
import { Input } from "@/app/components/ui/input"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { startExperiment, stopExperiment } from "./actions"
import { useToast } from "@/app/components/ui/use-toast"
import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyState } from "@/app/components/ui/empty-state"
import { useCommandK } from "@/app/hooks/use-command-k"
import { cn } from "@/lib/utils"

interface Segment {
  id: string
  name: string
  participants: number
}

interface Experiment {
  id: string
  name: string
  description: string
  status: "active" | "completed" | "draft"
  segments: Segment[]
  start_date: string | null
  end_date: string | null
  conversion: number | null
  roi: number | null
  preview_url: string | null
  hypothesis: string | null
}

function ExperimentCardSkeleton() {
  return (
    <Card className="group flex flex-col md:flex-row w-full h-[400px] hover:shadow-lg transition-all duration-200 hover:border-border bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col md:w-1/3 border-r border-border/30">
        <CardHeader className="pb-2 px-8">
          <div className="flex justify-between items-start gap-4">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-7 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </div>
            <Skeleton className="h-6 w-24" />
          </div>
        </CardHeader>
        <CardContent className="flex-1 px-8">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-5 w-3/4" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-5 w-3/4" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-5 w-3/4" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-5 w-3/4" />
            </div>
          </div>
        </CardContent>
        <div className="px-8 pb-4">
          <Skeleton className="h-4 w-40 mb-2" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-28" />
          </div>
        </div>
        <CardFooter className="pt-3 px-8">
          <div className="flex w-full space-x-3">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 flex-1" />
          </div>
        </CardFooter>
      </div>
      <div className="md:w-2/3 h-full p-4 bg-muted/30 rounded-r-lg">
        <Skeleton className="w-full h-full rounded-lg" />
      </div>
    </Card>
  )
}

const ExperimentEmptyState = ({ status }: { status: "all" | "active" | "completed" | "draft" }) => {
  const emptyStateProps = {
    all: {
      icon: <Beaker className="w-24 h-24 text-primary/40" />,
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

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [filteredExperiments, setFilteredExperiments] = useState<Experiment[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({})
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [initialFetchDone, setInitialFetchDone] = useState(false)
  const { toast } = useToast()

  // Inicializar el hook useCommandK
  useCommandK()

  // Efecto para filtrar experimentos basado en la búsqueda
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredExperiments(experiments)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = experiments.filter(experiment => 
      experiment.name.toLowerCase().includes(query) ||
      experiment.description?.toLowerCase().includes(query) ||
      experiment.hypothesis?.toLowerCase().includes(query) ||
      experiment.segments.some(segment => 
        segment.name.toLowerCase().includes(query)
      )
    )
    setFilteredExperiments(filtered)
  }, [searchQuery, experiments])

  // Memoizar fetchExperiments para evitar recreaciones en cada renderizado
  const fetchExperiments = useCallback(async () => {
    if (initialFetchDone) return;
    
    try {
      setIsLoadingData(true);
      const supabase = createClient()
      const { data: experimentsData, error: experimentsError } = await supabase
        .from("experiments")
        .select(`
          id,
          name,
          description,
          status,
          start_date,
          end_date,
          conversion,
          roi,
          preview_url,
          hypothesis,
          experiment_segments (
            segment:segments (
              id,
              name
            ),
            participants
          )
        `)
        .order('created_at', { ascending: false })

      if (experimentsError) {
        console.error("Error fetching experiments:", experimentsError)
        toast({
          title: "Error",
          description: "Failed to load experiments",
          variant: "destructive"
        })
        return
      }

      // Transform the data to match our interface
      const transformedData = experimentsData.map((experiment: any) => ({
        ...experiment,
        segments: experiment.experiment_segments.map((es: any) => ({
          id: es.segment.id,
          name: es.segment.name,
          participants: es.participants || 0
        }))
      }))

      setExperiments(transformedData)
      setInitialFetchDone(true);
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      })
    } finally {
      setIsLoadingData(false)
    }
  }, [toast, initialFetchDone])

  // Efecto para la carga inicial de datos
  useEffect(() => {
    fetchExperiments()
  }, [fetchExperiments])

  const handleStartExperiment = async (experimentId: string) => {
    try {
      setIsLoading(prev => ({ ...prev, [experimentId]: true }))
      const result = await startExperiment(experimentId)
      
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive"
        })
        return
      }

      // Update local state
      setExperiments(prev => prev.map(exp => 
        exp.id === experimentId 
          ? { 
              ...exp, 
              status: "active", 
              start_date: new Date().toISOString() 
            } 
          : exp
      ))

      toast({
        title: "Success",
        description: "Experiment started successfully"
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      })
    } finally {
      setIsLoading(prev => ({ ...prev, [experimentId]: false }))
    }
  }

  const handleStopExperiment = async (experimentId: string) => {
    try {
      setIsLoading(prev => ({ ...prev, [experimentId]: true }))
      const result = await stopExperiment(experimentId)
      
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive"
        })
        return
      }

      // Update local state
      setExperiments(prev => prev.map(exp => 
        exp.id === experimentId 
          ? { 
              ...exp, 
              status: "completed", 
              end_date: new Date().toISOString() 
            } 
          : exp
      ))

      toast({
        title: "Success",
        description: "Experiment stopped successfully"
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      })
    } finally {
      setIsLoading(prev => ({ ...prev, [experimentId]: false }))
    }
  }

  if (isLoadingData) {
    return (
      <div className="flex-1 p-0">
        <Tabs defaultValue="all" className="h-full">
          <StickyHeader>
            <div className="px-16 pt-0 w-full">
              <div className="flex items-center gap-8">
                <div>
                  <TabsList>
                    <TabsTrigger value="all" className="text-sm font-medium">All Experiments</TabsTrigger>
                    <TabsTrigger value="active" className="text-sm font-medium">Active</TabsTrigger>
                    <TabsTrigger value="completed" className="text-sm font-medium">Completed</TabsTrigger>
                    <TabsTrigger value="draft" className="text-sm font-medium">Draft</TabsTrigger>
                  </TabsList>
                </div>
                <div className="relative w-64">
                  <Input 
                    placeholder="Search experiments..." 
                    className="w-full"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-command-k-input
                    type="text"
                    icon={<Search className="h-4 w-4 text-muted-foreground" />}
                  />
                  <kbd className="pointer-events-none absolute right-2 top-4 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                    <span className="text-xs">⌘</span>K
                  </kbd>
                </div>
                <div className="flex-1"></div>
              </div>
            </div>
          </StickyHeader>
          
          <div className="p-8 space-y-4">
            <div className="px-8">
              <TabsContent value="all" className="space-y-6">
                <div className="space-y-6">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <ExperimentCardSkeleton key={index} />
                  ))}
                </div>
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>
    )
  }

  return (
    <div className="flex-1 p-0">
      <Tabs defaultValue="all" className="h-full">
        <StickyHeader>
          <div className="px-16 pt-0 w-full">
            <div className="flex items-center gap-8">
              <div>
                <TabsList>
                  <TabsTrigger value="all" className="text-sm font-medium">All Experiments</TabsTrigger>
                  <TabsTrigger value="active" className="text-sm font-medium">Active</TabsTrigger>
                  <TabsTrigger value="completed" className="text-sm font-medium">Completed</TabsTrigger>
                  <TabsTrigger value="draft" className="text-sm font-medium">Draft</TabsTrigger>
                </TabsList>
              </div>
              <div className="relative w-64">
                <Input 
                  placeholder="Search experiments..." 
                  className="w-full"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-command-k-input
                  type="text"
                  icon={<Search className="h-4 w-4 text-muted-foreground" />}
                />
                <kbd className="pointer-events-none absolute right-2 top-4 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </div>
              <div className="flex-1"></div>
            </div>
          </div>
        </StickyHeader>
        
        <div className="p-8 space-y-4">
          <div className="px-8">
            <TabsContent value="all" className="space-y-6">
              <div className="space-y-6">
                {filteredExperiments.length === 0 ? (
                  <ExperimentEmptyState status="all" />
                ) : (
                  filteredExperiments.map((experiment) => (
                    <Card 
                      key={experiment.id} 
                      className="group flex flex-col md:flex-row w-full h-[400px] hover:shadow-lg transition-all duration-200 hover:border-border bg-card/80 backdrop-blur-sm"
                    >
                      <div className="flex flex-col md:w-1/3 border-r border-border/20">
                        <CardHeader className="pb-2 px-8">
                          <div className="flex justify-between items-start gap-4">
                            <CardTitle className="text-xl font-medium text-card-foreground group-hover:text-card-foreground/90 transition-colors leading-tight">
                              {experiment.name}
                            </CardTitle>
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
                          <CardDescription className="mt-2 text-sm leading-relaxed">
                            {experiment.description || "No description available"}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 px-8">
                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                                Participants
                              </p>
                              <p className="text-base font-semibold text-card-foreground">
                                {experiment.segments.reduce((acc, segment) => acc + segment.participants, 0).toLocaleString()}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                                Start Date
                              </p>
                              <p className="text-base font-semibold text-card-foreground">
                                {experiment.start_date ? new Date(experiment.start_date).toLocaleDateString() : "Not started"}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                                Conversion
                              </p>
                              <p className="text-base font-semibold text-card-foreground">
                                {experiment.conversion !== null ? `${experiment.conversion}%` : "N/A"}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                                ROI
                              </p>
                              <p className="text-base font-semibold text-card-foreground">
                                {experiment.roi !== null ? `${experiment.roi}x` : "N/A"}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                        <div className="px-8 pb-4">
                          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Running Segments:</p>
                          <div className="flex flex-wrap gap-2">
                            {experiment.segments.map((segment) => (
                              <Badge 
                                key={segment.id}
                                variant="secondary" 
                                className="px-3 py-1 text-xs font-medium transition-colors duration-200 hover:bg-secondary/40 hover:text-secondary-foreground/90"
                              >
                                {segment.name} ({segment.participants.toLocaleString()})
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <CardFooter className="pt-3 px-8">
                          <div className="flex w-full space-x-3">
                            <Button 
                              variant="outline" 
                              className="flex-1 hover:bg-accent hover:shadow-sm transition-all text-sm font-medium h-10 bg-background text-foreground border-border"
                            >
                              <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
                              View Details
                            </Button>
                            {experiment.status === "active" && (
                              <Button 
                                variant="outline" 
                                className="flex-1 transition-all text-sm font-medium h-10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/30 hover:bg-red-50 dark:hover:bg-red-900/20"
                                onClick={() => handleStopExperiment(experiment.id)}
                                disabled={isLoading[experiment.id]}
                              >
                                {isLoading[experiment.id] ? (
                                  <>
                                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-red-200 dark:border-red-500/30 border-r-red-700 dark:border-r-red-400" />
                                    Stopping...
                                  </>
                                ) : (
                                  <>
                                    <StopCircle className="mr-2 h-4 w-4 text-red-700 dark:text-red-400" />
                                    Stop
                                  </>
                                )}
                              </Button>
                            )}
                            {experiment.status === "draft" && (
                              <>
                                <Button 
                                  variant="outline" 
                                  className="flex-1 transition-all text-sm font-medium h-10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/30 hover:bg-green-50 dark:hover:bg-green-900/20"
                                  onClick={() => handleStartExperiment(experiment.id)}
                                  disabled={isLoading[experiment.id]}
                                >
                                  {isLoading[experiment.id] ? (
                                    <>
                                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-green-200 dark:border-green-500/30 border-r-green-700 dark:border-r-green-400" />
                                      Starting...
                                    </>
                                  ) : (
                                    <>
                                      <PlayCircle className="mr-2 h-4 w-4 text-green-700 dark:text-green-400" />
                                      Start
                                    </>
                                  )}
                                </Button>
                                <Button 
                                  variant="outline" 
                                  className="flex-1 transition-all text-sm font-medium h-10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/30 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                >
                                  <PenSquare className="mr-2 h-4 w-4 text-blue-700 dark:text-blue-400" />
                                  Edit
                                </Button>
                              </>
                            )}
                          </div>
                        </CardFooter>
                      </div>
                      <div className="md:w-2/3 h-full p-4 bg-muted/30 rounded-r-lg">
                        <div className="w-full h-full rounded-lg overflow-hidden border border-border/50 shadow-sm group-hover:shadow-md transition-all duration-200 bg-background">
                          <div className="relative w-full h-full overflow-hidden flex items-center justify-center">
                            <iframe 
                              src={experiment.preview_url || "about:blank"} 
                              className="absolute w-[200%] h-[200%] origin-center"
                              style={{ transform: 'scale(0.5)', transformOrigin: 'center' }}
                              title={`Preview of ${experiment.name}`}
                              sandbox="allow-same-origin allow-scripts"
                              loading="lazy"
                            />
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
            <TabsContent value="active" className="space-y-6">
              <div className="space-y-6">
                {filteredExperiments.filter(e => e.status === "active").length === 0 ? (
                  <ExperimentEmptyState status="active" />
                ) : (
                  filteredExperiments.filter(e => e.status === "active").map((experiment) => (
                    <Card 
                      key={experiment.id} 
                      className="group flex flex-col md:flex-row w-full h-[400px] hover:shadow-lg transition-all duration-200 hover:border-border bg-card/80 backdrop-blur-sm"
                    >
                      <div className="flex flex-col md:w-1/3 border-r border-border/20">
                        <CardHeader className="pb-2 px-8">
                          <div className="flex justify-between items-start gap-4">
                            <CardTitle className="text-xl font-medium text-card-foreground group-hover:text-card-foreground/90 transition-colors leading-tight">
                              {experiment.name}
                            </CardTitle>
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
                          <CardDescription className="mt-2 text-sm leading-relaxed">
                            {experiment.description || "No description available"}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 px-8">
                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                                Participants
                              </p>
                              <p className="text-base font-semibold text-card-foreground">
                                {experiment.segments.reduce((acc, segment) => acc + segment.participants, 0).toLocaleString()}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                                Start Date
                              </p>
                              <p className="text-base font-semibold text-card-foreground">
                                {experiment.start_date ? new Date(experiment.start_date).toLocaleDateString() : "Not started"}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                                Conversion
                              </p>
                              <p className="text-base font-semibold text-card-foreground">
                                {experiment.conversion !== null ? `${experiment.conversion}%` : "N/A"}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                                ROI
                              </p>
                              <p className="text-base font-semibold text-card-foreground">
                                {experiment.roi !== null ? `${experiment.roi}x` : "N/A"}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                        <div className="px-8 pb-4">
                          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Running Segments:</p>
                          <div className="flex flex-wrap gap-2">
                            {experiment.segments.map((segment) => (
                              <Badge 
                                key={segment.id}
                                variant="secondary" 
                                className="px-3 py-1 text-xs font-medium transition-colors duration-200 hover:bg-secondary/40 hover:text-secondary-foreground/90"
                              >
                                {segment.name} ({segment.participants.toLocaleString()})
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <CardFooter className="pt-3 px-8">
                          <div className="flex w-full space-x-3">
                            <Button 
                              variant="outline" 
                              className="flex-1 hover:bg-accent hover:shadow-sm transition-all text-sm font-medium h-10 bg-background text-foreground border-border"
                            >
                              <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
                              View Details
                            </Button>
                            <Button 
                              variant="outline" 
                              className="flex-1 hover:bg-red-50 hover:shadow-sm transition-all text-sm font-medium h-10 bg-white text-red-700 border-red-200"
                              onClick={() => handleStopExperiment(experiment.id)}
                              disabled={isLoading[experiment.id]}
                            >
                              {isLoading[experiment.id] ? (
                                <>
                                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-red-200 border-r-red-700" />
                                  Stopping...
                                </>
                              ) : (
                                <>
                                  <StopCircle className="mr-2 h-4 w-4 text-red-700" />
                                  Stop
                                </>
                              )}
                            </Button>
                          </div>
                        </CardFooter>
                      </div>
                      <div className="md:w-2/3 h-full p-4 bg-muted/30 rounded-r-lg">
                        <div className="w-full h-full rounded-lg overflow-hidden border border-border/50 shadow-sm group-hover:shadow-md transition-all duration-200 bg-background">
                          <div className="relative w-full h-full overflow-hidden flex items-center justify-center">
                            <iframe 
                              src={experiment.preview_url || "about:blank"} 
                              className="absolute w-[200%] h-[200%] origin-center"
                              style={{ transform: 'scale(0.5)', transformOrigin: 'center' }}
                              title={`Preview of ${experiment.name}`}
                              sandbox="allow-same-origin allow-scripts"
                              loading="lazy"
                            />
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
            <TabsContent value="completed" className="space-y-6">
              <div className="space-y-6">
                {filteredExperiments.filter(e => e.status === "completed").length === 0 ? (
                  <ExperimentEmptyState status="completed" />
                ) : (
                  filteredExperiments.filter(e => e.status === "completed").map((experiment) => (
                    <Card 
                      key={experiment.id} 
                      className="group flex flex-col md:flex-row w-full h-[400px] hover:shadow-lg transition-all duration-200 hover:border-border bg-card/80 backdrop-blur-sm"
                    >
                      <div className="flex flex-col md:w-1/3 border-r border-border/20">
                        <CardHeader className="pb-2 px-8">
                          <div className="flex justify-between items-start gap-4">
                            <CardTitle className="text-xl font-medium text-card-foreground group-hover:text-card-foreground/90 transition-colors leading-tight">
                              {experiment.name}
                            </CardTitle>
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
                          <CardDescription className="mt-2 text-sm leading-relaxed">
                            {experiment.description || "No description available"}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 px-8">
                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                                Participants
                              </p>
                              <p className="text-base font-semibold text-card-foreground">
                                {experiment.segments.reduce((acc, segment) => acc + segment.participants, 0).toLocaleString()}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                                Duration
                              </p>
                              <p className="text-base font-semibold text-card-foreground">
                                {experiment.start_date && experiment.end_date 
                                  ? `${Math.ceil((new Date(experiment.end_date).getTime() - new Date(experiment.start_date).getTime()) / (1000 * 60 * 60 * 24))} days` 
                                  : "N/A"}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                                Conversion
                              </p>
                              <p className="text-base font-semibold text-card-foreground">
                                {experiment.conversion !== null ? `${experiment.conversion}%` : "N/A"}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                                ROI
                              </p>
                              <p className="text-base font-semibold text-card-foreground">
                                {experiment.roi !== null ? `${experiment.roi}x` : "N/A"}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                        <div className="px-8 pb-4">
                          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Segments:</p>
                          <div className="flex flex-wrap gap-2">
                            {experiment.segments.map((segment) => (
                              <Badge 
                                key={segment.id}
                                variant="secondary" 
                                className="px-3 py-1 text-xs font-medium transition-colors duration-200 hover:bg-secondary/40 hover:text-secondary-foreground/90"
                              >
                                {segment.name} ({segment.participants.toLocaleString()})
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <CardFooter className="pt-3 px-8">
                          <div className="flex w-full space-x-3">
                            <Button 
                              variant="outline" 
                              className="flex-1 transition-all text-sm font-medium h-10 text-muted-foreground border-input hover:bg-muted/50"
                            >
                              <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
                              View Results
                            </Button>
                            <Button 
                              variant="outline" 
                              className="flex-1 transition-all text-sm font-medium h-10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/30 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <XCircle className="mr-2 h-4 w-4 text-red-700 dark:text-red-400" />
                              Reject
                            </Button>
                          </div>
                        </CardFooter>
                      </div>
                      <div className="md:w-2/3 h-full p-4 bg-muted/30 rounded-r-lg">
                        <div className="w-full h-full rounded-lg overflow-hidden border border-border/50 shadow-sm group-hover:shadow-md transition-all duration-200 bg-background">
                          <div className="relative w-full h-full overflow-hidden flex items-center justify-center">
                            <iframe 
                              src={experiment.preview_url || "about:blank"} 
                              className="absolute w-[200%] h-[200%] origin-center"
                              style={{ transform: 'scale(0.5)', transformOrigin: 'center' }}
                              title={`Preview of ${experiment.name}`}
                              sandbox="allow-same-origin allow-scripts"
                              loading="lazy"
                            />
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
            <TabsContent value="draft" className="space-y-6">
              <div className="space-y-6">
                {filteredExperiments.filter(e => e.status === "draft").length === 0 ? (
                  <ExperimentEmptyState status="draft" />
                ) : (
                  filteredExperiments.filter(e => e.status === "draft").map((experiment) => (
                    <Card 
                      key={experiment.id} 
                      className="group flex flex-col md:flex-row w-full h-[400px] hover:shadow-lg transition-all duration-200 hover:border-border bg-card/80 backdrop-blur-sm"
                    >
                      <div className="flex flex-col md:w-1/3 border-r border-border/20">
                        <CardHeader className="pb-2 px-8">
                          <div className="flex justify-between items-start gap-4">
                            <CardTitle className="text-xl font-medium text-card-foreground group-hover:text-card-foreground/90 transition-colors leading-tight">
                              {experiment.name}
                            </CardTitle>
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
                          <CardDescription className="mt-2 text-sm leading-relaxed">
                            {experiment.description || "No description available"}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 px-8">
                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                                Status
                              </p>
                              <p className="text-base font-semibold text-card-foreground">
                                Not started
                              </p>
                            </div>
                            {experiment.hypothesis && (
                              <div className="space-y-2">
                                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                                  Hypothesis
                                </p>
                                <p className="text-base font-semibold text-card-foreground">
                                  {experiment.hypothesis}
                                </p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                        <div className="px-8 pb-4">
                          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Target Segments:</p>
                          <div className="flex flex-wrap gap-2">
                            {experiment.segments.map((segment) => (
                              <Badge 
                                key={segment.id}
                                variant="secondary" 
                                className="px-3 py-1 text-xs font-medium transition-colors duration-200 hover:bg-secondary/40 hover:text-secondary-foreground/90"
                              >
                                {segment.name} ({segment.participants.toLocaleString()})
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <CardFooter className="pt-3 px-8">
                          <div className="flex w-full space-x-3">
                            <Button 
                              variant="outline" 
                              className="flex-1 hover:bg-accent hover:shadow-sm transition-all text-sm font-medium h-10 bg-background text-foreground border-border"
                            >
                              <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
                              View Details
                            </Button>
                            <Button 
                              variant="outline" 
                              className="flex-1 transition-all text-sm font-medium h-10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/30 hover:bg-green-50 dark:hover:bg-green-900/20"
                              onClick={() => handleStartExperiment(experiment.id)}
                              disabled={isLoading[experiment.id]}
                            >
                              {isLoading[experiment.id] ? (
                                <>
                                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-green-200 dark:border-green-500/30 border-r-green-700 dark:border-r-green-400" />
                                  Starting...
                                </>
                              ) : (
                                <>
                                  <PlayCircle className="mr-2 h-4 w-4 text-green-700 dark:text-green-400" />
                                  Start
                                </>
                              )}
                            </Button>
                            <Button 
                              variant="outline" 
                              className="flex-1 hover:bg-blue-50 hover:shadow-sm transition-all text-sm font-medium h-10 bg-white text-blue-700 border-blue-200"
                            >
                              <PenSquare className="mr-2 h-4 w-4 text-blue-700" />
                              Edit
                            </Button>
                          </div>
                        </CardFooter>
                      </div>
                      <div className="md:w-2/3 h-full p-4 bg-muted/30 rounded-r-lg">
                        <div className="w-full h-full rounded-lg overflow-hidden border border-border/50 shadow-sm group-hover:shadow-md transition-all duration-200 bg-background">
                          <div className="relative w-full h-full overflow-hidden flex items-center justify-center">
                            <iframe 
                              src={experiment.preview_url || "about:blank"} 
                              className="absolute w-[200%] h-[200%] origin-center"
                              style={{ transform: 'scale(0.5)', transformOrigin: 'center' }}
                              title={`Preview of ${experiment.name}`}
                              sandbox="allow-same-origin allow-scripts"
                              loading="lazy"
                            />
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  )
} 