export interface Experiment {
  id: string
  name: string
  description: string
  preview_url: string
  status: "draft" | "active" | "completed"
  user_id: string
  created_at: string
  updated_at: string
}

export interface ExperimentSegment {
  experiment_id: string
  segment_id: string
  created_at: string
}

export interface ExperimentWithSegments extends Experiment {
  segments: Array<{
    id: string
    name: string
    description: string
  }>
} 