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
  output_tokens?: number;
  input_tokens?: number;
  results?: any[];
  targets?: any[];
  tools?: any[];
  context?: string;
  agent_background?: string;
  supervisor?: any[];
}

export interface CommandsResponse {
  commands?: Command[];
  error?: string;
} 