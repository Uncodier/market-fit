"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Task, TaskCategory } from "@/lib/validations/task"
import { SidebarToggle } from "./components/sidebar-toggle"
import { CategoriesSidebar } from "./components/categories-sidebar"
import { TaskHeader } from "./components/task-header"
import { TaskContent } from "./components/task-content"
import { TaskDialog } from "./task-dialog"

// Mock data - should be moved to a separate file or fetched from API
const mockCategories: TaskCategory[] = [
  {
    id: "1",
    name: "Product Development",
    description: "Tasks related to product development",
    color: "#FF6B6B",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "2",
    name: "Marketing",
    description: "Marketing related tasks",
    color: "#4ECDC4",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "3",
    name: "Customer Support",
    description: "Customer support tasks",
    color: "#45B7D1",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

const mockTasks: Task[] = [
  {
    id: "1",
    title: "Research market trends",
    description: "Analyze current market trends and competitors",
    status: "TODO",
    priority: "HIGH",
    categoryId: "1",
    dueDate: new Date("2024-04-30"),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "2",
    title: "Create user survey",
    description: "Design and implement user feedback survey",
    status: "IN_PROGRESS",
    priority: "MEDIUM",
    categoryId: "2",
    dueDate: new Date("2024-04-25"),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "3",
    title: "Update documentation",
    description: "Update product documentation with new features",
    status: "DONE",
    priority: "LOW",
    categoryId: "3",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

interface ControlCenterProps {
  className?: string
}

export function ControlCenter({ className }: ControlCenterProps) {
  // State
  const [selectedCategory, setSelectedCategory] = useState<TaskCategory | null>(null)
  const [tasks, setTasks] = useState<Task[]>(mockTasks)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | undefined>(undefined)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  // Handlers
  const handleUpdateTaskStatus = async (taskId: string, newStatus: string) => {
    setTasks(tasks.map(task => 
      task.id === taskId ? { ...task, status: newStatus as Task["status"] } : task
    ))
  }

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task)
    setDialogOpen(true)
  }

  const handleCreateTask = () => {
    setSelectedTask(undefined)
    setDialogOpen(true)
  }

  const handleSaveTask = async (taskData: Partial<Task>) => {
    if (selectedTask) {
      // Update existing task
      setTasks(tasks.map(task =>
        task.id === selectedTask.id
          ? { ...task, ...taskData, updatedAt: new Date() }
          : task
      ))
    } else {
      // Create new task
      const newTask: Task = {
        ...taskData,
        id: Math.random().toString(36).substr(2, 9),
        status: "TODO",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Task
      setTasks([...tasks, newTask])
    }
  }

  // Filtered tasks based on selected category
  const filteredTasks = selectedCategory
    ? tasks.filter(task => task.categoryId === selectedCategory.id)
    : tasks

  return (
    <div className={cn("flex h-full", className)}>
      <SidebarToggle
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      <CategoriesSidebar
        categories={mockCategories}
        selectedCategory={selectedCategory}
        isCollapsed={isSidebarCollapsed}
        onSelectCategory={setSelectedCategory}
      />

      <TaskHeader
        selectedCategory={selectedCategory}
        isCollapsed={isSidebarCollapsed}
        onCreateTask={handleCreateTask}
      />

      <TaskContent
        tasks={filteredTasks}
        isCollapsed={isSidebarCollapsed}
        onUpdateTaskStatus={handleUpdateTaskStatus}
        onTaskClick={handleTaskClick}
      />

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={selectedTask}
        categories={mockCategories}
        onSave={handleSaveTask}
      />
    </div>
  )
} 