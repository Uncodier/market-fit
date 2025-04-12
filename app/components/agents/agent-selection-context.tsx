import { createContext, useContext } from "react"
import { Agent, AgentActivity } from "@/app/types/agents"

interface AgentSelectionContextType {
  selectedAgent: Agent | null;
  setSelectedAgent: (agent: Agent | null) => void;
  selectedActivity: AgentActivity | null;
  setSelectedActivity: (activity: AgentActivity | null) => void;
}

export const AgentSelectionContext = createContext<AgentSelectionContextType | undefined>(undefined);

export const useAgentSelection = () => {
  const context = useContext(AgentSelectionContext);
  if (!context) {
    throw new Error("useAgentSelection must be used within an AgentSelectionProvider");
  }
  return context;
}; 