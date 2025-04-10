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
  activities?: AgentActivity[]
}

export interface AgentActivity {
  id: string
  name: string
  description: string
  estimatedTime: string // Duration in minutes or a range like "5-10 min"
  successRate: number
  executions: number
  status: "available" | "in_progress" | "deprecated"
}

export type AgentType = Agent["type"]
export type AgentStatus = Agent["status"]
export type AgentActivityStatus = AgentActivity["status"] 