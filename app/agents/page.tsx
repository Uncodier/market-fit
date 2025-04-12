"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Input } from "@/app/components/ui/input"
import { Button } from "@/app/components/ui/button"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Search, List, TableRows, PlayCircle } from "@/app/components/ui/icons"
import { ToggleGroup, ToggleGroupItem } from "@/app/components/ui/toggle-group"
import { Agent, AgentActivity } from "@/app/types/agents"
import { useLayout } from "@/app/context/LayoutContext"
import { AgentSelectionContext } from "@/app/components/agents/agent-selection-context"
import { SimpleAgentCard } from "@/app/components/agents/simple-agent-card"
import { GridAgentRow } from "@/app/components/agents/grid-agent-row"
import { ZoomableCanvas } from "@/app/components/agents/zoomable-canvas"
import { AnimatedConnectionLine } from "@/app/components/agents/animated-connection-line"
import { CommandList } from "@/app/components/agents/command-list"
import { Command } from "@/app/components/agents/command-item"
import { CommandsPanel } from "@/app/components/agents/commands-panel"
import { agents } from "@/app/data/mock-agents"

// Type-safe version of the example commands
const exampleCommands: Command[] = [
  {
    id: "cmd1",
    name: "Generate SEO Content",
    description: "Create SEO optimized content for blog post",
    status: "completed",
    timestamp: "2024-01-30T10:15:00Z",
    duration: "45s"
  },
  {
    id: "cmd2",
    name: "Analyze Keyword Density",
    description: "Check keyword usage and suggest improvements",
    status: "completed",
    timestamp: "2024-01-30T09:45:00Z",
    duration: "12s"
  },
  {
    id: "cmd3",
    name: "Generate Meta Descriptions",
    description: "Create meta descriptions for 5 new blog posts",
    status: "failed",
    timestamp: "2024-01-29T16:20:00Z",
    errorMessage: "API rate limit exceeded"
  },
  {
    id: "cmd4",
    name: "Update Content Links",
    description: "Update internal links in existing content",
    status: "pending",
    timestamp: "2024-01-31T11:30:00Z"
  }
];

export default function AgentsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"hierarchy" | "grid">("hierarchy")
  const [expandedAgentIds, setExpandedAgentIds] = useState<string[]>([])
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [selectedActivity, setSelectedActivity] = useState<AgentActivity | null>(null)
  const { isLayoutCollapsed } = useLayout()
  const [activeCommandTab, setActiveCommandTab] = useState<string>("all")
  const router = useRouter()
  
  // Layout configuration
  const sidebarWidth = isLayoutCollapsed ? 72 : 240; // Width in pixels when collapsed or expanded
  const commandPanelWidth = 300; // Width in pixels
  const topbarHeight = 64; // Height of the topbar in pixels
  
  // Lead agent and data analyst agent
  const leadAgent = agents.find(agent => agent.id === "1");
  const dataAnalystAgent = agents.find(agent => agent.id === "4");
  const executionAgents = agents.filter(agent => !["1", "4"].includes(agent.id));
  
  // Handler functions
  const handleManageAgent = (agent: Agent) => {
    console.log('Managing agent:', agent.name);
    router.push(`/agents/${agent.id}`);
  };
  
  const handleChatWithAgent = (agent: Agent) => {
    console.log('Chatting with agent:', agent.name);
    setSelectedAgent(agent);
  };
  
  const handleToggleActivities = (agent: Agent) => {
    setExpandedAgentIds(prev => {
      if (prev.includes(agent.id)) {
        return prev.filter(id => id !== agent.id);
      } else {
        return [...prev, agent.id];
      }
    });
  };
  
  const handleExecuteActivity = (agent: Agent, activity: AgentActivity) => {
    console.log('Executing activity:', activity.name, 'with agent:', agent.name);
    setSelectedAgent(agent);
    setSelectedActivity(activity);
  };
  
  const isAgentExpanded = (agentId: string) => expandedAgentIds.includes(agentId);
  
  // Lead Agent Card component
  const LeadAgentCard = ({ agent }: { agent: Agent }) => (
    <div className="w-[458px] mb-10 px-4">
      <SimpleAgentCard 
        agent={agent} 
        onManage={handleManageAgent}
        onChat={handleChatWithAgent}
        onToggleActivities={handleToggleActivities}
        showActivities={isAgentExpanded(agent.id)}
        onExecuteActivity={handleExecuteActivity}
        setSelectedAgent={setSelectedAgent}
        className="border-primary/50 shadow-md"
      />
    </div>
  );
  
  // Function to render grid view
  const renderGridView = (type?: "marketing" | "sales" | "support") => {
    const filteredAgents = agents.filter(agent => 
      (!type || agent.type === type) && 
      (!searchQuery || 
       agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
       agent.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    
    if (filteredAgents.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] text-center p-8">
          <p className="text-lg font-medium text-muted-foreground mb-2">
            No agents found{type ? ` for ${type}` : ""}{searchQuery ? ` matching "${searchQuery}"` : ""}
          </p>
        </div>
      );
    }
    
    return (
      <div className="space-y-4">
        {filteredAgents.map((agent) => (
          <GridAgentRow 
            key={agent.id}
            agent={agent}
            isExpanded={isAgentExpanded(agent.id)}
            onToggleExpand={handleToggleActivities}
            onManage={handleManageAgent}
            onChat={handleChatWithAgent}
            onExecuteActivity={handleExecuteActivity}
            setSelectedAgent={setSelectedAgent}
          />
        ))}
      </div>
    );
  };

  return (
    <AgentSelectionContext.Provider value={{ selectedAgent, setSelectedAgent, selectedActivity, setSelectedActivity }}>
      <div className="flex h-full relative bg-background">
        {/* Main content area */}
        <div 
          className="flex-1 w-full"
          style={{ 
            width: `calc(100vw - ${sidebarWidth}px - ${commandPanelWidth}px)`,
            maxWidth: `calc(100vw - ${sidebarWidth}px - ${commandPanelWidth}px)`,
            backgroundColor: "rgba(0, 0, 0, 0.02)"
          }}
        >
          <Tabs defaultValue="all" className="space-y-4">
            <StickyHeader>
              <div className="px-16 pt-0">
                <div className="flex items-center gap-4">
                  <div className="flex-1 flex items-center gap-4">
                    <TabsList>
                      <TabsTrigger value="all">All Team</TabsTrigger>
                      <TabsTrigger value="marketing">Marketing</TabsTrigger>
                      <TabsTrigger value="sales">Sales</TabsTrigger>
                    </TabsList>
                    
                    <div className="relative w-64">
                      <Input 
                        placeholder="Search agents..." 
                        className="w-full"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        icon={<Search className="h-4 w-4 text-muted-foreground" />}
                      />
                      <kbd className="pointer-events-none absolute right-2 top-4 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                        <span className="text-xs">⌘</span>K
                      </kbd>
                    </div>
                  </div>
                  
                  <div>
                    <ToggleGroup type="single" value={viewMode} onValueChange={(value: string) => value && setViewMode(value as "hierarchy" | "grid")}>
                      <ToggleGroupItem value="hierarchy" aria-label="Toggle hierarchy view" className="px-2">
                        <TableRows className="h-4 w-4" />
                      </ToggleGroupItem>
                      <ToggleGroupItem value="grid" aria-label="Toggle grid view" className="px-2">
                        <List className="h-4 w-4" />
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                </div>
              </div>
            </StickyHeader>
            
            <div 
              className="overflow-hidden"
              style={{
                padding: viewMode === "grid" ? "16px" : "0",
                margin: viewMode === "grid" ? "16px 0" : "0",
                display: "flex",
                flexDirection: "column"
              }}
            >
              <TabsContent value="all" className="m-0">
                <div className={`${viewMode === "grid" ? "px-8" : ""}`}>
                  {viewMode === "hierarchy" ? (
                    <div className="flex flex-col items-center">
                      <div className="w-full">
                        <ZoomableCanvas>
                          <div className="flex flex-col items-center">
                            <div className="pt-2 flex flex-col items-center">
                              <h2 className="text-2xl font-bold mb-10">Growth Team Structure</h2>
                              
                              {/* Lead Manager Card - Top Level */}
                              {leadAgent && 
                                (!searchQuery || 
                                 leadAgent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                 leadAgent.description.toLowerCase().includes(searchQuery.toLowerCase())) && 
                                <LeadAgentCard agent={leadAgent} />
                              }
                              
                              {/* Connecting Line - only show if both leadAgent and dataAnalystAgent are visible */}
                              {leadAgent && dataAnalystAgent &&
                                (!searchQuery || 
                                 leadAgent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                 leadAgent.description.toLowerCase().includes(searchQuery.toLowerCase())) &&
                                (!searchQuery || 
                                 dataAnalystAgent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                 dataAnalystAgent.description.toLowerCase().includes(searchQuery.toLowerCase())) && (
                                <div className="flex justify-center relative">
                                  <div className="h-20 w-0.5 bg-border"></div>
                                  <AnimatedConnectionLine direction="down" className="h-20 opacity-100" dotColor="var(--primary)" />
                                </div>
                              )}
                              
                              {/* Data Analyst - Middle Level */}
                              {dataAnalystAgent && 
                                (!searchQuery || 
                                 dataAnalystAgent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                 dataAnalystAgent.description.toLowerCase().includes(searchQuery.toLowerCase())) && (
                                <>
                                  <div className="flex justify-center mb-10">
                                    <div className="w-[458px] px-4">
                                      <SimpleAgentCard 
                                        agent={dataAnalystAgent} 
                                        onManage={handleManageAgent}
                                        onChat={handleChatWithAgent}
                                        onToggleActivities={handleToggleActivities}
                                        showActivities={isAgentExpanded(dataAnalystAgent.id)}
                                        onExecuteActivity={handleExecuteActivity}
                                        setSelectedAgent={setSelectedAgent}
                                        className="border-primary/30 shadow-md"
                                      />
                                    </div>
                                  </div>
                                  
                                  {/* Connecting Line - only show if filtered execution agents exist */}
                                  {executionAgents.some(agent => 
                                    !searchQuery || 
                                    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    agent.description.toLowerCase().includes(searchQuery.toLowerCase())
                                  ) && (
                                    <div className="flex justify-center relative">
                                      <div className="h-20 w-0.5 bg-border"></div>
                                      <AnimatedConnectionLine direction="down" className="h-20 opacity-100" dotColor="var(--primary)" />
                                    </div>
                                  )}
                                </>
                              )}
                              
                              {/* Execution Teams - Bottom Level with connections */}
                              <div className="relative mt-2">
                                {/* Horizontal connecting line - only if there are filtered execution agents */}
                                {executionAgents.some(agent => 
                                  !searchQuery || 
                                  agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                  agent.description.toLowerCase().includes(searchQuery.toLowerCase())
                                ) && (
                                  <div className="absolute top-0 left-1/2 w-[90%] h-0.5 bg-border transform -translate-x-1/2 relative">
                                    <AnimatedConnectionLine direction="right" className="w-[50%] left-0 opacity-100" speed="normal" dotColor="var(--primary)" />
                                    <AnimatedConnectionLine direction="left" className="w-[50%] right-0 opacity-100" speed="normal" dotColor="var(--primary)" />
                                  </div>
                                )}
                                
                                {/* Get the sales specialist and customer support */}
                                {(() => {
                                  const salesSpecialist = executionAgents.find(agent => agent.id === "5");
                                  const customerSupport = executionAgents.find(agent => agent.id === "7");
                                  const filteredAgents = executionAgents.filter(agent => 
                                    agent.id !== "7" && 
                                    (!searchQuery || 
                                    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    agent.description.toLowerCase().includes(searchQuery.toLowerCase()))
                                  );
                                  
                                  // Hide customerSupport if salesSpecialist is filtered out
                                  const showCustomerSupport = salesSpecialist && 
                                    customerSupport && 
                                    (!searchQuery || 
                                     salesSpecialist.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                     salesSpecialist.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                     customerSupport.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                     customerSupport.description.toLowerCase().includes(searchQuery.toLowerCase()));
                                  
                                  // If no agents match the search query, show a message
                                  if (filteredAgents.length === 0 && !showCustomerSupport) {
                                    return (
                                      <div className="flex flex-col items-center justify-center min-h-[200px] text-center p-8">
                                        <p className="text-lg font-medium text-muted-foreground mb-2">
                                          No agents found matching "{searchQuery}"
                                        </p>
                                      </div>
                                    );
                                  }
                                  
                                  return (
                                    <>
                                      {/* Vertical connecting lines */}
                                      <div className={
                                        `grid gap-12 px-8 ${
                                          filteredAgents.length <= 4 ? "grid-cols-" + filteredAgents.length : "grid-cols-4"
                                        }`
                                      }>
                                        {filteredAgents.map((_, index) => (
                                          index < 5 && (
                                            <div key={index} className="flex justify-center relative">
                                              <div className="h-20 w-0.5 bg-border"></div>
                                              <AnimatedConnectionLine direction="down" className="h-20 opacity-100" dotColor="var(--primary)" />
                                            </div>
                                          )
                                        ))}
                                      </div>
                                      
                                      {/* Team member cards - scrollable container */}
                                      <div className="pb-12">
                                        <div className={
                                          `grid grid-flow-col auto-cols-min gap-12 px-8 mt-8 min-w-full`
                                        }>
                                          {filteredAgents.map((agent) => (
                                            <div key={agent.id} className="w-[458px] px-4">
                                              <SimpleAgentCard
                                                agent={agent}
                                                onManage={handleManageAgent}
                                                onChat={handleChatWithAgent}
                                                onToggleActivities={handleToggleActivities}
                                                showActivities={isAgentExpanded(agent.id)}
                                                onExecuteActivity={handleExecuteActivity}
                                                setSelectedAgent={setSelectedAgent}
                                              />
                                              
                                              {/* If this is the Sales Specialist, show Customer Support beneath it */}
                                              {agent.id === "5" && customerSupport && showCustomerSupport && (
                                                <div className="mt-20 ml-10">
                                                  {/* Clean Connecting Lines - No dot */}
                                                  <div className="relative">
                                                    {/* Vertical line */}
                                                    <div className="absolute top-[-40px] left-[-28px] h-[calc(100%+108px)] w-0.5 bg-border rounded-full"></div>
                                                    {/* Horizontal line */}
                                                    <div className="absolute top-[48px] left-[-28px] w-7 h-0.5 bg-border rounded-full"></div>
                                                  </div>
                                                  
                                                  {/* Label for hierarchical relationship */}
                                                  <div className="absolute top-[-14px] left-[-16px] bg-background text-xs px-2 py-1 text-muted-foreground rounded font-medium border shadow-sm">
                                                    Reports to
                                                  </div>
                                                  
                                                  <SimpleAgentCard
                                                    agent={customerSupport}
                                                    onManage={handleManageAgent}
                                                    onChat={handleChatWithAgent}
                                                    onToggleActivities={handleToggleActivities}
                                                    showActivities={isAgentExpanded(customerSupport.id)}
                                                    onExecuteActivity={handleExecuteActivity}
                                                    setSelectedAgent={setSelectedAgent}
                                                    className="border-primary/20 shadow-md relative"
                                                  />
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </>
                                  );
                                })()}
                                
                                {/* Feedback Loop Visualization - only show if there are visible agents */}
                                {executionAgents.some(agent => 
                                  !searchQuery || 
                                  agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                  agent.description.toLowerCase().includes(searchQuery.toLowerCase())
                                ) && (
                                  <div className="mt-12 flex flex-col items-center">
                                    <div className="w-[90%] h-0.5 bg-border relative">
                                      <AnimatedConnectionLine direction="left" className="w-full opacity-100" speed="slow" dotColor="var(--primary)" />
                                    </div>
                                    <div className="mt-6 mb-3 text-center">
                                      <span className="px-6 py-2 bg-muted rounded-md text-sm font-medium">
                                        Feedback Loop
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </ZoomableCanvas>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {renderGridView()}
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="marketing" className="m-0">
                <div className="px-8">
                  {viewMode === "hierarchy" ? (
                    <div className="flex flex-col items-center">
                      <div className="w-full">
                        <ZoomableCanvas>
                          <div className="flex flex-col items-center">
                            <div className="pt-2 flex flex-col items-center">
                              <h2 className="text-2xl font-bold">Marketing Team</h2>
                              
                              {/* Lead Manager Card - Top Level */}
                              {leadAgent && leadAgent.type === "marketing" && 
                                (!searchQuery || 
                                 leadAgent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                 leadAgent.description.toLowerCase().includes(searchQuery.toLowerCase())) && 
                                <LeadAgentCard agent={leadAgent} />
                              }
                              
                              {/* Connecting Line */}
                              {leadAgent && leadAgent.type === "marketing" && dataAnalystAgent && dataAnalystAgent.type === "marketing" &&
                                (!searchQuery || 
                                 leadAgent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                 leadAgent.description.toLowerCase().includes(searchQuery.toLowerCase())) &&
                                (!searchQuery || 
                                 dataAnalystAgent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                 dataAnalystAgent.description.toLowerCase().includes(searchQuery.toLowerCase())) && (
                                <div className="flex justify-center relative">
                                  <div className="h-20 w-0.5 bg-border"></div>
                                  <AnimatedConnectionLine direction="down" className="h-20 opacity-80" />
                                </div>
                              )}
                              
                              {/* Data Analyst - Middle Level */}
                              {dataAnalystAgent && dataAnalystAgent.type === "marketing" && 
                                (!searchQuery || 
                                 dataAnalystAgent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                 dataAnalystAgent.description.toLowerCase().includes(searchQuery.toLowerCase())) && (
                                <>
                                  <div className="flex justify-center mb-10">
                                    <div className="w-[458px] px-4">
                                      <SimpleAgentCard 
                                        agent={dataAnalystAgent} 
                                        onManage={handleManageAgent}
                                        onChat={handleChatWithAgent}
                                        onToggleActivities={handleToggleActivities}
                                        showActivities={isAgentExpanded(dataAnalystAgent.id)}
                                        onExecuteActivity={handleExecuteActivity}
                                        setSelectedAgent={setSelectedAgent}
                                        className="border-primary/30 shadow-md"
                                      />
                                    </div>
                                  </div>
                                  
                                  {/* Connecting Line - only show if filtered marketing agents exist */}
                                  {executionAgents.filter(agent => 
                                    agent.type === "marketing" && 
                                    (!searchQuery || 
                                    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    agent.description.toLowerCase().includes(searchQuery.toLowerCase()))
                                  ).length > 0 && (
                                    <div className="flex justify-center relative">
                                      <div className="h-20 w-0.5 bg-border"></div>
                                      <AnimatedConnectionLine direction="down" className="h-20 opacity-80" />
                                    </div>
                                  )}
                                </>
                              )}
                              
                              {/* Marketing team members */}
                              {(() => {
                                const marketingAgents = executionAgents.filter(agent => 
                                  agent.type === "marketing" && 
                                  (!searchQuery || 
                                  agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                  agent.description.toLowerCase().includes(searchQuery.toLowerCase()))
                                );
                                
                                if (marketingAgents.length > 0) {
                                  return (
                                    <div className="relative mt-2">
                                      {/* Horizontal connecting line */}
                                      <div className="absolute top-0 left-1/2 w-[90%] h-0.5 bg-border transform -translate-x-1/2"></div>
                                      
                                      {/* Vertical connecting lines */}
                                      <div className={
                                        `grid gap-12 px-8 ${
                                          marketingAgents.length <= 4 ? "grid-cols-" + marketingAgents.length : "grid-cols-4"
                                        }`
                                      }>
                                        {marketingAgents.map((_, index) => (
                                          index < 5 && (
                                            <div key={index} className="flex justify-center relative">
                                              <div className="h-20 w-0.5 bg-border"></div>
                                              <AnimatedConnectionLine direction="down" className="h-20 opacity-100" dotColor="var(--primary)" />
                                            </div>
                                          )
                                        ))}
                                      </div>
                                      
                                      {/* Team member cards - scrollable container */}
                                      <div className="pb-12">
                                        <div className={
                                          `grid grid-flow-col auto-cols-min gap-12 px-8 mt-8 min-w-full`
                                        }>
                                          {marketingAgents.map((agent) => (
                                            <div key={agent.id} className="w-[458px] px-4">
                                              <SimpleAgentCard
                                                agent={agent}
                                                onManage={handleManageAgent}
                                                onChat={handleChatWithAgent}
                                                onToggleActivities={handleToggleActivities}
                                                showActivities={isAgentExpanded(agent.id)}
                                                onExecuteActivity={handleExecuteActivity}
                                                setSelectedAgent={setSelectedAgent}
                                              />
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                      
                                      {/* Feedback Loop Visualization */}
                                      <div className="mt-12 flex flex-col items-center">
                                        <div className="w-[90%] h-0.5 bg-border"></div>
                                        <div className="mt-6 mb-3 text-center">
                                          <span className="px-6 py-2 bg-muted rounded-md text-sm font-medium">
                                            Feedback Loop
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }
                                
                                // No marketing agents found
                                return (
                                  <div className="flex flex-col items-center justify-center min-h-[200px] text-center p-8">
                                    <p className="text-lg font-medium text-muted-foreground mb-2">
                                      No marketing agents found{searchQuery ? ` matching "${searchQuery}"` : ""}
                                    </p>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </ZoomableCanvas>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {renderGridView("marketing")}
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="sales" className="m-0">
                <div className="px-8">
                  {viewMode === "hierarchy" ? (
                    <div className="flex flex-col items-center">
                      <div className="w-full">
                        <ZoomableCanvas>
                          <div className="flex flex-col items-center">
                            <div className="pt-2 flex flex-col items-center">
                              <h2 className="text-2xl font-bold">Sales Team</h2>
                              
                              {/* Sales team members */}
                              {(() => {
                                const salesAgents = agents.filter(agent => 
                                  agent.type === "sales" && 
                                  (!searchQuery || 
                                  agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                  agent.description.toLowerCase().includes(searchQuery.toLowerCase()))
                                );
                                
                                if (salesAgents.length > 0) {
                                  // Get the sales specialist and customer support
                                  const salesSpecialist = salesAgents.find(agent => agent.id === "5");
                                  const customerSupport = salesAgents.find(agent => agent.id === "7");
                                  
                                  return (
                                    <div>
                                      {salesSpecialist && (
                                        <div className="w-[458px] mb-10 px-4">
                                          <SimpleAgentCard
                                            agent={salesSpecialist}
                                            onManage={handleManageAgent}
                                            onChat={handleChatWithAgent}
                                            onToggleActivities={handleToggleActivities}
                                            showActivities={isAgentExpanded(salesSpecialist.id)}
                                            onExecuteActivity={handleExecuteActivity}
                                            setSelectedAgent={setSelectedAgent}
                                            className="border-primary/30 shadow-md"
                                          />
                                        </div>
                                      )}
                                      
                                      {salesSpecialist && customerSupport && (
                                        <div className="flex justify-center relative mb-10">
                                          <div className="h-20 w-0.5 bg-border"></div>
                                          <AnimatedConnectionLine direction="down" className="h-20 opacity-80" />
                                        </div>
                                      )}
                                      
                                      {customerSupport && (
                                        <div className="w-[458px] px-2">
                                          <SimpleAgentCard
                                            agent={customerSupport}
                                            onManage={handleManageAgent}
                                            onChat={handleChatWithAgent}
                                            onToggleActivities={handleToggleActivities}
                                            showActivities={isAgentExpanded(customerSupport.id)}
                                            onExecuteActivity={handleExecuteActivity}
                                            setSelectedAgent={setSelectedAgent}
                                            className="border-primary/20 shadow-md"
                                          />
                                        </div>
                                      )}
                                    </div>
                                  );
                                }
                                
                                // No sales agents found
                                return (
                                  <div className="flex flex-col items-center justify-center min-h-[200px] text-center p-8">
                                    <p className="text-lg font-medium text-muted-foreground mb-2">
                                      No sales agents found{searchQuery ? ` matching "${searchQuery}"` : ""}
                                    </p>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </ZoomableCanvas>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {renderGridView("sales")}
                    </div>
                  )}
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
        
        {/* Command Panel - fixed position */}
        <div 
          className="w-[300px] border-l bg-background/90 backdrop-blur-sm flex flex-col overflow-hidden fixed right-0 h-[calc(100vh-64px)] z-[9999]"
          style={{ top: `${topbarHeight}px` }}
        >
          <CommandsPanel />
        </div>
      </div>
    </AgentSelectionContext.Provider>
  )
}