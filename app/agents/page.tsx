"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
import { Skeleton } from "@/app/components/ui/skeleton"
import { agents as mockAgents } from "@/app/data/mock-agents"
import { useSite } from "@/app/context/SiteContext"
import { createClient } from "@/lib/supabase/client"
import { Database } from "@/lib/types/database.types"
import { createConversation } from "@/app/services/chat-service"
import { useAuthContext } from "@/app/components/auth/auth-provider"
import { toast } from "react-hot-toast"
import { SimpleAgentCardSkeleton, GridAgentRowSkeleton } from "@/app/components/agents/skeleton-components"
import { useCommandK } from "@/app/hooks/use-command-k"
import { useActivityExecution } from "@/app/hooks/use-activity-execution"

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

// Define a type for the database agent
type DatabaseAgent = {
  id: string;
  name: string;
  description: string | null;
  type: "sales" | "support" | "marketing" | "product";
  status: "active" | "inactive" | "training";
  conversations: number;
  success_rate: number;
  last_active: string | null;
  role: string | null;
};

// Extender el tipo Agent para incluir datos personalizados
interface ExtendedAgent extends Agent {
  dbData?: {
    id: string;
    name: string;
    description: string;
    status: string;
    type: string;
    conversations: number;
    successRate: number;
    lastActive: string;
    role: string;
  };
  isDisabled?: boolean;
}

// Para depuración: Función para imprimir un agente de forma concisa
const logAgent = (prefix: string, agent: ExtendedAgent) => {
  console.log(`${prefix}: ${agent.id} - ${agent.name} - isDisabled: ${agent.isDisabled} - dbData: ${agent.dbData ? 'SI' : 'NO'}`);
};

// Wrap the export in a Suspense boundary
const AgentsPageWrapper = () => {
  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading agents...</div>}>
      <AgentsPageContent />
    </Suspense>
  )
}

function AgentsPageContent() {
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"hierarchy" | "grid">("hierarchy")
  const [expandedAgentIds, setExpandedAgentIds] = useState<string[]>([])
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [selectedActivity, setSelectedActivity] = useState<AgentActivity | null>(null)
  const { isLayoutCollapsed } = useLayout()
  const [activeCommandTab, setActiveCommandTab] = useState<string>("all")
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(true)
  const [agents, setAgents] = useState<ExtendedAgent[]>([])
  const { currentSite } = useSite()
  const supabase = createClient()
  const { user } = useAuthContext()
  
  // Layout configuration
  const sidebarWidth = isLayoutCollapsed ? 72 : 240; // Width in pixels when collapsed or expanded
  const commandPanelWidth = 300; // Width in pixels
  const topbarHeight = 64; // Height of the topbar in pixels
  
  // Lead agent and data analyst agent
  const leadAgent = agents.find(agent => agent.id === "1");
  const dataAnalystAgent = agents.find(agent => agent.id === "4");
  const executionAgents = agents.filter(agent => !["1", "4"].includes(agent.id));
  
  // Initialize command+k hook
  useCommandK()
  
  // Initialize activity execution states
  const { setActivityState, getActivityState, activityStates } = useActivityExecution()
  
  // Fetch agents from API
  useEffect(() => {
    const fetchAgents = async () => {
      setIsLoading(true);
      try {
        // Comenzamos con los agentes mock originales para mantener la estructura del diagrama
        let modifiedMockAgents = [...mockAgents] as ExtendedAgent[];
        
        // Inicializar todos los agentes con isDisabled a false
        modifiedMockAgents = modifiedMockAgents.map(agent => ({
          ...agent, 
          isDisabled: false
        }));
        
        // Log antes de cualquier modificación
        console.log("Agentes iniciales:", modifiedMockAgents.map(a => a.name));
        
        if (currentSite) {
          console.log("Fetching agents for site:", currentSite.id);
          
          // Fetch agents from the database
          const { data: agentsData, error } = await supabase
            .from('agents')
            .select('*')
            .eq('site_id', currentSite.id);
          
          if (error) {
            console.error("Error fetching agents:", error);
          } else if (agentsData && agentsData.length > 0) {
            console.log("Agents loaded from database:", agentsData);
            
            // Para cada agente de la DB, buscar su equivalente en mockAgents y añadir datos de personalización
            agentsData.forEach((dbAgent: DatabaseAgent) => {
              // Buscar coincidencia en los mock agents
              const mockIndex = modifiedMockAgents.findIndex(mockAgent => {
                // Verificar coincidencia por nombre, rol o función similar (para Customer Support)
                const roleMatch = 
                  mockAgent.role === dbAgent.role || 
                  mockAgent.name === dbAgent.role ||
                  (!mockAgent.role && mockAgent.name === dbAgent.name);
                
                const customerSupportMatch = 
                  dbAgent.type === 'sales' && 
                  mockAgent.id === "7" && // ID específico del template Customer Support
                  (dbAgent.description?.toLowerCase().includes('support') || 
                   dbAgent.role?.toLowerCase().includes('support') ||
                   dbAgent.name.toLowerCase().includes('support'));
                
                return roleMatch || customerSupportMatch;
              });
              
              if (mockIndex !== -1) {
                // Si encontramos una coincidencia, actualizar los datos pero mantener estructura
                console.log(`Found matching template for DB agent "${dbAgent.name}" (${dbAgent.id}): ${modifiedMockAgents[mockIndex].name} (${modifiedMockAgents[mockIndex].id})`);
                
                // Caso especial para Customer Support:
                // Si tenemos un agente con nombre "Customer Support" en la DB,
                // mantener el template original pero personalizarlo
                if (dbAgent.name === "Customer Support" || dbAgent.role === "Customer Support") {
                  console.log(`Este agente de DB es exactamente Customer Support, actualizando el template original`);
                }
                
                // Añadir los datos de personalización al agente mock
                modifiedMockAgents[mockIndex] = {
                  ...modifiedMockAgents[mockIndex], // Mantener estructura y datos mock originales
                  dbData: { // Añadir datos de la DB como una prop separada
                    id: dbAgent.id,
                    name: dbAgent.name,
                    description: dbAgent.description || "",
                    status: dbAgent.status === "training" ? "learning" : dbAgent.status,
                    type: dbAgent.type,
                    conversations: dbAgent.conversations || 0,
                    successRate: dbAgent.success_rate || 0,
                    lastActive: dbAgent.last_active || new Date().toISOString(),
                    role: dbAgent.role || dbAgent.name
                  },
                  // Actualizar propiedades visuales importantes
                  name: dbAgent.name,
                  description: dbAgent.description || modifiedMockAgents[mockIndex].description,
                  status: dbAgent.status === "training" ? "learning" : dbAgent.status,
                  // Asegurarse de que NO está deshabilitado
                  isDisabled: false
                };
                
                // Si el nombre es Customer Support pero el ID de la DB es diferente, es un duplicado
                // Tenemos que encontrar y deshabilitar el original si existe
                if ((dbAgent.name === "Customer Support" || dbAgent.role === "Customer Support") && 
                     modifiedMockAgents[mockIndex].id !== "7") {
                  const csIndex = modifiedMockAgents.findIndex(a => a.id === "7");
                  if (csIndex !== -1) {
                    console.log(`Encontrado template original de Customer Support, deshabilitándolo`);
                    modifiedMockAgents[csIndex] = {
                      ...modifiedMockAgents[csIndex],
                      isDisabled: true
                    };
                  }
                }
                
                console.log(`Updated agent "${modifiedMockAgents[mockIndex].name}" with DB data`);
              } else {
                // Si no hay coincidencia, añadir el agente de la DB como un nuevo agente mock
                console.log(`No matching template for DB agent "${dbAgent.name}" (${dbAgent.id}), creating new agent`);
                
                // Crear un nuevo agente a partir del de la DB
                const newAgent: ExtendedAgent = {
                  id: dbAgent.id,
                  name: dbAgent.name,
                  description: dbAgent.description || "",
                  type: dbAgent.type as "sales" | "support" | "marketing" | "product",
                  status: dbAgent.status === "training" ? "learning" : dbAgent.status as "active" | "inactive" | "learning" | "error",
                  conversations: dbAgent.conversations || 0,
                  successRate: dbAgent.success_rate || 0,
                  lastActive: dbAgent.last_active || new Date().toISOString(),
                  icon: "User", // Default icon
                  dbData: {
                    id: dbAgent.id,
                    name: dbAgent.name,
                    description: dbAgent.description || "",
                    status: dbAgent.status === "training" ? "learning" : dbAgent.status,
                    type: dbAgent.type,
                    conversations: dbAgent.conversations || 0,
                    successRate: dbAgent.success_rate || 0,
                    lastActive: dbAgent.last_active || new Date().toISOString(),
                    role: dbAgent.role || dbAgent.name
                  },
                  isDisabled: false
                };
                
                // Añadirlo a la lista
                modifiedMockAgents.push(newAgent);
              }
            });
          }
        }
        
        // Log final de los agentes
        console.log("Agentes finales para renderizar:", modifiedMockAgents.map(a => ({
          id: a.id,
          name: a.name,
          isDisabled: a.isDisabled,
          hasDbData: !!a.dbData
        })));
        
        setAgents(modifiedMockAgents);
      } catch (error) {
        console.error("Error in fetchAgents:", error);
        // Fall back to mock agents on error
        setAgents(mockAgents.map(a => ({...a, isDisabled: false})) as ExtendedAgent[]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAgents();
  }, [currentSite]);
  
  // Handler functions
  const handleManageAgent = (agent: Agent) => {
    console.log('Managing agent:', agent.name);
    
    // Check if this agent has database data
    const extendedAgent = agent as ExtendedAgent;
    if (extendedAgent.dbData && extendedAgent.dbData.id) {
      console.log('Agent has database data, using dbData.id:', extendedAgent.dbData.id);
      router.push(`/agents/${extendedAgent.dbData.id}`);
    } else {
      // For template agents without DB data, use the role as the ID (which maps to template)
      // We need to map the agent ID to the appropriate template role
      let templateRole = "";
      
      // Map agent IDs to template roles based on the name
      switch(agent.name) {
        case "Growth Lead/Manager":
          templateRole = "growth_lead";
          break;
        case "Data Analyst":
          templateRole = "data_analyst";
          break;
        case "Growth Marketer":
          templateRole = "growth_marketer";
          break;
        case "UX Designer":
          templateRole = "ux_designer";
          break;
        case "Sales/CRM Specialist":
          templateRole = "sales";
          break;
        case "Customer Support":
          templateRole = "support";
          break;
        case "Content Creator & Copywriter":
          templateRole = "content_creator";
          break;
        default:
          // If no mapping, use the agent id
          templateRole = agent.id;
      }
      
      console.log('Agent is a template, using mapped template role:', templateRole);
      router.push(`/agents/${templateRole}`);
    }
  };
  
  const handleChatWithAgent = async (agent: Agent) => {
    console.log('Chatting with agent:', agent.name);
    
    const extendedAgent = agent as ExtendedAgent;
    const agentId = extendedAgent.dbData?.id || agent.id;
    const agentName = agent.name;
    
    try {
      if (!currentSite?.id) {
        toast?.error?.("Cannot create conversation: No site selected");
        return;
      }
      
      if (!user?.id) {
        toast?.error?.("Cannot create conversation: Not logged in");
        return;
      }
      
      console.log("Creating conversation with parameters:");
      console.log("- siteId:", currentSite.id);
      console.log("- userId:", user.id);
      console.log("- agentId:", agentId);
      console.log("- title:", `Chat with ${agentName}`);
      
      // Create a real conversation in the database
      const { data: conversation, error } = await supabase
        .from("conversations")
        .insert({
          site_id: currentSite.id,
          user_id: user.id,
          agent_id: agentId,
          title: `Chat with ${agentName}`,
          status: 'active',
          is_archived: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_message_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        console.error("Error creating conversation:", error);
        toast?.error?.("Failed to create conversation. Please try again.");
        return;
      }
      
      if (conversation) {
        console.log("New conversation created successfully:", conversation);
        
        // Redirect to the chat page with the URL format: conversationId first, then agentId and agentName
        router.push(`/chat?conversationId=${conversation.id}&agentId=${agentId}&agentName=${encodeURIComponent(agentName)}`);
      } else {
        console.error("Failed to create conversation - no data returned");
        toast?.error?.("Failed to create conversation. Please try again.");
      }
    } catch (error) {
      console.error("Error in handleChatWithAgent:", error);
      toast?.error?.("An error occurred while creating the conversation.");
    }
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
  
  const handleExecuteActivity = async (agent: Agent, activity: AgentActivity) => {
    console.log('Executing activity:', activity.name, 'with agent:', agent.name);
    console.log('Activity ID:', activity.id, 'Activity name:', activity.name);
    console.log('Agent ID:', agent.id, 'Agent name:', agent.name);
    setSelectedAgent(agent);
    setSelectedActivity(activity);
    
    // Handle specific activities that require API calls
    console.log('🔍 Checking activity conditions...');
    console.log('Is cs4 + Answer Emails?', activity.id === "cs4" && activity.name === "Answer Emails");
    console.log('Is mk4 + Analyze Segments?', activity.id === "mk4" && activity.name === "Analyze Segments");
    console.log('Is mk1 + Create Marketing Campaign?', activity.id === "mk1" && activity.name === "Create Marketing Campaign");
    console.log('Is ct1 + Content Calendar Creation?', activity.id === "ct1" && activity.name === "Content Calendar Creation");
    console.log('Is gl6 + Daily Stand Up?', activity.id === "gl6" && activity.name === "Daily Stand Up");
    console.log('Is gl7 + Assign Leads?', activity.id === "gl7" && activity.name === "Assign Leads");
    console.log('Is sl3 + Lead Generation?', activity.id === "sl3" && activity.name === "Lead Generation");
    console.log('Is ux1 + Website Analysis?', activity.id === "ux1" && activity.name === "Website Analysis");
    console.log('Activity ID check - mk4?', activity.id === "mk4", 'mk1?', activity.id === "mk1", 'ct1?', activity.id === "ct1", 'gl6?', activity.id === "gl6", 'gl7?', activity.id === "gl7", 'sl3?', activity.id === "sl3", 'ux1?', activity.id === "ux1");
    
    if (activity.id === "cs4" && activity.name === "Answer Emails") {
      try {
        console.log('Calling syncEmails workflow for Customer Support agent');
        
        // Set loading state
        setActivityState(activity.id, 'loading', 'Synchronizing emails...');
        
        const extendedAgent = agent as ExtendedAgent;
        const agentId = extendedAgent.dbData?.id || agent.id;
        
        if (!currentSite?.id || !user?.id) {
          setActivityState(activity.id, 'error', 'Missing site or user information');
          toast?.error?.("Cannot execute activity: Missing site or user information");
          return;
        }
        
        // Use the same pattern as leadFollowUp - call external API server
        const { apiClient } = await import('@/app/services/api-client-service');
        
        const response = await apiClient.post('/api/workflow/syncEmails', {
          user_id: user.id,
          site_id: currentSite.id
        });
        
        if (response.success) {
          setActivityState(activity.id, 'success', 'Email synchronization completed successfully!');
          toast?.success?.(`Email synchronization completed successfully!`);
          console.log('SyncEmails workflow completed successfully:', response.data);
        } else {
          const errorMessage = typeof response.error === 'string' 
            ? response.error 
            : response.error?.message 
            ? String(response.error.message)
            : 'Failed to synchronize emails';
          setActivityState(activity.id, 'error', errorMessage);
          toast?.error?.(errorMessage);
          console.error('SyncEmails workflow failed:', response.error);
        }
        
      } catch (error) {
        console.error('Error executing Answer Emails activity:', error);
        const errorMessage = 'An error occurred while synchronizing emails';
        setActivityState(activity.id, 'error', errorMessage);
        toast?.error?.(errorMessage);
      }
    } else if (activity.id === "mk4") {
      console.log('✅ MATCHED: Analyze Segments activity detected!');
      try {
        console.log('Calling buildSegmentsWithAI workflow for Growth Marketer agent');
        
        // Set loading state
        setActivityState(activity.id, 'loading', 'Analyzing segments and building customer profiles...');
        
        const extendedAgent = agent as ExtendedAgent;
        const agentId = extendedAgent.dbData?.id || agent.id;
        
        if (!currentSite?.id || !user?.id) {
          setActivityState(activity.id, 'error', 'Missing site or user information');
          toast?.error?.("Cannot execute activity: Missing site or user information");
          return;
        }
        
        // Verify that the site has a URL
        if (!currentSite.url) {
          setActivityState(activity.id, 'error', 'Site URL is missing. Please add a URL to your site in the settings.');
          toast?.error?.("The selected site doesn't have a URL. Please add a URL to your site in the settings.");
          return;
        }
        
        // Import the buildSegmentsWithAI function
        const { buildSegmentsWithAI } = await import('@/app/services/ai-service');
        
        // Call the buildSegmentsWithAI workflow
        const result = await buildSegmentsWithAI({
          user_id: user.id,
          site_id: currentSite.id,
          url: currentSite.url,
          segmentCount: 3,
          mode: "create",
          analysisType: "general",
          provider: "openai",
          modelId: "gpt-4o",
          includeScreenshot: true
        });
        
        if (result.success) {
          setActivityState(activity.id, 'success', 'Segment analysis completed successfully!');
          toast?.success?.(`Segment analysis completed successfully!`);
          console.log('buildSegmentsWithAI workflow completed successfully:', result.data);
          
          // Redirect to the segments page to view the results
          if (result.data?.segmentId) {
            router.push(`/segments/${result.data.segmentId}`);
          } else {
            router.push('/segments');
          }
        } else {
          const errorMessage = typeof result.error === 'string' 
            ? result.error 
            : (result.error && typeof result.error === 'object' && 'message' in result.error)
            ? String((result.error as any).message)
            : 'Failed to analyze segments';
          setActivityState(activity.id, 'error', errorMessage);
          toast?.error?.(errorMessage);
          console.error('buildSegmentsWithAI workflow failed:', result);
        }
        
      } catch (error) {
        console.error('Error executing Analyze Segments activity:', error);
        const errorMessage = 'An error occurred while analyzing segments';
        setActivityState(activity.id, 'error', errorMessage);
        toast?.error?.(errorMessage);
      }
    } else if (activity.id === "mk1") {
      console.log('✅ MATCHED: Create Marketing Campaign activity detected!');
      try {
        console.log('Calling buildCampaignsWithAI workflow for Growth Marketer agent');
        
        // Set loading state
        setActivityState(activity.id, 'loading', 'Creating marketing campaigns with AI...');
        
        const extendedAgent = agent as ExtendedAgent;
        const agentId = extendedAgent.dbData?.id || agent.id;
        
        if (!currentSite?.id || !user?.id) {
          setActivityState(activity.id, 'error', 'Missing site or user information');
          toast?.error?.("Cannot execute activity: Missing site or user information");
          return;
        }
        
        // Verify that the site has a URL
        if (!currentSite.url) {
          setActivityState(activity.id, 'error', 'Site URL is missing. Please add a URL to your site in the settings.');
          toast?.error?.("The selected site doesn't have a URL. Please add a URL to your site in the settings.");
          return;
        }
        
        // Import the buildCampaignsWithAI function
        const { buildCampaignsWithAI } = await import('@/app/services/ai-service');
        
        // Call the buildCampaignsWithAI workflow
        const result = await buildCampaignsWithAI({
          user_id: user.id,
          site_id: currentSite.id,
          url: currentSite.url,
          campaignCount: 3,
          mode: "create",
          provider: "openai",
          modelId: "gpt-4o",
          includeScreenshot: true
        });
        
        if (result.success) {
          setActivityState(activity.id, 'success', 'Marketing campaigns created successfully!');
          toast?.success?.(`Marketing campaigns created successfully!`);
          console.log('buildCampaignsWithAI workflow completed successfully:', result.data);
          
          // Redirect to the campaigns page to view the results
          router.push('/campaigns');
        } else {
          const errorMessage = typeof result.error === 'string' 
            ? result.error 
            : (result.error && typeof result.error === 'object' && 'message' in result.error)
            ? String((result.error as any).message)
            : 'Failed to create marketing campaigns';
          setActivityState(activity.id, 'error', errorMessage);
          toast?.error?.(errorMessage);
          console.error('buildCampaignsWithAI workflow failed:', result);
        }
        
      } catch (error) {
        console.error('Error executing Create Marketing Campaign activity:', error);
        const errorMessage = 'An error occurred while creating marketing campaigns';
        setActivityState(activity.id, 'error', errorMessage);
        toast?.error?.(errorMessage);
      }
    } else if (activity.id === "ct1") {
      console.log('✅ MATCHED: Content Calendar Creation activity detected!');
      try {
        console.log('Calling buildContentWithAI workflow for Content Creator & Copywriter agent');
        
        // Set loading state
        setActivityState(activity.id, 'loading', 'Creating content calendar with AI...');
        
        const extendedAgent = agent as ExtendedAgent;
        const agentId = extendedAgent.dbData?.id || agent.id;
        
        if (!currentSite?.id || !user?.id) {
          setActivityState(activity.id, 'error', 'Missing site or user information');
          toast?.error?.("Cannot execute activity: Missing site or user information");
          return;
        }
        
        // Verify that the site has a URL
        if (!currentSite.url) {
          setActivityState(activity.id, 'error', 'Site URL is missing. Please add a URL to your site in the settings.');
          toast?.error?.("The selected site doesn't have a URL. Please add a URL to your site in the settings.");
          return;
        }
        
        // Import the buildContentWithAI function
        const { buildContentWithAI } = await import('@/app/services/ai-service');
        
        // Call the buildContentWithAI workflow
        const result = await buildContentWithAI({
          user_id: user.id,
          site_id: currentSite.id,
          url: currentSite.url,
          contentCount: 3,
          mode: "create",
          provider: "openai",
          modelId: "gpt-4o",
          includeScreenshot: true
        });
        
        if (result.success) {
          setActivityState(activity.id, 'success', 'Content calendar created successfully!');
          toast?.success?.(`Content calendar created successfully!`);
          console.log('buildContentWithAI workflow completed successfully:', result.data);
          
          // Redirect to the content page to view the results
          router.push('/content');
        } else {
          const errorMessage = typeof result.error === 'string' 
            ? result.error 
            : (result.error && typeof result.error === 'object' && 'message' in result.error)
            ? String((result.error as any).message)
            : 'Failed to create content calendar';
          setActivityState(activity.id, 'error', errorMessage);
          toast?.error?.(errorMessage);
          console.error('buildContentWithAI workflow failed:', result);
        }
        
      } catch (error) {
        console.error('Error executing Content Calendar Creation activity:', error);
        const errorMessage = 'An error occurred while creating content calendar';
        setActivityState(activity.id, 'error', errorMessage);
        toast?.error?.(errorMessage);
      }
    } else if (activity.id === "gl6") {
      console.log('✅ MATCHED: Daily Stand Up activity detected!');
      try {
        console.log('Calling dailyStandUp workflow for Growth Lead/Manager agent');
        
        // Set loading state
        setActivityState(activity.id, 'loading', 'Generating daily team progress report...');
        
        const extendedAgent = agent as ExtendedAgent;
        const agentId = extendedAgent.dbData?.id || agent.id;
        
        if (!currentSite?.id || !user?.id) {
          setActivityState(activity.id, 'error', 'Missing site or user information');
          toast?.error?.("Cannot execute activity: Missing site or user information");
          return;
        }
        
        // Use the same pattern as syncEmails - call external API server
        const { apiClient } = await import('@/app/services/api-client-service');
        
        const response = await apiClient.post('/api/workflow/dailyStandUp', {
          site_id: currentSite.id
        });
        
        if (response.success) {
          setActivityState(activity.id, 'success', 'Daily stand up report generated successfully!');
          toast?.success?.(`Daily stand up report generated successfully!`);
          console.log('DailyStandUp workflow completed successfully:', response.data);
        } else {
          const errorMessage = typeof response.error === 'string' 
            ? response.error 
            : response.error?.message 
            ? String(response.error.message)
            : 'Failed to generate daily stand up report';
          setActivityState(activity.id, 'error', errorMessage);
          toast?.error?.(errorMessage);
          console.error('DailyStandUp workflow failed:', response.error);
        }
        
      } catch (error) {
        console.error('Error executing Daily Stand Up activity:', error);
        const errorMessage = error instanceof Error 
          ? error.message 
          : typeof error === 'string' 
          ? error 
          : 'An error occurred while generating daily stand up report';
        setActivityState(activity.id, 'error', errorMessage);
        toast?.error?.(errorMessage);
      }
    } else if (activity.id === "sl3" && activity.name === "Lead Generation") {
      console.log('✅ MATCHED: Lead Generation activity detected!');
      try {
        console.log('Calling leadGeneration workflow for Sales/CRM Specialist agent');
        
        // Set loading state
        setActivityState(activity.id, 'loading', 'Generating leads and identifying potential customers...');
        
        const extendedAgent = agent as ExtendedAgent;
        const agentId = extendedAgent.dbData?.id || agent.id;
        
        if (!currentSite?.id || !user?.id) {
          setActivityState(activity.id, 'error', 'Missing site or user information');
          toast?.error?.("Cannot execute activity: Missing site or user information");
          return;
        }
        
        // Use the same pattern as syncEmails - call external API server
        const { apiClient } = await import('@/app/services/api-client-service');
        
        const response = await apiClient.post('/api/workflow/leadGeneration', {
          site_id: currentSite.id
        });
        
        if (response.success) {
          setActivityState(activity.id, 'success', 'Lead generation completed successfully!');
          toast?.success?.(`Lead generation completed successfully!`);
          console.log('LeadGeneration workflow completed successfully:', response.data);
        } else {
          const errorMessage = typeof response.error === 'string' 
            ? response.error 
            : response.error?.message 
            ? String(response.error.message)
            : 'Failed to generate leads';
          setActivityState(activity.id, 'error', errorMessage);
          toast?.error?.(errorMessage);
          console.error('LeadGeneration workflow failed:', response.error);
        }
        
      } catch (error) {
        console.error('Error executing Lead Generation activity:', error);
        const errorMessage = error instanceof Error 
          ? error.message 
          : typeof error === 'string' 
          ? error 
          : 'An error occurred while generating leads';
        setActivityState(activity.id, 'error', errorMessage);
        toast?.error?.(errorMessage);
      }
    } else if (activity.id === "ux1" && activity.name === "Website Analysis") {
      console.log('✅ MATCHED: Website Analysis activity detected!');
      try {
        console.log('Calling analyzeSiteWorkflow for UX Designer agent');
        
        // Set loading state
        setActivityState(activity.id, 'loading', 'Analyzing website usability and user experience...');
        
        const extendedAgent = agent as ExtendedAgent;
        const agentId = extendedAgent.dbData?.id || agent.id;
        
        if (!currentSite?.id || !user?.id) {
          setActivityState(activity.id, 'error', 'Missing site or user information');
          toast?.error?.("Cannot execute activity: Missing site or user information");
          return;
        }
        
        // Verify that the site has a URL
        if (!currentSite.url) {
          setActivityState(activity.id, 'error', 'Site URL is missing. Please add a URL to your site in the settings.');
          toast?.error?.("The selected site doesn't have a URL. Please add a URL to your site in the settings.");
          return;
        }
        
        // Use the same pattern as other workflows - call external API server
        const { apiClient } = await import('@/app/services/api-client-service');
        
        const response = await apiClient.post('/api/workflow/analyzeSite', {
          user_id: user.id,
          site_id: currentSite.id,
          url: currentSite.url,
          provider: "openai",
          modelId: "gpt-4o",
          includeScreenshot: true
        });
        
        if (response.success) {
          setActivityState(activity.id, 'success', 'Website analysis completed successfully!');
          toast?.success?.(`Website analysis completed successfully!`);
          console.log('AnalyzeSite workflow completed successfully:', response.data);
        } else {
          const errorMessage = typeof response.error === 'string' 
            ? response.error 
            : response.error?.message 
            ? String(response.error.message)
            : 'Failed to analyze website';
          setActivityState(activity.id, 'error', errorMessage);
          toast?.error?.(errorMessage);
          console.error('AnalyzeSite workflow failed:', response.error);
        }
        
      } catch (error) {
        console.error('Error executing Website Analysis activity:', error);
        const errorMessage = error instanceof Error 
          ? error.message 
          : typeof error === 'string' 
          ? error 
          : 'An error occurred while analyzing website';
        setActivityState(activity.id, 'error', errorMessage);
        toast?.error?.(errorMessage);
      }
    } else if (activity.id === "gl7" && activity.name === "Assign Leads") {
      console.log('✅ MATCHED: Assign Leads activity detected!');
      try {
        console.log('Calling assignLeads workflow for Growth Lead/Manager agent');
        
        // Set loading state
        setActivityState(activity.id, 'loading', 'Assigning leads to team members...');
        
        const extendedAgent = agent as ExtendedAgent;
        const agentId = extendedAgent.dbData?.id || agent.id;
        
        if (!currentSite?.id || !user?.id) {
          setActivityState(activity.id, 'error', 'Missing site or user information');
          toast?.error?.("Cannot execute activity: Missing site or user information");
          return;
        }
        
        // Use the same pattern as other workflows - call external API server
        const { apiClient } = await import('@/app/services/api-client-service');
        
        const response = await apiClient.post('/api/workflow/assignLeads', {
          site_id: currentSite.id
        });
        
        if (response.success) {
          setActivityState(activity.id, 'success', 'Leads assigned successfully!');
          toast?.success?.(`Leads assigned successfully!`);
          console.log('AssignLeads workflow completed successfully:', response.data);
        } else {
          const errorMessage = typeof response.error === 'string' 
            ? response.error 
            : response.error?.message 
            ? String(response.error.message)
            : 'Failed to assign leads';
          setActivityState(activity.id, 'error', errorMessage);
          toast?.error?.(errorMessage);
          console.error('AssignLeads workflow failed:', response.error);
        }
        
      } catch (error) {
        console.error('Error executing Assign Leads activity:', error);
        const errorMessage = error instanceof Error 
          ? error.message 
          : typeof error === 'string' 
          ? error 
          : 'An error occurred while assigning leads';
        setActivityState(activity.id, 'error', errorMessage);
        toast?.error?.(errorMessage);
      }
    } else if (activity.id === "sl1" && activity.name === "Lead Follow-up Management") {
      console.log('✅ MATCHED: Lead Follow-up Management activity detected!');
      try {
        console.log('Calling leadFollowUpManagement workflow for Sales/CRM Specialist agent');
        
        // Set loading state
        setActivityState(activity.id, 'loading', 'Managing lead follow-up sequences...');
        
        const extendedAgent = agent as ExtendedAgent;
        const agentId = extendedAgent.dbData?.id || agent.id;
        
        if (!currentSite?.id || !user?.id) {
          setActivityState(activity.id, 'error', 'Missing site or user information');
          toast?.error?.("Cannot execute activity: Missing site or user information");
          return;
        }
        
        // Use the same pattern as other workflows - call external API server
        const { apiClient } = await import('@/app/services/api-client-service');
        
        const response = await apiClient.post('/api/workflow/leadFollowUpManagement', {
          site_id: currentSite.id
        });
        
        if (response.success) {
          setActivityState(activity.id, 'success', 'Lead follow-up management completed successfully!');
          toast?.success?.(`Lead follow-up management completed successfully!`);
          console.log('LeadFollowUpManagement workflow completed successfully:', response.data);
        } else {
          const errorMessage = typeof response.error === 'string' 
            ? response.error 
            : response.error?.message 
            ? String(response.error.message)
            : 'Failed to manage lead follow-ups';
          setActivityState(activity.id, 'error', errorMessage);
          toast?.error?.(errorMessage);
          console.error('LeadFollowUpManagement workflow failed:', response.error);
        }
        
      } catch (error) {
        console.error('Error executing Lead Follow-up Management activity:', error);
        const errorMessage = error instanceof Error 
          ? error.message 
          : typeof error === 'string' 
          ? error 
          : 'An error occurred while managing lead follow-ups';
        setActivityState(activity.id, 'error', errorMessage);
        toast?.error?.(errorMessage);
      }
    } else {
      // For other activities, just show they're not available yet
      console.log(`Activity "${activity.name}" is not available yet`);
    }
  };
  
  const isAgentExpanded = (agentId: string) => expandedAgentIds.includes(agentId);
  
  // Function to render grid view
  const renderGridView = (type?: "marketing" | "sales" | "support" | "product") => {
    if (isLoading) {
      return (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <GridAgentRowSkeleton key={index} />
          ))}
        </div>
      );
    }
    
    console.log("Renderizando grid view con agentes:", agents.length);
    
    const filteredAgents = agents.filter(agent => 
      (!type || agent.type === type) && 
      (!searchQuery || 
       agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
       agent.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    
    console.log(`Agentes filtrados para grid (${filteredAgents.length}):`, 
      filteredAgents.map(a => `${a.id} - ${a.name} - isDisabled: ${a.isDisabled}`));
    
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
            forceShow={true} // Forzar mostrar incluso si isDisabled es true
            activityStates={activityStates}
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
                      <TabsTrigger value="product">Product</TabsTrigger>
                    </TabsList>
                    
                    <div className="relative w-64">
                      <Input 
                        data-command-k-input
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
                              {isLoading ? (
                                <div className="w-[458px] px-4">
                                  <SimpleAgentCardSkeleton className="border-primary shadow-md" />
                                </div>
                              ) : (
                                leadAgent && 
                                (!searchQuery || 
                                 leadAgent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                 leadAgent.description.toLowerCase().includes(searchQuery.toLowerCase())) && 
                                <div className="w-[458px] px-4">
                                  <SimpleAgentCard 
                                    agent={leadAgent} 
                                    onManage={handleManageAgent}
                                    onChat={handleChatWithAgent}
                                    onToggleActivities={handleToggleActivities}
                                    showActivities={isAgentExpanded(leadAgent.id)}
                                    onExecuteActivity={handleExecuteActivity}
                                    setSelectedAgent={setSelectedAgent}
                                    className="border-primary shadow-md"
                                    activityStates={activityStates}
                                  />
                                </div>
                              )}
                              
                              {/* Connecting Line - only show if both leadAgent and dataAnalystAgent are visible */}
                              {(isLoading || (leadAgent && dataAnalystAgent &&
                                (!searchQuery || 
                                 leadAgent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                 leadAgent.description.toLowerCase().includes(searchQuery.toLowerCase())) &&
                                (!searchQuery || 
                                 dataAnalystAgent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                 dataAnalystAgent.description.toLowerCase().includes(searchQuery.toLowerCase())))) && (
                                <div className="flex justify-center relative">
                                  <div className="h-20 w-0.5 bg-border"></div>
                                  <AnimatedConnectionLine direction="down" className="h-20 opacity-100" dotColor="var(--primary)" />
                                </div>
                              )}
                              
                              {/* Data Analyst - Middle Level */}
                              {isLoading ? (
                                <div className="flex justify-center mb-10">
                                  <div className="w-[458px] px-4">
                                    <SimpleAgentCardSkeleton className="border-primary/30 shadow-md" />
                                  </div>
                                </div>
                              ) : (
                                dataAnalystAgent && 
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
                                        activityStates={activityStates}
                                      />
                                    </div>
                                  </div>
                                </>
                               )
                              )}
                                  
                                  {/* Connecting Line - only show if filtered execution agents exist */}
                              {(isLoading || executionAgents.some(agent => 
                                    !searchQuery || 
                                    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    agent.description.toLowerCase().includes(searchQuery.toLowerCase())
                              )) && (
                                    <div className="flex justify-center relative">
                                      <div className="h-20 w-0.5 bg-border"></div>
                                      <AnimatedConnectionLine direction="down" className="h-20 opacity-100" dotColor="var(--primary)" />
                                    </div>
                              )}
                              
                              {/* Execution Teams - Bottom Level with connections */}
                              <div className="relative mt-2">
                                {/* Horizontal connecting line - only if there are filtered execution agents */}
                                {(isLoading || executionAgents.some(agent => 
                                  !searchQuery || 
                                  agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                  agent.description.toLowerCase().includes(searchQuery.toLowerCase())
                                )) && (
                                  <div className="absolute top-0 left-1/2 w-[90%] h-0.5 bg-border transform -translate-x-1/2 relative">
                                    <AnimatedConnectionLine direction="right" className="w-[50%] left-0 opacity-100" speed="normal" dotColor="var(--primary)" />
                                    <AnimatedConnectionLine direction="left" className="w-[50%] right-0 opacity-100" speed="normal" dotColor="var(--primary)" />
                                  </div>
                                )}
                                
                                {/* Get the sales specialist and customer support */}
                                {isLoading ? (
                                  <>
                                    {/* Vertical connecting lines */}
                                    <div className="grid gap-12 px-8 grid-cols-4">
                                      {Array.from({ length: 4 }).map((_, index) => (
                                        <div key={index} className="flex justify-center relative">
                                          <div className="h-20 w-0.5 bg-border"></div>
                                          <AnimatedConnectionLine direction="down" className="h-20 opacity-100" dotColor="var(--primary)" />
                                        </div>
                                      ))}
                                    </div>
                                    
                                    {/* Team member skeleton cards */}
                                    <div className="pb-12">
                                      <div className="grid grid-flow-col auto-cols-min gap-12 px-8 mt-8 min-w-full">
                                        {Array.from({ length: 4 }).map((_, index) => (
                                          <div key={index} className="w-[458px] px-4">
                                            <SimpleAgentCardSkeleton />
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  (() => {
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
                                                activityStates={activityStates}
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
                                                  
                                                  {agents.find(a => a.id === "7" && !a.isDisabled) && (
                                                    <div className="w-[400px]">
                                                      <SimpleAgentCard
                                                        agent={agents.find(a => a.id === "7")!}
                                                        onManage={handleManageAgent}
                                                        onChat={handleChatWithAgent}
                                                        onToggleActivities={handleToggleActivities}
                                                        showActivities={isAgentExpanded("7")}
                                                        onExecuteActivity={handleExecuteActivity}
                                                        setSelectedAgent={setSelectedAgent}
                                                        activityStates={activityStates}
                                                      />
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </>
                                  );
                                  })()
                                )}
                                
                                {/* Feedback Loop Visualization - only show if there are visible agents */}
                                {(isLoading || executionAgents.some(agent => 
                                  !searchQuery || 
                                  agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                  agent.description.toLowerCase().includes(searchQuery.toLowerCase())
                                )) && (
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
                              <h2 className="text-2xl font-bold mb-10">Marketing Team Structure</h2>
                              
                              {/* Filter only marketing agents */}
                              {isLoading ? (
                                <div className="space-y-20">
                                  {Array.from({ length: 2 }).map((_, index) => (
                                    <SimpleAgentCardSkeleton key={index} className="w-[458px]" />
                                  ))}
                                </div>
                              ) : (
                                <div>
                                  {agents
                                    .filter(agent => agent.type === "marketing" && !agent.isDisabled)
                                    .map((agent, index, filteredAgents) => (
                                      <div key={agent.id}>
                                        <div className="w-[458px] px-4">
                                          <SimpleAgentCard 
                                            agent={agent} 
                                            onManage={handleManageAgent}
                                            onChat={handleChatWithAgent}
                                            onToggleActivities={handleToggleActivities}
                                            showActivities={isAgentExpanded(agent.id)}
                                            onExecuteActivity={handleExecuteActivity}
                                            setSelectedAgent={setSelectedAgent}
                                            className={index === 0 ? "border-primary/50 shadow-md" : ""}
                                            activityStates={activityStates}
                                          />
                                        </div>
                                        
                                        {/* Add connection line if not the last agent */}
                                        {index < filteredAgents.length - 1 && (
                                          <div className="flex justify-center relative my-8">
                                            <div className="h-12 w-0.5 bg-border"></div>
                                            <AnimatedConnectionLine direction="down" className="h-12 opacity-100" dotColor="var(--primary)" />
                                          </div>
                                        )}
                                      </div>
                                    ))
                                  }
                                </div>
                              )}
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
                              <h2 className="text-2xl font-bold mb-10">Sales Team Structure</h2>
                              
                              {/* Filter only sales agents */}
                              {isLoading ? (
                                <div className="space-y-20">
                                  {Array.from({ length: 2 }).map((_, index) => (
                                    <SimpleAgentCardSkeleton key={index} className="w-[458px]" />
                                  ))}
                                </div>
                              ) : (
                                <div>
                                  {agents
                                    .filter(agent => agent.type === "sales" && !agent.isDisabled && agent.id !== "7") // Exclude Customer Support from main list
                                    .map((agent, index, filteredAgents) => (
                                      <div key={agent.id}>
                                        <div className="w-[458px] px-4">
                                          <SimpleAgentCard 
                                            agent={agent} 
                                            onManage={handleManageAgent}
                                            onChat={handleChatWithAgent}
                                            onToggleActivities={handleToggleActivities}
                                            showActivities={isAgentExpanded(agent.id)}
                                            onExecuteActivity={handleExecuteActivity}
                                            setSelectedAgent={setSelectedAgent}
                                            className={index === 0 ? "border-primary/50 shadow-md" : ""}
                                            activityStates={activityStates}
                                          />
                                        </div>
                                        
                                        {/* Add connection line if not the last agent */}
                                        {index < filteredAgents.length - 1 && (
                                          <div className="flex justify-center relative my-8">
                                            <div className="h-12 w-0.5 bg-border"></div>
                                            <AnimatedConnectionLine direction="down" className="h-12 opacity-100" dotColor="var(--primary)" />
                                          </div>
                                        )}

                                        {/* Special case for Customer Support if this is Sales/CRM Specialist */}
                                        {agent.id === "5" && (
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
                                            
                                            {agents.find(a => a.id === "7" && !a.isDisabled) && (
                                              <div className="w-[400px]">
                                                <SimpleAgentCard
                                                  agent={agents.find(a => a.id === "7")!}
                                                  onManage={handleManageAgent}
                                                  onChat={handleChatWithAgent}
                                                  onToggleActivities={handleToggleActivities}
                                                  showActivities={isAgentExpanded("7")}
                                                  onExecuteActivity={handleExecuteActivity}
                                                  setSelectedAgent={setSelectedAgent}
                                                />
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    ))
                                  }
                                </div>
                              )}
                              
                              {/* Feedback Loop Visualization */}
                              {!isLoading && agents.filter(agent => agent.type === "sales" && !agent.isDisabled).length > 1 && (
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
              
              <TabsContent value="product" className="m-0">
                <div className="px-8">
                  {viewMode === "hierarchy" ? (
                    <div className="flex flex-col items-center">
                      <div className="w-full">
                        <ZoomableCanvas>
                          <div className="flex flex-col items-center">
                            <div className="pt-2 flex flex-col items-center">
                              <h2 className="text-2xl font-bold mb-10">Product Team Structure</h2>
                              
                              {/* Filter only product agents */}
                              {isLoading ? (
                                <div className="space-y-20">
                                  {Array.from({ length: 2 }).map((_, index) => (
                                    <SimpleAgentCardSkeleton key={index} className="w-[458px]" />
                                  ))}
                                </div>
                              ) : (
                                <div>
                                  {agents
                                    .filter(agent => agent.type === "product" && !agent.isDisabled)
                                    .map((agent, index, filteredAgents) => (
                                      <div key={agent.id}>
                                        <div className="w-[458px] px-4">
                                          <SimpleAgentCard 
                                            agent={agent} 
                                            onManage={handleManageAgent}
                                            onChat={handleChatWithAgent}
                                            onToggleActivities={handleToggleActivities}
                                            showActivities={isAgentExpanded(agent.id)}
                                            onExecuteActivity={handleExecuteActivity}
                                            setSelectedAgent={setSelectedAgent}
                                            className={index === 0 ? "border-primary/50 shadow-md" : ""}
                                            activityStates={activityStates}
                                          />
                                        </div>
                                        
                                        {/* Add connection line if not the last agent */}
                                        {index < filteredAgents.length - 1 && (
                                          <div className="flex justify-center relative my-8">
                                            <div className="h-12 w-0.5 bg-border"></div>
                                            <AnimatedConnectionLine direction="down" className="h-12 opacity-100" dotColor="var(--primary)" />
                                          </div>
                                        )}
                                      </div>
                                    ))
                                  }
                                </div>
                              )}
                              
                              {/* Feedback Loop Visualization */}
                              {!isLoading && agents.filter(agent => agent.type === "product" && !agent.isDisabled).length > 1 && (
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
                        </ZoomableCanvas>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {renderGridView("product")}
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

// Export the wrapped component
export default AgentsPageWrapper;