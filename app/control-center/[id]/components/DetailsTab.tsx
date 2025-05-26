"use client"

import { useState, useEffect, RefObject } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Textarea } from "@/app/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Label } from "@/app/components/ui/label"
import { Trash2, AlertTriangle, Clock, User } from "@/app/components/ui/icons"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/app/components/ui/dialog"
import { toast } from "sonner"
import { Task } from "@/app/types"
import { createClient } from "@/utils/supabase/client"
import { useSite } from "@/app/context/SiteContext"
import { DatePicker } from "@/app/components/ui/date-picker"
import { Badge } from "@/app/components/ui/badge"

interface DetailsTabProps {
  task: Task
  onSave: (updatedTask: Task) => void
  formRef: RefObject<HTMLFormElement>
}

// Status styles
const STATUS_STYLES = {
  pending: "bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200",
  in_progress: "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200",
  completed: "bg-green-50 text-green-700 hover:bg-green-100 border-green-200",
  failed: "bg-red-50 text-red-700 hover:bg-red-100 border-red-200",
  canceled: "bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200"
}

// Stage styles
const STAGE_STYLES = {
  awareness: "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200",
  consideration: "bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200",
  decision: "bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200",
  purchase: "bg-green-50 text-green-700 hover:bg-green-100 border-green-200",
  retention: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200",
  referral: "bg-pink-50 text-pink-700 hover:bg-pink-100 border-pink-200"
}

export default function DetailsTab({ task, onSave, formRef }: DetailsTabProps) {
  const router = useRouter()
  const { currentSite } = useSite()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [leads, setLeads] = useState<Array<{ id: string; name: string }>>([])
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([])
  const [formData, setFormData] = useState({
    title: task.title,
    description: task.description || "",
    status: task.status,
    stage: task.stage || "",
    scheduled_date: new Date(task.scheduled_date),
    lead_id: task.lead_id || "",
    assignee: task.assignee || "",
    type: task.type || ""
  })

  // Fetch leads and users
  useEffect(() => {
    const fetchData = async () => {
      if (!currentSite) return
      const supabase = createClient()

      // Fetch leads
      const { data: leadsData } = await supabase
        .from('leads')
        .select('id, name')
        .eq('site_id', currentSite.id)
        .order('name')

      if (leadsData) setLeads(leadsData)

      // Fetch users
      const { data: usersData } = await supabase
        .from('profiles')
        .select('id, name')
        .order('name')

      if (usersData) setUsers(usersData)
    }

    fetchData()
  }, [currentSite])

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!currentSite) return

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('tasks')
        .update({
          title: formData.title,
          description: formData.description,
          status: formData.status,
          stage: formData.stage,
          scheduled_date: formData.scheduled_date.toISOString(),
          lead_id: formData.lead_id || null,
          assignee: formData.assignee || null,
          type: formData.type || null
        })
        .eq('id', task.id)
        .eq('site_id', currentSite.id)
        .select(`
          *,
          leads:lead_id (
            id,
            name
          )
        `)
        .single()

      if (error) throw error

      onSave(data)
      toast.success("Task updated successfully")
    } catch (error) {
      console.error('Error updating task:', error)
      toast.error("Failed to update task")
    }
  }

  // Handle task deletion
  const handleDelete = async () => {
    if (!currentSite) return

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', task.id)
        .eq('site_id', currentSite.id)

      if (error) throw error

      toast.success("Task deleted successfully")
      router.push('/control-center')
    } catch (error) {
      console.error('Error deleting task:', error)
      toast.error("Failed to delete task")
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      {/* Task ID Information */}
      <Card>
        <CardHeader>
          <CardTitle>Task Identification</CardTitle>
          <CardDescription>
            Unique identifiers for this task
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Serial ID</Label>
              <div className="font-mono text-sm bg-muted px-3 py-2 rounded-md border">
                {task.serial_id}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Internal ID</Label>
              <div className="font-mono text-xs text-muted-foreground bg-muted px-3 py-2 rounded-md border">
                {task.id}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>
            Edit the basic details of your task
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter task title"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter task description"
              className="min-h-[100px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select 
              value={formData.type} 
              onValueChange={(value) => setFormData({ ...formData, type: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="website_visit">Website Visit</SelectItem>
                <SelectItem value="demo">Demo</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="call">Call</SelectItem>
                <SelectItem value="quote">Quote</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="payment">Payment</SelectItem>
                <SelectItem value="referral">Referral</SelectItem>
                <SelectItem value="feedback">Feedback</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Status and Stage */}
      <Card>
        <CardHeader>
          <CardTitle>Status and Stage</CardTitle>
          <CardDescription>
            Update the current status and stage of your task
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select 
              value={formData.status} 
              onValueChange={(value) => setFormData({ ...formData, status: value as Task['status'] })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="stage">Stage</Label>
            <Select 
              value={formData.stage} 
              onValueChange={(value) => setFormData({ ...formData, stage: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="awareness">Awareness</SelectItem>
                <SelectItem value="consideration">Consideration</SelectItem>
                <SelectItem value="decision">Decision</SelectItem>
                <SelectItem value="purchase">Purchase</SelectItem>
                <SelectItem value="retention">Retention</SelectItem>
                <SelectItem value="referral">Referral</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Schedule and Assignment */}
      <Card>
        <CardHeader>
          <CardTitle>Schedule and Assignment</CardTitle>
          <CardDescription>
            Set when the task is scheduled and who it's assigned to
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="scheduled_date">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Scheduled Date
              </div>
            </Label>
            <DatePicker
              date={formData.scheduled_date}
              setDate={(date) => setFormData({ ...formData, scheduled_date: date })}
              mode="task"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="assignee">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Assignee
              </div>
            </Label>
            <Select 
              value={formData.assignee} 
              onValueChange={(value) => setFormData({ ...formData, assignee: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select assignee" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lead">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Associated Lead
              </div>
            </Label>
            <Select 
              value={formData.lead_id} 
              onValueChange={(value) => setFormData({ ...formData, lead_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select lead" />
              </SelectTrigger>
              <SelectContent>
                {leads.map((lead) => (
                  <SelectItem key={lead.id} value={lead.id}>
                    {lead.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Actions in this section cannot be undone
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            type="button"
            onClick={() => setIsDeleteDialogOpen(true)}
            className="w-full sm:w-auto"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Task
          </Button>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this task? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-4">
            <AlertTriangle className="h-12 w-12 text-destructive" />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  )
} 