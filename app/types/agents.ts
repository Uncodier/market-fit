export interface Agent {
  id: string
  name: string
  description: string
  type: "sales" | "support" | "marketing" | "product"
  status: "active" | "inactive" | "learning" | "error"
  conversations: number
  successRate: number
  lastActive: string
  icon: string
  role?: string
  tools?: Record<string, any>
  activities?: Record<string, any> | AgentActivity[]
  integrations?: Record<string, any>
  supervisor?: string  // UUID of another agent
  files?: string[]     // Array of asset IDs
}

export interface AgentActivity {
  id: string
  name: string
  description: string
  status: "available" | "in_progress" | "deprecated"
  estimatedTime?: string
  successRate?: number
  executions?: number
}

export type AgentType = Agent["type"]
export type AgentStatus = Agent["status"]
export type AgentActivityStatus = AgentActivity["status"] 