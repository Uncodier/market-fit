export interface Agent {
  id: string
  name: string
  description: string
  type: "sales" | "support" | "marketing"
  status: "active" | "inactive" | "learning" | "error"
  conversations: number
  successRate: number
  lastActive: string
  icon: string
}

export type AgentType = Agent["type"]
export type AgentStatus = Agent["status"] 