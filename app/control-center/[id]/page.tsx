"use client"

import { useState, useEffect, useRef, MutableRefObject } from "react"
import { useRouter } from "next/navigation"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Button } from "@/app/components/ui/button"
import { SaveIcon } from "@/app/components/ui/icons"
import { createClient } from "@/utils/supabase/client"
import { useSite } from "@/app/context/SiteContext"
import { Task } from "@/app/types"
import dynamic from "next/dynamic"
import { TaskStatusBar } from "../components/TaskStatusBar"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Suspense } from "react"

// Lazy load the tabs
const TimelineTab = dynamic(
  () => import('./components/TimelineTab'),
  { 
    loading: () => <UpdatesSkeleton />,
    ssr: false 
  }
)

const DetailsTab = dynamic(
  () => import('./components/DetailsTab'),
  { 
    loading: () => <DetailsSkeleton />,
    ssr: false 
  }
)

// Loading states
const UpdatesSkeleton = () => (
  <div className="space-y-6">
    {/* Comment input skeleton */}
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="h-[100px] w-full bg-muted animate-pulse rounded-md" />
          <div className="flex items-center justify-between">
            <div className="h-9 w-32 bg-muted animate-pulse rounded-md" />
            <div className="flex items-center gap-4">
              <div className="h-9 w-32 bg-muted animate-pulse rounded-md" />
              <div className="h-9 w-32 bg-muted animate-pulse rounded-md" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    {/* Comments list skeleton */}
    <div className="space-y-4">
      {/* Comment with image */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                <div className="space-y-2">
                  <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-32 bg-muted animate-pulse rounded" />
                </div>
              </div>
              <div className="h-8 w-20 bg-muted animate-pulse rounded" />
            </div>
            <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
            <div className="h-48 w-full bg-muted animate-pulse rounded-md" />
          </div>
        </CardContent>
      </Card>

      {/* Comment with text only */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                <div className="space-y-2">
                  <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-8 w-20 bg-muted animate-pulse rounded" />
                <div className="h-8 w-8 bg-muted animate-pulse rounded" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-4 w-full bg-muted animate-pulse rounded" />
              <div className="h-4 w-2/3 bg-muted animate-pulse rounded" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Task description skeleton */}
      <Card className="mt-8 bg-muted/50">
        <CardContent className="p-6">
          <div className="flex items-start space-x-4">
            <div className="flex -space-x-2">
              <div className="h-10 w-10 rounded-full bg-muted animate-pulse ring-2 ring-background" />
              <div className="h-10 w-10 rounded-full bg-muted animate-pulse ring-2 ring-background" />
            </div>
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                <div className="h-4 w-4 bg-muted animate-pulse rounded-full" />
                <div className="h-4 w-48 bg-muted animate-pulse rounded" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-full bg-muted animate-pulse rounded" />
                <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
              </div>
              <div className="h-3 w-24 bg-muted animate-pulse rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
)

const DetailsSkeleton = () => (
  <div className="space-y-6 max-w-3xl mx-auto">
    {/* Basic Information */}
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-[140px] mb-2" />
        <Skeleton className="h-4 w-[240px]" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-[80px]" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-[100px]" />
          <Skeleton className="h-[100px] w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-[60px]" />
          <Skeleton className="h-10 w-full" />
        </div>
      </CardContent>
    </Card>

    {/* Status and Stage */}
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-[140px] mb-2" />
        <Skeleton className="h-4 w-[280px]" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-[60px]" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-[60px]" />
          <Skeleton className="h-10 w-full" />
        </div>
      </CardContent>
    </Card>

    {/* Schedule and Assignment */}
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-[180px] mb-2" />
        <Skeleton className="h-4 w-[300px]" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-[120px]" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-[80px]" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-[120px]" />
          <Skeleton className="h-10 w-full" />
        </div>
      </CardContent>
    </Card>

    {/* Danger Zone */}
    <Card className="border-destructive">
      <CardHeader>
        <Skeleton className="h-6 w-[120px] mb-2" />
        <Skeleton className="h-4 w-[240px]" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-10 w-[120px]" />
      </CardContent>
    </Card>
  </div>
)

// Main component
export default function TaskDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { currentSite } = useSite()
  const [task, setTask] = useState<Task | null>(null)
  const [activeTab, setActiveTab] = useState("updates")
  const [isLoading, setIsLoading] = useState(true)
  const formRef = useRef<HTMLFormElement>(null) as MutableRefObject<HTMLFormElement>

  // Fetch task data
  useEffect(() => {
    const fetchTask = async () => {
      if (!currentSite) return

      setIsLoading(true)
      const supabase = createClient()

      const { data: task, error } = await supabase
        .from('tasks')
        .select(`
          *,
          leads:lead_id (
            id,
            name
          )
        `)
        .eq('id', params.id)
        .eq('site_id', currentSite.id)
        .single()

      if (error) {
        console.error('Error fetching task:', error)
        setIsLoading(false)
        return
      }

      setTask(task)
      setIsLoading(false)
    }

    fetchTask()
  }, [currentSite, params.id])

  // Update breadcrumb when component mounts
  useEffect(() => {
    // Update the page title for the browser tab
    document.title = task?.title ? `${task.title} | Market Fit` : "Task | Market Fit"
    
    // Emit a custom event to update the breadcrumb
    const event = new CustomEvent('breadcrumb:update', {
      detail: {
        title: task?.title || "Task",
        path: `/control-center/${params.id}`,
        section: 'Control Center',
        parent: {
          title: 'Control Center',
          path: '/control-center'
        }
      }
    })
    
    window.dispatchEvent(event)
    
    // Cleanup when component unmounts
    return () => {
      document.title = "Market Fit"
    }
  }, [task, params.id])

  // Handle status change
  const handleStatusChange = async (newStatus: Task['status']) => {
    if (!currentSite || !task) return

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', task.id)
        .eq('site_id', currentSite.id)
        .select()
        .single()

      if (error) throw error

      setTask(data)
      toast.success(`Status updated to ${newStatus}`)
    } catch (error) {
      console.error('Error updating task status:', error)
      toast.error("Failed to update task status")
    }
  }

  if (isLoading) {
    return (
      <div className="flex-1 p-0">
        <Tabs defaultValue="updates">
          <StickyHeader>
            <div className="px-16 pt-0 w-full">
              <div className="flex items-center justify-between w-full">
                <TabsList>
                  <TabsTrigger value="updates">Timeline</TabsTrigger>
                  <TabsTrigger value="details">Details</TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-4">
                  <div className="h-10 w-[200px] bg-muted animate-pulse rounded-md" />
                </div>
              </div>
            </div>
          </StickyHeader>
          <div className="max-w-3xl mx-auto">
            <div className="px-16 py-6">
              <UpdatesSkeleton />
            </div>
          </div>
        </Tabs>
      </div>
    )
  }

  return (
    <div className="flex-1 p-0">
      <Tabs defaultValue="updates" onValueChange={setActiveTab}>
        <StickyHeader>
          <div className="px-16 pt-0 w-full">
            <div className="flex items-center justify-between w-full">
              <TabsList>
                <TabsTrigger value="updates">Timeline</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-8">
                {task && activeTab === "updates" && (
                  <TaskStatusBar 
                    currentStatus={task.status}
                    onStatusChange={handleStatusChange}
                  />
                )}
                {task && activeTab === "details" && (
                  <Button 
                    onClick={() => formRef.current?.requestSubmit()}
                    className="gap-2"
                  >
                    <SaveIcon className="h-4 w-4" />
                    Save Changes
                  </Button>
                )}
              </div>
            </div>
          </div>
        </StickyHeader>
        <div className="max-w-3xl mx-auto">
          <TabsContent value="updates" className="px-16 py-6">
            <Suspense fallback={<UpdatesSkeleton />}>
              {task && <TimelineTab task={task} />}
            </Suspense>
          </TabsContent>
          <TabsContent value="details" className="px-16 py-6">
            <Suspense fallback={<DetailsSkeleton />}>
              {task && (
                <DetailsTab 
                  task={task} 
                  onSave={(updatedTask: Task) => setTask(updatedTask)} 
                  formRef={formRef} 
                />
              )}
            </Suspense>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
} 