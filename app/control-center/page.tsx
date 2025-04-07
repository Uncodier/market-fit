"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyState } from "@/app/components/ui/empty-state"
import { Settings, Filter } from "@/app/components/ui/icons"
import { KanbanColumn } from "@/app/components/control-center/kanban-column"
import { CalendarDateRangePicker } from "@/app/components/ui/date-range-picker"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Button } from "@/app/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
import { SearchInput } from "@/app/components/ui/search-input"
import { useCommandK } from "@/app/hooks/use-command-k"
import { useSite } from "@/app/context/SiteContext"
import { getCampaigns } from "@/app/control-center/actions/campaigns/read"
import type { Campaign } from "@/app/types"
import { toast } from "sonner"

// Mock data for the Kanban board
const mockTasks: {
  [key: string]: Array<{
    id: string;
    title: string;
    description: string;
    priority: "high" | "medium" | "low";
    dueDate: string;
    assignees: number;
    issues: number;
    revenue?: {
      actual?: number;
      projected?: number;
      estimated?: number;
      currency?: string;
    };
    budget?: {
      allocated?: number;
      remaining?: number;
      currency?: string;
    };
    costs?: {
      fixed?: number;
      variable?: number;
      total?: number;
      currency?: string;
    };
    subtasks: Array<{
      id: string;
      title: string;
      status: "completed" | "in-progress" | "pending";
    }>;
  }>
} = {
  inbound: [
    {
      id: "1",
      title: "SEO Content Strategy",
      description: "Develop content strategy focused on organic search growth",
      priority: "high" as const,
      dueDate: "Oct 15",
      assignees: 3,
      issues: 1,
      revenue: {
        actual: 12000,
        projected: 45000,
        estimated: 60000
      },
      budget: {
        allocated: 20000,
        remaining: 8000
      },
      costs: {
        fixed: 7000,
        variable: 5000,
        total: 12000
      },
      subtasks: [
        { id: "1-1", title: "Keyword research", status: "completed" as const },
        { id: "1-2", title: "Content calendar", status: "in-progress" as const },
        { id: "1-3", title: "Competitor analysis", status: "pending" as const }
      ]
    }
  ],
  outbound: [
    {
      id: "2",
      title: "Email Campaign",
      description: "Q4 promotional email sequence for product launch",
      priority: "medium" as const,
      dueDate: "Oct 18",
      assignees: 2,
      issues: 0,
      revenue: {
        actual: 32500,
        projected: 48000,
        estimated: 55000
      },
      budget: {
        allocated: 15000,
        remaining: 3000
      },
      costs: {
        fixed: 4000,
        variable: 8000,
        total: 12000
      },
      subtasks: [
        { id: "2-1", title: "Email design templates", status: "completed" as const },
        { id: "2-2", title: "Copywriting", status: "in-progress" as const },
        { id: "2-3", title: "Segment audience", status: "pending" as const }
      ]
    }
  ],
  branding: [
    {
      id: "3",
      title: "Brand Refresh",
      description: "Update brand guidelines and visual identity",
      priority: "high" as const,
      dueDate: "Oct 10",
      assignees: 4,
      issues: 1,
      revenue: {
        actual: 0,
        projected: 0,
        estimated: 25000
      },
      budget: {
        allocated: 35000,
        remaining: 10000
      },
      costs: {
        fixed: 15000,
        variable: 10000,
        total: 25000
      },
      subtasks: [
        { id: "3-1", title: "Logo variations", status: "completed" as const },
        { id: "3-2", title: "Typography system", status: "in-progress" as const },
        { id: "3-3", title: "Color palette", status: "completed" as const },
        { id: "3-4", title: "Brand voice document", status: "pending" as const }
      ]
    }
  ],
  product: [
    {
      id: "4",
      title: "Product Marketing Kit",
      description: "Create marketing materials for new product features",
      priority: "high" as const,
      dueDate: "Oct 12",
      assignees: 3,
      issues: 2,
      revenue: {
        actual: 22000,
        projected: 75000,
        estimated: 90000
      },
      budget: {
        allocated: 40000,
        remaining: 15000
      },
      costs: {
        fixed: 10000,
        variable: 15000, 
        total: 25000
      },
      subtasks: [
        { id: "4-1", title: "Feature comparison matrix", status: "completed" as const },
        { id: "4-2", title: "Benefits explainer video", status: "in-progress" as const },
        { id: "4-3", title: "Sales enablement docs", status: "pending" as const }
      ]
    }
  ],
  events: [
    {
      id: "5",
      title: "Q2 Planning Meeting",
      description: "Organize and facilitate the Q2 planning meeting",
      priority: "high" as const,
      dueDate: "Oct 5",
      assignees: 5,
      issues: 1,
      revenue: {
        actual: 28000,
        projected: 28000,
        estimated: 28000
      },
      budget: {
        allocated: 30000,
        remaining: 2000
      },
      costs: {
        fixed: 20000,
        variable: 8000,
        total: 28000
      },
      subtasks: [
        { id: "5-1", title: "Prepare agenda", status: "completed" as const },
        { id: "5-2", title: "Create presentation slides", status: "in-progress" as const },
        { id: "5-3", title: "Book meeting room", status: "completed" as const },
        { id: "5-4", title: "Distribute materials", status: "pending" as const }
      ]
    }
  ],
  success: [
    {
      id: "6",
      title: "Customer Success Program",
      description: "Develop materials for customer onboarding and education",
      priority: "medium" as const,
      dueDate: "Oct 20",
      assignees: 2,
      issues: 0,
      revenue: {
        actual: 15000,
        projected: 35000,
        estimated: 52000
      },
      budget: {
        allocated: 25000,
        remaining: 10000
      },
      costs: {
        fixed: 8000,
        variable: 7000,
        total: 15000
      },
      subtasks: [
        { id: "6-1", title: "Onboarding workflow", status: "completed" as const },
        { id: "6-2", title: "Tutorial videos", status: "in-progress" as const },
        { id: "6-3", title: "Help documentation", status: "pending" as const }
      ]
    }
  ],
  account: [
    {
      id: "7",
      title: "Key Account Strategy",
      description: "Develop personalized marketing for key accounts",
      priority: "high" as const,
      dueDate: "Oct 8",
      assignees: 2,
      issues: 1,
      revenue: {
        actual: 120000,
        projected: 150000,
        estimated: 180000
      },
      budget: {
        allocated: 50000,
        remaining: -10000
      },
      costs: {
        fixed: 30000,
        variable: 30000,
        total: 60000
      },
      subtasks: [
        { id: "7-1", title: "Account profiles", status: "completed" as const },
        { id: "7-2", title: "Custom content creation", status: "in-progress" as const },
        { id: "7-3", title: "Account-specific roadmap", status: "pending" as const }
      ]
    }
  ],
  community: [
    {
      id: "8",
      title: "Community Forum Launch",
      description: "Launch user community forum and engagement program",
      priority: "medium" as const,
      dueDate: "Nov 15",
      assignees: 3,
      issues: 2,
      revenue: {
        actual: 5000,
        projected: 18000,
        estimated: 25000
      },
      budget: {
        allocated: 20000,
        remaining: 8000
      },
      costs: {
        fixed: 7000,
        variable: 5000,
        total: 12000
      },
      subtasks: [
        { id: "8-1", title: "Platform selection", status: "completed" as const },
        { id: "8-2", title: "Moderation guidelines", status: "in-progress" as const },
        { id: "8-3", title: "Initial content seeding", status: "pending" as const }
      ]
    }
  ],
  guerrilla: [
    {
      id: "9",
      title: "Street Team Campaign",
      description: "Create unconventional marketing activations in key cities",
      priority: "low" as const,
      dueDate: "Nov 5",
      assignees: 4,
      issues: 1,
      revenue: {
        actual: 0,
        projected: 15000,
        estimated: 25000
      },
      budget: {
        allocated: 12000,
        remaining: 2000
      },
      costs: {
        fixed: 5000,
        variable: 5000,
        total: 10000
      },
      subtasks: [
        { id: "9-1", title: "Location scouting", status: "completed" as const },
        { id: "9-2", title: "Promo material design", status: "in-progress" as const },
        { id: "9-3", title: "Team training", status: "pending" as const }
      ]
    }
  ],
  affiliate: [
    {
      id: "10",
      title: "Affiliate Program Revamp",
      description: "Update affiliate program structure and commission model",
      priority: "medium" as const,
      dueDate: "Oct 25",
      assignees: 2,
      issues: 0,
      revenue: {
        actual: 64500,
        projected: 85000,
        estimated: 110000
      },
      budget: {
        allocated: 30000,
        remaining: 5000
      },
      costs: {
        fixed: 15000,
        variable: 10000,
        total: 25000
      },
      subtasks: [
        { id: "10-1", title: "Commission structure", status: "completed" as const },
        { id: "10-2", title: "Affiliate portal updates", status: "in-progress" as const },
        { id: "10-3", title: "Promotional materials", status: "pending" as const }
      ]
    }
  ],
  experiential: [
    {
      id: "11",
      title: "Product Experience Hub",
      description: "Create interactive product experience centers in key markets",
      priority: "high" as const,
      dueDate: "Dec 10",
      assignees: 5,
      issues: 3,
      revenue: {
        actual: 35000,
        projected: 95000,
        estimated: 130000
      },
      budget: {
        allocated: 100000,
        remaining: 30000
      },
      costs: {
        fixed: 40000,
        variable: 30000,
        total: 70000
      },
      subtasks: [
        { id: "11-1", title: "Location selection", status: "completed" as const },
        { id: "11-2", title: "Experience flow design", status: "in-progress" as const },
        { id: "11-3", title: "Staff training", status: "pending" as const }
      ]
    }
  ],
  programmatic: [
    {
      id: "12",
      title: "Programmatic Ad Campaign",
      description: "Set up automated digital advertising across multiple channels",
      priority: "medium" as const,
      dueDate: "Oct 22",
      assignees: 2,
      issues: 1,
      revenue: {
        actual: 22000,
        projected: 38000,
        estimated: 48500
      },
      budget: {
        allocated: 25000,
        remaining: 5000
      },
      costs: {
        fixed: 8000,
        variable: 12000,
        total: 20000
      },
      subtasks: [
        { id: "12-1", title: "Channel selection", status: "completed" as const },
        { id: "12-2", title: "Creative assets development", status: "in-progress" as const },
        { id: "12-3", title: "Audience targeting rules", status: "pending" as const }
      ]
    }
  ],
  performance: [
    {
      id: "13",
      title: "SEM Optimization Campaign",
      description: "Optimize search engine marketing campaigns for key products",
      priority: "high" as const,
      dueDate: "Nov 2",
      assignees: 3,
      issues: 1,
      revenue: {
        actual: 42000,
        projected: 68000,
        estimated: 85000
      },
      budget: {
        allocated: 35000,
        remaining: 12000
      },
      costs: {
        fixed: 10000,
        variable: 13000,
        total: 23000
      },
      subtasks: [
        { id: "13-1", title: "Keyword optimization", status: "completed" as const },
        { id: "13-2", title: "Ad copy refresh", status: "in-progress" as const },
        { id: "13-3", title: "Budget reallocation", status: "pending" as const }
      ]
    }
  ],
  publicRelations: [
    {
      id: "14",
      title: "Media Relations Campaign",
      description: "Build relationships with industry journalists and publications",
      priority: "medium" as const,
      dueDate: "Nov 12",
      assignees: 2,
      issues: 0,
      revenue: {
        actual: 18000,
        projected: 32000,
        estimated: 45000
      },
      budget: {
        allocated: 22000,
        remaining: 8000
      },
      costs: {
        fixed: 9000,
        variable: 5000,
        total: 14000
      },
      subtasks: [
        { id: "14-1", title: "Media list development", status: "completed" as const },
        { id: "14-2", title: "Press release creation", status: "in-progress" as const },
        { id: "14-3", title: "Press event planning", status: "pending" as const }
      ]
    }
  ]
};

function ControlCenterSkeleton() {
  return (
    <div className="flex-1 p-0">
      {/* Kanban board skeleton */}
      <div className="px-8 pb-8">
        <div className="w-full overflow-x-auto">
          <div className="flex gap-6 p-6 min-w-max bg-muted/5 rounded-lg shadow-sm">
            {/* Kanban columns - create 5 columns to represent different campaign types */}
            {[1, 2, 3, 4, 5].map((columnIndex) => (
              <div key={columnIndex} className="w-[300px] flex-shrink-0 bg-card rounded-lg shadow-sm border p-4">
                {/* Column header */}
                <div className="flex items-center justify-between mb-4">
                  <Skeleton className="h-5 w-32" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-10 rounded-full" />
                    <Skeleton className="h-5 w-10 rounded-full" />
                  </div>
                </div>
                
                {/* Cards in each column - 3 cards per column */}
                {[1, 2, 3].map((cardIndex) => (
                  <div key={cardIndex} className="mb-3 bg-card rounded-md border shadow-sm">
                    {/* Card header */}
                    <div className="p-3 pb-2">
                      <div className="flex justify-between items-start gap-3 mb-2">
                        <Skeleton className="h-5 w-[70%]" />
                        <Skeleton className="h-5 w-[15%] rounded-full" />
                      </div>
                      <div className="flex items-center gap-1.5 mt-2">
                        <Skeleton className="h-3.5 w-3.5 rounded-full" />
                        <Skeleton className="h-3.5 w-16" />
                      </div>
                    </div>
                    
                    {/* Card content */}
                    <div className="p-3 pt-1 space-y-3">
                      {/* Description */}
                      <Skeleton className="h-4 w-[90%]" />
                      
                      {/* Expandable summary row */}
                      <div className="flex items-center justify-between bg-muted/30 p-2.5 rounded-md">
                        <div className="flex gap-3">
                          <div className="flex items-center gap-1.5">
                            <Skeleton className="h-3.5 w-3.5 rounded-full" />
                            <Skeleton className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Skeleton className="h-3.5 w-3.5 rounded-full" />
                            <Skeleton className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex items-center">
                            <Skeleton className="h-3.5 w-3.5 rounded-full mr-1.5" />
                            <Skeleton className="h-3.5 w-10" />
                          </div>
                        </div>
                        <Skeleton className="h-4 w-4 rounded-full" />
                      </div>
                      
                      {/* Expanded content is not shown in skeleton */}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ControlCenterPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>(["high", "medium", "low"]);
  const [segments, setSegments] = useState<Array<{ id: string; name: string; description: string }>>([]);
  const [requirements, setRequirements] = useState<Array<{ 
    id: string; 
    title: string; 
    description: string;
    status?: string;
    priority?: "high" | "medium" | "low";
    completion_status?: string;
  }>>([]);
  const { currentSite } = useSite();
  
  // Initialize the hook useCommandK
  useCommandK();

  // Group campaigns by type
  const campaignsByType: { [key: string]: Campaign[] } = {};
  campaigns.forEach(campaign => {
    if (!campaignsByType[campaign.type]) {
      campaignsByType[campaign.type] = [];
    }
    
    // Only include campaigns that match the search and priority filters
    if (
      (searchQuery === "" || 
        campaign.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        campaign.description.toLowerCase().includes(searchQuery.toLowerCase())) &&
      selectedPriorities.includes(campaign.priority)
    ) {
      campaignsByType[campaign.type].push(campaign);
    }
  });

  // Fetch campaigns and requirements
  useEffect(() => {
    const fetchData = async () => {
      if (!currentSite) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        
        // Fetch campaigns
        const campaignsResponse = await getCampaigns(currentSite.id);
        if (campaignsResponse.error) {
          toast.error(`Failed to load campaigns: ${campaignsResponse.error}`);
        } else if (campaignsResponse.data) {
          setCampaigns(campaignsResponse.data);
        }

        // Fetch existing segments
        try {
          const response = await fetch(`/api/segments?siteId=${currentSite.id}`);
          if (response.ok) {
            const segmentsData = await response.json();
            setSegments(segmentsData);
          }
        } catch (segErr) {
          console.error("Error loading segments:", segErr);
          // Use empty segments array if fetch fails
          setSegments([]);
        }

        // Fetch requirements
        try {
          const reqResponse = await fetch(`/api/requirements?siteId=${currentSite.id}`);
          if (reqResponse.ok) {
            const requirementsData = await reqResponse.json();
            setRequirements(requirementsData);
          }
        } catch (reqErr) {
          console.error("Error loading requirements:", reqErr);
          // Use empty requirements array if fetch fails
          setRequirements([]);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [currentSite]);

  return (
    <div className="flex-1 p-0 h-auto overflow-visible">
      <StickyHeader>
        <div className="flex items-center px-16 w-full">
          <div className="flex items-center gap-4">
            <Tabs defaultValue="active" className="w-auto">
              <TabsList>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
              </TabsList>
            </Tabs>
            <SearchInput
              placeholder="Search campaigns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="h-4 w-4" />
                  Filters
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[200px]">
                <DropdownMenuCheckboxItem
                  checked={selectedPriorities.includes("high")}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedPriorities([...selectedPriorities, "high"]);
                    } else {
                      setSelectedPriorities(selectedPriorities.filter(p => p !== "high"));
                    }
                  }}
                >
                  High Priority
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={selectedPriorities.includes("medium")}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedPriorities([...selectedPriorities, "medium"]);
                    } else {
                      setSelectedPriorities(selectedPriorities.filter(p => p !== "medium"));
                    }
                  }}
                >
                  Medium Priority
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={selectedPriorities.includes("low")}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedPriorities([...selectedPriorities, "low"]);
                    } else {
                      setSelectedPriorities(selectedPriorities.filter(p => p !== "low"));
                    }
                  }}
                >
                  Low Priority
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </StickyHeader>

      {isLoading ? (
        <div className="px-8 pb-8">
          <div className="w-full overflow-x-auto">
            <div className="flex gap-6 p-6 min-w-max bg-muted/5 rounded-lg shadow-sm">
              {/* Kanban columns - create 5 columns to represent different campaign types */}
              {[1, 2, 3, 4, 5].map((columnIndex) => (
                <div key={columnIndex} className="w-[300px] flex-shrink-0 bg-card rounded-lg shadow-sm border p-4">
                  {/* Column header */}
                  <div className="flex items-center justify-between mb-4">
                    <Skeleton className="h-5 w-32" />
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-10 rounded-full" />
                      <Skeleton className="h-5 w-10 rounded-full" />
                    </div>
                  </div>
                  
                  {/* Cards in each column - 3 cards per column */}
                  {[1, 2, 3].map((cardIndex) => (
                    <div key={cardIndex} className="mb-3 bg-card rounded-md border shadow-sm">
                      {/* Card header */}
                      <div className="p-3 pb-2">
                        <div className="flex justify-between items-start gap-3 mb-2">
                          <Skeleton className="h-5 w-[70%]" />
                          <Skeleton className="h-5 w-[15%] rounded-full" />
                        </div>
                        <div className="flex items-center gap-1.5 mt-2">
                          <Skeleton className="h-3.5 w-3.5 rounded-full" />
                          <Skeleton className="h-3.5 w-16" />
                        </div>
                      </div>
                      
                      {/* Card content */}
                      <div className="p-3 pt-1 space-y-3">
                        {/* Description */}
                        <Skeleton className="h-4 w-[90%]" />
                        
                        {/* Expandable summary row */}
                        <div className="flex items-center justify-between bg-muted/30 p-2.5 rounded-md">
                          <div className="flex gap-3">
                            <div className="flex items-center gap-1.5">
                              <Skeleton className="h-3.5 w-3.5 rounded-full" />
                              <Skeleton className="h-3.5 w-3.5" />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Skeleton className="h-3.5 w-3.5 rounded-full" />
                              <Skeleton className="h-3.5 w-3.5" />
                            </div>
                            <div className="flex items-center">
                              <Skeleton className="h-3.5 w-3.5 rounded-full mr-1.5" />
                              <Skeleton className="h-3.5 w-10" />
                            </div>
                          </div>
                          <Skeleton className="h-4 w-4 rounded-full" />
                        </div>
                        
                        {/* Expanded content is not shown in skeleton */}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="px-8 pb-8">
          <Tabs defaultValue="active" className="h-auto">
            <TabsContent value="active" className="w-full h-auto overflow-visible">
              {campaigns.length > 0 ? (
                <div className="w-full overflow-x-auto overflow-y-visible">
                  <div className="flex gap-6 p-6 pb-8 bg-muted/5 rounded-lg shadow-sm h-full min-w-max">
                    {Object.entries(campaignsByType).map(([type, typeCampaigns]) => (
                      <KanbanColumn
                        key={type}
                        title={type.charAt(0).toUpperCase() + type.slice(1)}
                        tasks={typeCampaigns.map(campaign => {
                          // Get requirements associated with this campaign
                          const campaignRequirements = requirements
                            ? requirements
                                .filter(req => 
                                  campaign.requirements?.includes(req.id)
                                )
                                .map(req => ({
                                  id: req.id,
                                  title: req.title,
                                  description: req.description || "",
                                  status: req.status || "backlog",
                                  priority: req.priority || "medium",
                                  completion_status: req.completion_status || "pending"
                                }))
                            : [];
                            
                          return {
                            id: campaign.id,
                            title: campaign.title,
                            description: campaign.description,
                            priority: campaign.priority,
                            dueDate: new Date(campaign.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                            assignees: campaign.assignees,
                            issues: campaign.issues,
                            revenue: campaign.revenue,
                            budget: campaign.budget,
                            costs: {
                              fixed: 0,
                              variable: 0,
                              total: campaign.budget?.allocated && campaign.budget?.remaining ? 
                                campaign.budget.allocated - campaign.budget.remaining : 0,
                              currency: campaign.budget?.currency || "USD"
                            },
                            requirements: campaignRequirements
                          };
                        })}
                        searchQuery={searchQuery}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={<Settings className="h-12 w-12 text-muted-foreground" />}
                  title="No Active Campaigns"
                  description="You don't have any active campaigns yet. Create your first campaign to get started."
                  features={[
                    {
                      title: "Campaign Management",
                      items: [
                        "Organize marketing initiatives",
                        "Track performance and ROI",
                        "Manage subtasks and deadlines"
                      ]
                    }
                  ]}
                />
              )}
            </TabsContent>

            <TabsContent value="pending">
              <EmptyState
                icon={<Settings className="h-12 w-12 text-muted-foreground" />}
                title="No Pending Campaigns"
                description="You don't have any pending campaigns at the moment."
                features={[
                  {
                    title: "Create New Campaign",
                    items: [
                      "Set up campaign details",
                      "Assign team members",
                      "Schedule launch date"
                    ]
                  }
                ]}
              />
            </TabsContent>

            <TabsContent value="completed">
              <EmptyState
                icon={<Settings className="h-12 w-12 text-muted-foreground" />}
                title="No Completed Campaigns"
                description="You don't have any completed campaigns yet."
                features={[
                  {
                    title: "Campaign Archives",
                    items: [
                      "View past performance",
                      "Review campaign metrics",
                      "Export reports"
                    ]
                  }
                ]}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
} 