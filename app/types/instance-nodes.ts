export type InstanceNodeStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface InstanceNode {
  id: string;
  instance_id: string;
  parent_node_id: string | null;
  original_node_id: string | null;
  parent_instance_log_id: string | null;
  type: string;
  status: InstanceNodeStatus;
  result: Record<string, any>;
  settings: Record<string, any>;
  prompt: Record<string, any>;
  site_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface CreateInstanceNodeParams {
  instance_id: string;
  parent_node_id?: string | null;
  original_node_id?: string | null;
  parent_instance_log_id?: string | null;
  type: string;
  status?: InstanceNodeStatus;
  result?: Record<string, any>;
  settings?: Record<string, any>;
  prompt?: Record<string, any>;
  site_id?: string;
}

export interface UpdateInstanceNodeParams {
  status?: InstanceNodeStatus;
  result?: Record<string, any>;
  settings?: Record<string, any>;
  prompt?: Record<string, any>;
}
