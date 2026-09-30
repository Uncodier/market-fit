import type { Task, TaskComment, Category } from "@/app/types/tasks"
import type { Lead } from "@/app/leads/types"
import type { Json } from "./supabase"

type TaskRow = Omit<Task, "leads" | "assignee_details" | "comments" | "lead_id" | "assignee" | "type" | "stage"> & {
  lead_id: string | null
  assignee: string | null
  type: string | null
  stage: string | null
  completed_date?: string | null
}

export type TasksTable = {
  Row: TaskRow
  Insert: Partial<TaskRow> & Pick<TaskRow, "title" | "site_id">
  Update: Partial<TaskRow>
  Relationships: [{
    foreignKeyName: "tasks_lead_id_fkey"
    columns: ["lead_id"]
    isOneToOne: false
    referencedRelation: "leads"
    referencedColumns: ["id"]
  }]
}

type TaskCommentRow = Omit<TaskComment, "profiles" | "cta"> & {
  cta: TaskComment["cta"] | null
}

export type TaskCommentsTable = {
  Row: TaskCommentRow
  Insert: Pick<TaskCommentRow, "task_id" | "user_id" | "content"> & Partial<TaskCommentRow>
  Update: Partial<TaskCommentRow>
  Relationships: [{
    foreignKeyName: "task_comments_task_id_fkey"
    columns: ["task_id"]
    isOneToOne: false
    referencedRelation: "tasks"
    referencedColumns: ["id"]
  }]
}

export type LeadsTable = {
  Row: { [Key in keyof Lead]: Lead[Key] } & { site_id: string; user_id: string }
  Insert: Partial<Lead> & { site_id: string; name: string; user_id?: string }
  Update: Partial<Lead>
  Relationships: []
}

export type CategoriesTable = {
  Row: { [Key in keyof Category]: Category[Key] }
  Insert: Partial<Category> & Pick<Category, "name" | "site_id" | "user_id">
  Update: Partial<Category>
  Relationships: []
}