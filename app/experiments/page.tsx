"use client"

import { Button } from "@/app/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Badge } from "@/app/components/ui/badge"
import { Eye, PlayCircle, PenSquare, StopCircle, XCircle, Search, FlaskConical, ExternalLink, X, CalendarIcon, FileText, Tag, Users, User, HelpCircle, Link } from "@/app/components/ui/icons"
import { Input } from "@/app/components/ui/input"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { startExperiment, stopExperiment } from "./actions"
import { useToast } from "@/app/components/ui/use-toast"
import { useState, useEffect, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyState } from "@/app/components/ui/empty-state"
import { useCommandK } from "@/app/hooks/use-command-k"
import { cn } from "@/lib/utils"
import { Switch } from "@/app/components/ui/switch"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/app/components/ui/collapsible"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/app/components/ui/sheet"
import { Separator } from "@/app/components/ui/separator"
import { useSite } from "@/app/context/SiteContext"
import { Campaign } from "@/app/types"
import { useRouter } from "next/navigation"

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

// Function to handle missing values
function getDisplayValue(value: string | number | null | undefined, type: 'text' | 'number' = 'text'): string {
  if (value === undefined || value === null || value === '') return 'N/A'
  if (type === 'number' && typeof value === 'number') return value.toLocaleString()
  return String(value)
}

// Experiment Row Skeleton component
function ExperimentRowSkeleton() {
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
const ExperimentEmptyState = ({ status }: { status: "all" | "active" | "completed" | "draft" }) => {
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
function ExperimentRow({
  experiment,
  isExpanded,
  onToggle,
  isLoading,
  onStart,
  onStop,
  onView,
  isActive
}: {
  experiment: Experiment;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  isLoading: boolean;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onView: (experiment: Experiment) => void;
  isActive: boolean;
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
                            <div className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-green-200 dark:border-green-500/30 border-r-green-700 dark:border-r-green-400" />
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
                            <div className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-200 dark:border-red-500/30 border-r-red-700 dark:border-r-red-400" />
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
                          referrerPolicy="no-referrer"
                        />
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
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
  const [activeExperiments, setActiveExperiments] = useState<Record<string, boolean>>({})
  const { toast } = useToast()
  const { currentSite } = useSite()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Initialize the useCommandK hook
  useCommandK()

  // Effect to filter experiments based on search
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

  // Fetch experiments for the current site
  const fetchExperiments = useCallback(async () => {
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
      
      // Initialize expandedRows and activeExperiments
      const expandedRowsObj: Record<string, boolean> = {};
      const activeExperimentsObj: Record<string, boolean> = {};
      
      transformedData.forEach((experiment: Experiment) => {
        expandedRowsObj[experiment.id] = false;
        activeExperimentsObj[experiment.id] = experiment.status === 'active';
      });
      
      setExpandedRows(expandedRowsObj);
      setActiveExperiments(activeExperimentsObj);
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
  }, [toast, currentSite])

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

  // Effect to fetch data when site changes or component mounts
  useEffect(() => {
    if (!initialFetchDone && currentSite) {
      fetchExperiments()
      setInitialFetchDone(true)
    }
  }, [currentSite, initialFetchDone, fetchExperiments])

  // Fetch segments and campaigns when site changes
  useEffect(() => {
    if (currentSite) {
      fetchSegmentsAndCampaigns();
    }
  }, [currentSite, fetchSegmentsAndCampaigns]);

  // Reset initialFetchDone when site changes to trigger a new fetch
  useEffect(() => {
    setInitialFetchDone(false);
  }, [currentSite])
  
  // Effect for keyboard shortcut (Command+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

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
      
      setActiveExperiments(prev => ({
        ...prev,
        [experimentId]: true
      }));

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
      
      setActiveExperiments(prev => ({
        ...prev,
        [experimentId]: false
      }));

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
    // Navigate to experiment details page
    router.push(`/experiments/${experiment.id}`)
  }

  if (isLoadingData) {
    return (
      <div className="flex-1 p-0">
        <Tabs defaultValue="all" className="h-full">
          <StickyHeader>
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
                      ref={searchInputRef}
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
              <TabsContent value="all" className="space-y-4">
                {Array.from({ length: 3 }).map((_, index) => (
                  <ExperimentRowSkeleton key={index} />
                ))}
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
                <FlaskConical className="w-24 h-24 text-primary/40 mb-4" />
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
                  ref={searchInputRef}
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
            <TabsContent value="all" className="space-y-4">
              {filteredExperiments.length === 0 && searchQuery ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <p className="text-muted-foreground">No experiments found matching "{searchQuery}"</p>
                </div>
              ) : filteredExperiments.length === 0 ? (
                <ExperimentEmptyState status="all" />
              ) : (
                <div className="space-y-2">
                  {filteredExperiments.map((experiment) => (
                    <ExperimentRow
                      key={experiment.id}
                      experiment={experiment}
                      isExpanded={expandedRows[experiment.id] || false}
                      onToggle={toggleRow}
                      isLoading={isLoading[experiment.id] || false}
                      onStart={handleStartExperiment}
                      onStop={handleStopExperiment}
                      onView={handleViewDetails}
                      isActive={activeExperiments[experiment.id] || false}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="active" className="space-y-4">
              {filteredExperiments.filter(e => e.status === "active").length === 0 ? (
                <ExperimentEmptyState status="active" />
              ) : (
                <div className="space-y-2">
                  {filteredExperiments
                    .filter(e => e.status === "active")
                    .map((experiment) => (
                      <ExperimentRow
                        key={experiment.id}
                        experiment={experiment}
                        isExpanded={expandedRows[experiment.id] || false}
                        onToggle={toggleRow}
                        isLoading={isLoading[experiment.id] || false}
                        onStart={handleStartExperiment}
                        onStop={handleStopExperiment}
                        onView={handleViewDetails}
                        isActive={activeExperiments[experiment.id] || false}
                      />
                    ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="completed" className="space-y-4">
              {filteredExperiments.filter(e => e.status === "completed").length === 0 ? (
                <ExperimentEmptyState status="completed" />
              ) : (
                <div className="space-y-2">
                  {filteredExperiments
                    .filter(e => e.status === "completed")
                    .map((experiment) => (
                      <ExperimentRow
                        key={experiment.id}
                        experiment={experiment}
                        isExpanded={expandedRows[experiment.id] || false}
                        onToggle={toggleRow}
                        isLoading={isLoading[experiment.id] || false}
                        onStart={handleStartExperiment}
                        onStop={handleStopExperiment}
                        onView={handleViewDetails}
                        isActive={activeExperiments[experiment.id] || false}
                      />
                    ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="draft" className="space-y-4">
              {filteredExperiments.filter(e => e.status === "draft").length === 0 ? (
                <ExperimentEmptyState status="draft" />
              ) : (
                <div className="space-y-2">
                  {filteredExperiments
                    .filter(e => e.status === "draft")
                    .map((experiment) => (
                      <ExperimentRow
                        key={experiment.id}
                        experiment={experiment}
                        isExpanded={expandedRows[experiment.id] || false}
                        onToggle={toggleRow}
                        isLoading={isLoading[experiment.id] || false}
                        onStart={handleStartExperiment}
                        onStop={handleStopExperiment}
                        onView={handleViewDetails}
                        isActive={activeExperiments[experiment.id] || false}
                      />
                    ))}
                </div>
              )}
            </TabsContent>
          </div>
        </div>
      </Tabs>

      {/* Experiment Details Sheet */}
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
                    <FlaskConical className="h-5 w-5 text-primary" />
                  </div>
                  <SheetTitle className="text-2xl">{selectedExperiment.name}</SheetTitle>
                </div>
                <SheetDescription className="mt-2">
                  {selectedExperiment.description || "No description available"}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6 mt-2">
                {/* Basic Information */}
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

                {/* Dates and Performance */}
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
                        <p className="text-xs text-muted-foreground mb-1">ROI</p>
                        <p className="text-sm font-medium">
                          {selectedExperiment.roi !== null ? `${selectedExperiment.roi}%` : "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Segments */}
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

                {/* Preview */}
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