export interface Command {
  id: string;
  task: string;
  description?: string;
  status: "completed" | "running" | "pending" | "failed" | "cancelled";
  user_id?: string;
  created_at?: string;
  updated_at?: string;
  completion_date?: string;
  duration?: number;
  model?: string;
  agent_id?: string;
  agent_name?: string; // Agent name from JOIN
  agent_role?: string; // Agent role from JOIN
  output_tokens?: number;
  input_tokens?: number;
  results?: any[];
  targets?: any[];
  tools?: any[];
  functions?: any[];
  context?: string;
  agent_background?: string;
  supervisor?: any[];
  performance?: number; // Bitmask: bit 0 = like (1), bit 1 = dislike (2), bit 2 = flag (4)
}

export interface CommandsResponse {
  commands?: Command[];
  error?: string;
}

export interface CommandListRow {
  id: string
  task: string
  status: Command["status"]
  description: string | null
  context: string | null
  created_at: string
  duration: number | null
  agent_id: string | null
  agents: { name: string | null; role: string | null } | null
}
