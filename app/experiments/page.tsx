"use client"

import { Button } from "@/app/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Badge } from "@/app/components/ui/badge"
import { Eye, PlayCircle, PenSquare, StopCircle, XCircle, Search, Beaker, ExternalLink, X, CalendarIcon, FileText, Tag, Users, User, HelpCircle, Link } from "@/app/components/ui/icons"
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/app/components/ui/sheet"
import { Separator } from "@/app/components/ui/separator"
import { useSite } from "@/app/context/SiteContext"
import { Campaign } from "@/app/types"

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
  campaign: Campaign | null
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
  const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [segments, setSegments] = useState<Array<{ id: string; name: string; description: string }>>([])
  const [campaigns, setCampaigns] = useState<Array<{ id: string; title: string; description: string }>>([])
  const { toast } = useToast()
  const { currentSite } = useSite()

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
      experiment.campaign?.title.toLowerCase().includes(query) ||
      experiment.segments.some(segment => 
        segment.name.toLowerCase().includes(query)
      )
    )
    setFilteredExperiments(filtered)
  }, [searchQuery, experiments])

  // Memoizar fetchExperiments para evitar recreaciones en cada renderizado
  const fetchExperiments = useCallback(async () => {
    if (initialFetchDone) return;
    
    // If no site is selected, don't fetch experiments
    if (!currentSite) {
      setIsLoadingData(false);
      setExperiments([]);
      setFilteredExperiments([]);
      return;
    }
    
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
          campaign_id,
          experiment_segments (
            segment:segments (
              id,
              name
            ),
            participants
          )
        `)
        .eq('site_id', currentSite.id) // Filter experiments by the current site
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

      // Fetch associated campaigns
      const campaignIds = experimentsData
        .filter((exp: any) => exp.campaign_id)
        .map((exp: any) => exp.campaign_id);
      
      let campaignsMap: Record<string, Campaign> = {};
      
      if (campaignIds.length > 0) {
        const { data: campaignsData, error: campaignsError } = await supabase
          .from("campaigns")
          .select("*")
          .in("id", campaignIds);
          
        if (campaignsError) {
          console.error("Error fetching campaigns:", campaignsError);
        } else if (campaignsData) {
          campaignsMap = campaignsData.reduce((acc: Record<string, any>, campaign: any) => {
            acc[campaign.id] = {
              id: campaign.id,
              title: campaign.title,
              description: campaign.description,
              priority: campaign.priority,
              status: campaign.status,
              type: campaign.type,
              // Other necessary campaign properties
            };
            return acc;
          }, {});
        }
      }

      // Transform the data to match our interface
      const transformedData = experimentsData.map((experiment: any) => ({
        ...experiment,
        segments: experiment.experiment_segments.map((es: any) => ({
          id: es.segment.id,
          name: es.segment.name,
          participants: es.participants || 0
        })),
        campaign: experiment.campaign_id ? campaignsMap[experiment.campaign_id] : null
      }))

      setExperiments(transformedData)
      setFilteredExperiments(transformedData)
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
  }, [toast, initialFetchDone, currentSite])

  // Fetch segments and campaigns for experiment creation
  const fetchSegmentsAndCampaigns = useCallback(async () => {
    if (!currentSite) return;
    
    try {
      const supabase = createClient();
      
      // Fetch segments
      const { data: segmentsData, error: segmentsError } = await supabase
        .from("segments")
        .select("id, name, description")
        .eq('site_id', currentSite.id)
        .order('created_at', { ascending: false });
        
      if (segmentsError) {
        console.error("Error fetching segments:", segmentsError);
        return;
      }
      
      setSegments(segmentsData || []);
      
      // Fetch campaigns
      const { data: campaignsData, error: campaignsError } = await supabase
        .from("campaigns")
        .select("id, title, description")
        .eq('site_id', currentSite.id)
        .in('status', ['active', 'pending'])
        .order('created_at', { ascending: false });
        
      if (campaignsError) {
        console.error("Error fetching campaigns:", campaignsError);
        return;
      }
      
      setCampaigns(campaignsData || []);
      
    } catch (error) {
      console.error("Error fetching data for experiment creation:", error);
    }
  }, [currentSite]);

  // Efecto para la carga inicial de datos
  useEffect(() => {
    fetchExperiments()
  }, [fetchExperiments])

  // Fetch segments and campaigns when site changes
  useEffect(() => {
    fetchSegmentsAndCampaigns();
  }, [fetchSegmentsAndCampaigns]);

  // Reset initialFetchDone when site changes to trigger a new fetch
  useEffect(() => {
    setInitialFetchDone(false);
  }, [currentSite])

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

  const handleViewDetails = (experiment: Experiment) => {
    setSelectedExperiment(experiment);
    setIsDetailOpen(true);
  }

  // Function to create a new experiment
  const handleCreateExperiment = async (values: any) => {
    try {
      const supabase = createClient();
      
      // Create the experiment
      const { data: experimentData, error: experimentError } = await supabase
        .from("experiments")
        .insert([{
          name: values.name,
          description: values.description,
          hypothesis: values.hypothesis,
          status: values.status,
          site_id: values.site_id,
          user_id: values.user_id,
          start_date: values.start_date,
          end_date: values.end_date,
          conversion: values.conversion,
          roi: values.roi,
          preview_url: values.preview_url,
          campaign_id: values.campaign_id
        }])
        .select()
        .single();
        
      if (experimentError) {
        return { error: experimentError.message };
      }
      
      // Create experiment segments
      if (values.segments && values.segments.length > 0) {
        const experimentSegments = values.segments.map((segmentId: string) => ({
          experiment_id: experimentData.id,
          segment_id: segmentId,
          participants: 0
        }));
        
        const { error: segmentsError } = await supabase
          .from("experiment_segments")
          .insert(experimentSegments);
          
        if (segmentsError) {
          return { error: `Experiment created but failed to add segments: ${segmentsError.message}` };
        }
      }
      
      // Refresh the experiments list
      fetchExperiments();
      
      return { data: experimentData };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "An unexpected error occurred" };
    }
  };

  if (isLoadingData) {
    return (
      <div className="flex-1 p-0">
        <Tabs defaultValue="all" className="h-full">
          <StickyHeader showAIButton={false}>
            <div className="px-16 pt-0 w-full">
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-8">
                  <TabsList>
                    <TabsTrigger value="all" className="text-sm font-medium">All Experiments</TabsTrigger>
                    <TabsTrigger value="active" className="text-sm font-medium">Active</TabsTrigger>
                    <TabsTrigger value="completed" className="text-sm font-medium">Completed</TabsTrigger>
                    <TabsTrigger value="draft" className="text-sm font-medium">Draft</TabsTrigger>
                  </TabsList>
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
                </div>
                <div className="ml-auto">
                  {/* Any other buttons would go here */}
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

  // If no site is selected, show a message
  if (!currentSite) {
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
                    disabled
                    type="text"
                    value=""
                    icon={<Search className="h-4 w-4 text-muted-foreground" />}
                  />
                </div>
                <div className="flex-1"></div>
              </div>
            </div>
          </StickyHeader>
          
          <div className="p-8 space-y-4">
            <div className="px-8">
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <Beaker className="w-24 h-24 text-primary/40 mb-4" />
                <h2 className="text-2xl font-semibold mb-2">No site selected</h2>
                <p className="text-muted-foreground max-w-md">
                  Please select a site from the dropdown in the header to view experiments for that site.
                </p>
              </div>
            </div>
          </div>
        </Tabs>
      </div>
    )
  }

  return (
    <div className="flex-1 p-0">
      <Tabs defaultValue="all" className="h-full">
        <StickyHeader showAIButton={false}>
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
                                Campaign
                              </p>
                              <p className="text-base font-semibold text-card-foreground">
                                {experiment.campaign ? (
                                  <Badge variant="outline" className="bg-primary/10 text-primary hover:bg-primary/20">
                                    {experiment.campaign.title}
                                  </Badge>
                                ) : (
                                  "None"
                                )}
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
                              onClick={() => handleViewDetails(experiment)}
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
                                  <PenSquare className="mr-2 h-4 w-4 text-blue-700" />
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
                                Campaign
                              </p>
                              <p className="text-base font-semibold text-card-foreground">
                                {experiment.campaign ? (
                                  <Badge variant="outline" className="bg-primary/10 text-primary hover:bg-primary/20">
                                    {experiment.campaign.title}
                                  </Badge>
                                ) : (
                                  "None"
                                )}
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
                              onClick={() => handleViewDetails(experiment)}
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
                                Campaign
                              </p>
                              <p className="text-base font-semibold text-card-foreground">
                                {experiment.campaign ? (
                                  <Badge variant="outline" className="bg-primary/10 text-primary hover:bg-primary/20">
                                    {experiment.campaign.title}
                                  </Badge>
                                ) : (
                                  "None"
                                )}
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
                              className="flex-1 hover:bg-accent hover:shadow-sm transition-all text-sm font-medium h-10 bg-background text-foreground border-border"
                              onClick={() => handleViewDetails(experiment)}
                            >
                              <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
                              View Details
                            </Button>
                            <Button 
                              variant="outline" 
                              className="flex-1 transition-all text-sm font-medium h-10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/30 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <X className="mr-2 h-4 w-4" />
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
                              onClick={() => handleViewDetails(experiment)}
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

      {/* Modal de detalles del experimento */}
      <Sheet open={isDetailOpen} onOpenChange={(open) => {
        setIsDetailOpen(open);
        if (!open) {
          setSelectedExperiment(null);
        }
      }}>
        <SheetContent className="sm:max-w-md border-l border-border/40 bg-background overflow-y-auto">
          {selectedExperiment && (
            <>
              <SheetHeader className="pb-4">
                <div className="flex gap-3 items-center">
                  <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                    <Beaker className="h-5 w-5 text-primary" />
                  </div>
                  <SheetTitle className="text-2xl">{selectedExperiment.name}</SheetTitle>
                </div>
                <SheetDescription className="mt-2">
                  {selectedExperiment.description || "No description available"}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6 mt-2">
                {/* Información básica */}
                <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                    Basic Information
                  </h3>
                  
                  <div className="space-y-4">
                    {selectedExperiment.hypothesis && (
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                          <HelpCircle className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground mb-1">Hypothesis</p>
                          <p className="text-sm font-medium">{selectedExperiment.hypothesis}</p>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1">Status</p>
                        <Badge
                          className={cn(
                            "text-xs font-semibold px-3 py-1 border shadow-sm transition-colors duration-200",
                            selectedExperiment.status === "draft" && "bg-secondary/20 text-secondary-foreground border-secondary/20",
                            selectedExperiment.status === "active" && "bg-success/20 text-success border-success/20",
                            selectedExperiment.status === "completed" && "bg-info/20 text-info border-info/20"
                          )}
                        >
                          {selectedExperiment.status === "draft" ? "Draft" : 
                            selectedExperiment.status === "active" ? "Active" : "Completed"}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                        <Tag className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1">Campaign</p>
                        <p className="text-sm font-medium">
                          {selectedExperiment.campaign ? (
                            <Badge variant="outline" className="bg-primary/10 text-primary hover:bg-primary/20">
                              {selectedExperiment.campaign.title}
                            </Badge>
                          ) : (
                            "None"
                          )}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                        <Tag className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1">ID</p>
                        <p className="text-sm font-medium">{selectedExperiment.id}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fechas y rendimiento */}
                <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                    Dates and Performance
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                        <CalendarIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1">Start Date</p>
                        <p className="text-sm font-medium">
                          {selectedExperiment.start_date ? new Date(selectedExperiment.start_date).toLocaleDateString() : "Not started"}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1">End Date</p>
                        <p className="text-sm font-medium">
                          {selectedExperiment.end_date ? new Date(selectedExperiment.end_date).toLocaleDateString() : "In progress"}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                        <Tag className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1">Conversion</p>
                        <p className="text-sm font-medium">
                          {selectedExperiment.conversion !== null ? `${selectedExperiment.conversion}%` : "N/A"}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                        <Tag className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1">Campaign</p>
                        <p className="text-sm font-medium">
                          {selectedExperiment.campaign ? (
                            <Badge variant="outline" className="bg-primary/10 text-primary hover:bg-primary/20">
                              {selectedExperiment.campaign.title}
                            </Badge>
                          ) : (
                            "None"
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Segmentos */}
                <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                    Segments
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1">Total Participants</p>
                        <p className="text-sm font-medium">
                          {selectedExperiment.segments.reduce((acc, segment) => acc + segment.participants, 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px', marginTop: '4px' }}>
                        <Tag className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1">Active Segments</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {selectedExperiment.segments.map((segment) => (
                            <Badge 
                              key={segment.id}
                              variant="secondary" 
                              className="px-3 py-1 text-xs font-medium"
                            >
                              {segment.name} ({segment.participants.toLocaleString()})
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Previsualización */}
                {selectedExperiment.preview_url && (
                  <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
                    <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                      Preview
                    </h3>
                    
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                          <Link className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground mb-1">Preview URL</p>
                          <a 
                            href={selectedExperiment.preview_url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-sm font-medium text-primary hover:underline flex items-center"
                          >
                            {selectedExperiment.preview_url}
                            <ExternalLink className="ml-1 h-3 w-3" />
                          </a>
                        </div>
                      </div>
                      
                      <div className="rounded-md border overflow-hidden mt-2 h-40">
                        <iframe 
                          src={selectedExperiment.preview_url} 
                          className="w-full h-full"
                          title={`Preview of ${selectedExperiment.name}`}
                          sandbox="allow-same-origin allow-scripts"
                          loading="lazy"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 flex justify-center">
                {selectedExperiment.status === "draft" && (
                  <Button 
                    variant="outline" 
                    className="w-full transition-all text-sm font-medium h-10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/30 hover:bg-green-50 dark:hover:bg-green-900/20"
                    onClick={() => {
                      handleStartExperiment(selectedExperiment.id);
                      setIsDetailOpen(false);
                    }}
                    disabled={isLoading[selectedExperiment.id]}
                  >
                    {isLoading[selectedExperiment.id] ? (
                      <>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-green-200 dark:border-green-500/30 border-r-green-700 dark:border-r-green-400" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <PlayCircle className="mr-2 h-4 w-4 text-green-700 dark:text-green-400" />
                        Start Experiment
                      </>
                    )}
                  </Button>
                )}
                
                {selectedExperiment.status === "active" && (
                  <Button 
                    variant="outline" 
                    className="w-full transition-all text-sm font-medium h-10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/30 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onClick={() => {
                      handleStopExperiment(selectedExperiment.id);
                      setIsDetailOpen(false);
                    }}
                    disabled={isLoading[selectedExperiment.id]}
                  >
                    {isLoading[selectedExperiment.id] ? (
                      <>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-red-200 dark:border-red-500/30 border-r-red-700 dark:border-r-red-400" />
                        Stopping...
                      </>
                    ) : (
                      <>
                        <StopCircle className="mr-2 h-4 w-4 text-red-700 dark:text-red-400" />
                        Stop Experiment
                      </>
                    )}
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
} 