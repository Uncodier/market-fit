export interface SimpleMessagesViewProps {
  className?: string
  activeRobotInstance?: any
  onMessageSent?: (hasMessageBeenSent: boolean) => void
  onNewInstanceCreated?: (instanceId: string) => void
}

// Media Parameter Types
export interface ImageParameters {
  format: 'PNG' | 'JPG' | 'WebP'
  aspectRatio: '1:1' | '4:3' | '3:4' | '16:9' | '9:16' | '3:2' | '2:3'
  quality: number
}

export interface VideoParameters {
  aspectRatio: '16:9' | '9:16' | '1:1' | '3:4' | '4:3'
  resolution: '720p' | '1080p'
  duration: number // in seconds
}

export interface AudioParameters {
  format: 'MP3' | 'WAV' | 'AAC'
  sampleRate: '44.1kHz' | '48kHz'
  channels: 'mono' | 'stereo'
}

// Define SelectedContextIds interface locally to avoid import issues
export interface SelectedContextIds {
  leads: string[]
  contents: string[]
  requirements: string[]
  tasks: string[]
  campaigns: string[]
}

export interface InstanceLog {
  id: string
  log_type: 'system' | 'user_action' | 'agent_action' | 'tool_call' | 'tool_result' | 'error' | 'performance'
  level: 'debug' | 'info' | 'warn' | 'error' | 'critical'
  message: string
  details?: any
  created_at: string
  user_id?: string | null
  tool_name?: string
  tool_result?: any
  screenshot_base64?: string
  parent_log_id?: string | null
  // Support for alternative field names from different data sources
  toolName?: string
  tool_results?: any
  logType?: string
}

// Structured Output Types
export type EventType = 
  | 'step_completed'
  | 'step_failed' 
  | 'step_canceled'
  | 'plan_failed'
  | 'plan_new_required'
  | 'session_acquired'
  | 'session_needed'
  | 'session_saved'
  | 'user_attention_required';

export interface StructuredOutputResponse {
  event: EventType;
  step: number;
  assistant_message: string;
}

export interface StructuredOutputStyle {
  icon: string;
  color: string;
  backgroundColor: string;
  borderColor: string;
  label: string;
  priority: 'success' | 'error' | 'warning' | 'neutral' | 'info';
}

export interface InstancePlan {
  id: string
  title: string
  description?: string
  plan_type: 'objective' | 'task' | 'verification' | 'milestone'
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'blocked' | 'paused'
  instructions?: string
  expected_output?: string
  progress_percentage: number
  steps_completed: number
  steps_total: number
  priority: number
  created_at: string
  updated_at?: string
  completed_at?: string
  steps?: any // Contains the steps for the plan
}

export interface PlanStep {
  id: string
  title: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed'
  order: number
  planId?: string // Track which plan this step belongs to
}

// Structured Output Styles Configuration (light defaults)
export const StructuredOutputStylesLight: Record<EventType, StructuredOutputStyle> = {
  // ✅ Success states
  step_completed: {
    icon: '✅',
    color: '#2e7d32',
    backgroundColor: '#e8f5e8',
    borderColor: '#4caf50',
    label: 'Step Completed',
    priority: 'success'
  },
  session_saved: {
    icon: '💾',
    color: '#1976d2',
    backgroundColor: '#e3f2fd',
    borderColor: '#2196f3',
    label: 'Session Saved',
    priority: 'success'
  },
  session_acquired: {
    icon: '🔐',
    color: '#7b1fa2',
    backgroundColor: '#f3e5f5',
    borderColor: '#9c27b0',
    label: 'Session Acquired',
    priority: 'success'
  },
  // ❌ Error states
  step_failed: {
    icon: '❌',
    color: '#d32f2f',
    backgroundColor: '#ffebee',
    borderColor: '#f44336',
    label: 'Step Failed',
    priority: 'error'
  },
  plan_failed: {
    icon: '🔴',
    color: '#d32f2f',
    backgroundColor: '#ffebee',
    borderColor: '#f44336',
    label: 'Plan Failed',
    priority: 'error'
  },
  // ⚠️ Attention states
  user_attention_required: {
    icon: '⚠️',
    color: '#f57c00',
    backgroundColor: '#fff3e0',
    borderColor: '#ff9800',
    label: 'Attention Required',
    priority: 'warning'
  },
  session_needed: {
    icon: '🔐',
    color: '#f57c00',
    backgroundColor: '#fff3e0',
    borderColor: '#ff9800',
    label: 'Session Needed',
    priority: 'warning'
  },
  // 🔄 Change states
  step_canceled: {
    icon: '⏸️',
    color: '#616161',
    backgroundColor: '#f5f5f5',
    borderColor: '#9e9e9e',
    label: 'Step Canceled',
    priority: 'neutral'
  },
  plan_new_required: {
    icon: '🔄',
    color: '#1976d2',
    backgroundColor: '#e3f2fd',
    borderColor: '#2196f3',
    label: 'New Plan Required',
    priority: 'info'
  }
};
