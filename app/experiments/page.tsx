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
    <Card className="group flex flex-col md:flex-row w-full h-[400px] hover:shadow-lg transition-all duration-200 hover:border-gray-300 bg-white/80 backdrop-blur-sm">
      <div className="flex flex-col md:w-1/3 border-r border-gray-100">
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
      <div className="md:w-2/3 h-full p-4 bg-gray-50/30 rounded-r-lg">
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
                  <TabsList className="bg-gray-100/80 p-1">
                    <TabsTrigger value="all" className="text-sm font-medium">All Experiments</TabsTrigger>
                    <TabsTrigger value="active" className="text-sm font-medium">Active</TabsTrigger>
                    <TabsTrigger value="completed" className="text-sm font-medium">Completed</TabsTrigger>
                    <TabsTrigger value="draft" className="text-sm font-medium">Draft</TabsTrigger>
                  </TabsList>
                </div>
                <div className="relative w-64">
                  <Input 
                    placeholder="Search experiments..." 
                    className="w-full text-sm bg-background border-border focus:border-muted-foreground/20 focus:ring-muted-foreground/20" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-command-k-input
                    type="text"
                    icon={<Search className="h-4 w-4 text-muted-foreground" />}
                    iconPosition="left"
                  />
                  <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                    <span className="text-xs">⌘</span>K
                  </kbd>
                </div>
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
                <TabsList className="bg-gray-100/80 p-1">
                  <TabsTrigger value="all" className="text-sm font-medium">All Experiments</TabsTrigger>
                  <TabsTrigger value="active" className="text-sm font-medium">Active</TabsTrigger>
                  <TabsTrigger value="completed" className="text-sm font-medium">Completed</TabsTrigger>
                  <TabsTrigger value="draft" className="text-sm font-medium">Draft</TabsTrigger>
                </TabsList>
              </div>
              <div className="relative w-64">
                <Input 
                  placeholder="Search experiments..." 
                  className="w-full text-sm bg-background border-border focus:border-muted-foreground/20 focus:ring-muted-foreground/20" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-command-k-input
                  type="text"
                  icon={<Search className="h-4 w-4 text-muted-foreground" />}
                  iconPosition="left"
                />
                <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </div>
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
                      className="group flex flex-col md:flex-row w-full h-[400px] hover:shadow-lg transition-all duration-200 hover:border-gray-300 bg-white/80 backdrop-blur-sm"
                    >
                      <div className="flex flex-col md:w-1/3 border-r border-gray-100">
                        <CardHeader className="pb-2 px-8">
                          <div className="flex justify-between items-start gap-4">
                            <CardTitle className="text-xl font-medium text-gray-800 group-hover:text-gray-900 transition-colors leading-tight">
                              {experiment.name}
                            </CardTitle>
                            <Badge
                              className={
                                experiment.status === "active"
                                  ? "bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 shadow-sm text-xs font-semibold px-3 py-1"
                                  : experiment.status === "completed"
                                  ? "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 shadow-sm text-xs font-semibold px-3 py-1"
                                  : "bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 shadow-sm text-xs font-semibold px-3 py-1"
                              }
                            >
                              {experiment.status.charAt(0).toUpperCase() + experiment.status.slice(1)}
                            </Badge>
                          </div>
                          <CardDescription className="text-gray-500 mt-2 text-sm leading-relaxed group-hover:text-gray-600">
                            {experiment.description || "No description available"}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 px-8">
                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
                                Participants
                              </p>
                              <p className="text-base font-semibold text-gray-800">
                                {experiment.segments.reduce((acc, segment) => acc + segment.participants, 0).toLocaleString()}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
                                Start Date
                              </p>
                              <p className="text-base font-semibold text-gray-800">
                                {experiment.start_date ? new Date(experiment.start_date).toLocaleDateString() : "Not started"}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
                                Conversion
                              </p>
                              <p className="text-base font-semibold text-gray-800">
                                {experiment.conversion !== null ? `${experiment.conversion}%` : "N/A"}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
                                ROI
                              </p>
                              <p className="text-base font-semibold text-gray-800">
                                {experiment.roi !== null ? `${experiment.roi}x` : "N/A"}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                        <div className="px-8 pb-4">
                          <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">Running Segments:</p>
                          <div className="flex flex-wrap gap-2">
                            {experiment.segments.map((segment) => (
                              <Badge 
                                key={segment.id}
                                variant="secondary" 
                                className="px-3 py-1 text-xs font-medium bg-gray-100/80 text-gray-700 hover:bg-gray-200/80 transition-colors border border-gray-200/50"
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
                              className="flex-1 hover:bg-gray-50 hover:shadow-sm transition-all text-sm font-medium h-10 bg-white text-gray-700 border-gray-200"
                            >
                              <Eye className="mr-2 h-4 w-4 text-gray-600" />
                              View Details
                            </Button>
                            {experiment.status === "active" && (
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
                            )}
                            {experiment.status === "draft" && (
                              <>
                                <Button 
                                  variant="outline" 
                                  className="flex-1 hover:bg-green-50 hover:shadow-sm transition-all text-sm font-medium h-10 bg-white text-green-700 border-green-200"
                                  onClick={() => handleStartExperiment(experiment.id)}
                                  disabled={isLoading[experiment.id]}
                                >
                                  {isLoading[experiment.id] ? (
                                    <>
                                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-green-200 border-r-green-700" />
                                      Starting...
                                    </>
                                  ) : (
                                    <>
                                      <PlayCircle className="mr-2 h-4 w-4 text-green-700" />
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
                              </>
                            )}
                          </div>
                        </CardFooter>
                      </div>
                      <div className="md:w-2/3 h-full p-4 bg-gray-50/30 rounded-r-lg">
                        <div className="w-full h-full rounded-lg overflow-hidden border border-gray-200/80 shadow-sm group-hover:shadow-md transition-all duration-200 bg-white">
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
                      className="group flex flex-col md:flex-row w-full h-[400px] hover:shadow-lg transition-all duration-200 hover:border-gray-300 bg-white/80 backdrop-blur-sm"
                    >
                      <div className="flex flex-col md:w-1/3 border-r border-gray-100">
                        <CardHeader className="pb-2 px-8">
                          <div className="flex justify-between items-start gap-4">
                            <CardTitle className="text-xl font-medium text-gray-800 group-hover:text-gray-900 transition-colors leading-tight">
                              {experiment.name}
                            </CardTitle>
                            <Badge
                              className="bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 shadow-sm text-xs font-semibold px-3 py-1"
                            >
                              Active
                            </Badge>
                          </div>
                          <CardDescription className="text-gray-500 mt-2 text-sm leading-relaxed group-hover:text-gray-600">
                            {experiment.description || "No description available"}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 px-8">
                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
                                Participants
                              </p>
                              <p className="text-base font-semibold text-gray-800">
                                {experiment.segments.reduce((acc, segment) => acc + segment.participants, 0).toLocaleString()}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
                                Start Date
                              </p>
                              <p className="text-base font-semibold text-gray-800">
                                {experiment.start_date ? new Date(experiment.start_date).toLocaleDateString() : "Not started"}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
                                Conversion
                              </p>
                              <p className="text-base font-semibold text-gray-800">
                                {experiment.conversion !== null ? `${experiment.conversion}%` : "N/A"}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
                                ROI
                              </p>
                              <p className="text-base font-semibold text-gray-800">
                                {experiment.roi !== null ? `${experiment.roi}x` : "N/A"}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                        <div className="px-8 pb-4">
                          <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">Running Segments:</p>
                          <div className="flex flex-wrap gap-2">
                            {experiment.segments.map((segment) => (
                              <Badge 
                                key={segment.id}
                                variant="secondary" 
                                className="px-3 py-1 text-xs font-medium bg-gray-100/80 text-gray-700 hover:bg-gray-200/80 transition-colors border border-gray-200/50"
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
                              className="flex-1 hover:bg-gray-50 hover:shadow-sm transition-all text-sm font-medium h-10 bg-white text-gray-700 border-gray-200"
                            >
                              <Eye className="mr-2 h-4 w-4 text-gray-600" />
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
                      <div className="md:w-2/3 h-full p-4 bg-gray-50/30 rounded-r-lg">
                        <div className="w-full h-full rounded-lg overflow-hidden border border-gray-200/80 shadow-sm group-hover:shadow-md transition-all duration-200 bg-white">
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
                      className="group flex flex-col md:flex-row w-full h-[400px] hover:shadow-lg transition-all duration-200 hover:border-gray-300 bg-white/80 backdrop-blur-sm"
                    >
                      <div className="flex flex-col md:w-1/3 border-r border-gray-100">
                        <CardHeader className="pb-2 px-8">
                          <div className="flex justify-between items-start gap-4">
                            <CardTitle className="text-xl font-medium text-gray-800 group-hover:text-gray-900 transition-colors leading-tight">
                              {experiment.name}
                            </CardTitle>
                            <Badge
                              className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 shadow-sm text-xs font-semibold px-3 py-1"
                            >
                              Completed
                            </Badge>
                          </div>
                          <CardDescription className="text-gray-500 mt-2 text-sm leading-relaxed group-hover:text-gray-600">
                            {experiment.description || "No description available"}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 px-8">
                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
                                Participants
                              </p>
                              <p className="text-base font-semibold text-gray-800">
                                {experiment.segments.reduce((acc, segment) => acc + segment.participants, 0).toLocaleString()}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
                                Duration
                              </p>
                              <p className="text-base font-semibold text-gray-800">
                                {experiment.start_date && experiment.end_date 
                                  ? `${Math.ceil((new Date(experiment.end_date).getTime() - new Date(experiment.start_date).getTime()) / (1000 * 60 * 60 * 24))} days` 
                                  : "N/A"}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
                                Conversion
                              </p>
                              <p className="text-base font-semibold text-gray-800">
                                {experiment.conversion !== null ? `${experiment.conversion}%` : "N/A"}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
                                ROI
                              </p>
                              <p className="text-base font-semibold text-gray-800">
                                {experiment.roi !== null ? `${experiment.roi}x` : "N/A"}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                        <div className="px-8 pb-4">
                          <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">Segments:</p>
                          <div className="flex flex-wrap gap-2">
                            {experiment.segments.map((segment) => (
                              <Badge 
                                key={segment.id}
                                variant="secondary" 
                                className="px-3 py-1 text-xs font-medium bg-gray-100/80 text-gray-700 hover:bg-gray-200/80 transition-colors border border-gray-200/50"
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
                              className="flex-1 hover:bg-gray-50 hover:shadow-sm transition-all text-sm font-medium h-10 bg-white text-gray-700 border-gray-200"
                            >
                              <Eye className="mr-2 h-4 w-4 text-gray-600" />
                              View Results
                            </Button>
                            <Button 
                              variant="outline" 
                              className="flex-1 hover:bg-red-50 hover:shadow-sm transition-all text-sm font-medium h-10 bg-white text-red-700 border-red-200"
                            >
                              <XCircle className="mr-2 h-4 w-4 text-red-700" />
                              Reject
                            </Button>
                          </div>
                        </CardFooter>
                      </div>
                      <div className="md:w-2/3 h-full p-4 bg-gray-50/30 rounded-r-lg">
                        <div className="w-full h-full rounded-lg overflow-hidden border border-gray-200/80 shadow-sm group-hover:shadow-md transition-all duration-200 bg-white">
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
                      className="group flex flex-col md:flex-row w-full h-[400px] hover:shadow-lg transition-all duration-200 hover:border-gray-300 bg-white/80 backdrop-blur-sm"
                    >
                      <div className="flex flex-col md:w-1/3 border-r border-gray-100">
                        <CardHeader className="pb-2 px-8">
                          <div className="flex justify-between items-start gap-4">
                            <CardTitle className="text-xl font-medium text-gray-800 group-hover:text-gray-900 transition-colors leading-tight">
                              {experiment.name}
                            </CardTitle>
                            <Badge
                              className="bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 shadow-sm text-xs font-semibold px-3 py-1"
                            >
                              Draft
                            </Badge>
                          </div>
                          <CardDescription className="text-gray-500 mt-2 text-sm leading-relaxed group-hover:text-gray-600">
                            {experiment.description || "No description available"}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 px-8">
                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
                                Status
                              </p>
                              <p className="text-base font-semibold text-gray-800">
                                Not started
                              </p>
                            </div>
                            {experiment.hypothesis && (
                              <div className="space-y-2">
                                <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
                                  Hypothesis
                                </p>
                                <p className="text-base font-semibold text-gray-800">
                                  {experiment.hypothesis}
                                </p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                        <div className="px-8 pb-4">
                          <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">Target Segments:</p>
                          <div className="flex flex-wrap gap-2">
                            {experiment.segments.map((segment) => (
                              <Badge 
                                key={segment.id}
                                variant="secondary" 
                                className="px-3 py-1 text-xs font-medium bg-gray-100/80 text-gray-700 hover:bg-gray-200/80 transition-colors border border-gray-200/50"
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
                              className="flex-1 hover:bg-gray-50 hover:shadow-sm transition-all text-sm font-medium h-10 bg-white text-gray-700 border-gray-200"
                            >
                              <Eye className="mr-2 h-4 w-4 text-gray-600" />
                              View Details
                            </Button>
                            <Button 
                              variant="outline" 
                              className="flex-1 hover:bg-green-50 hover:shadow-sm transition-all text-sm font-medium h-10 bg-white text-green-700 border-green-200"
                              onClick={() => handleStartExperiment(experiment.id)}
                              disabled={isLoading[experiment.id]}
                            >
                              {isLoading[experiment.id] ? (
                                <>
                                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-green-200 border-r-green-700" />
                                  Starting...
                                </>
                              ) : (
                                <>
                                  <PlayCircle className="mr-2 h-4 w-4 text-green-700" />
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
                      <div className="md:w-2/3 h-full p-4 bg-gray-50/30 rounded-r-lg">
                        <div className="w-full h-full rounded-lg overflow-hidden border border-gray-200/80 shadow-sm group-hover:shadow-md transition-all duration-200 bg-white">
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