import { useState, useEffect } from "react"
import { Button } from "./ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Textarea } from "./ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select"
import { DatePicker } from "./ui/date-picker"
import { PlusCircle, Users } from "./ui/icons"
import { useSite } from "@/app/context/SiteContext"
import { createTask } from "@/app/tasks/actions"
import { toast } from "sonner"
import { type CreateTaskFormValues } from "@/app/tasks/types"
import { TASK_TYPES } from "@/app/leads/types"
import { Combobox } from "./ui/combobox"
import { createClient } from "@/lib/supabase/client"

const TASK_STAGES = [
  'awareness',
  'consideration',
  'decision',
  'purchase',
  'retention',
  'referral'
]

interface CreateTaskDialogProps {
  trigger?: React.ReactNode
}

export function CreateTaskDialog({ trigger }: CreateTaskDialogProps) {
  const { currentSite } = useSite()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [date, setDate] = useState<Date>(new Date())
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([])
  const [leads, setLeads] = useState<Array<{ id: string; name: string }>>([])
  const [formData, setFormData] = useState<CreateTaskFormValues>({
    title: "",
    description: "",
    status: "pending",
    priority: "medium",
    site_id: currentSite?.id || "",
    type: "",
    stage: "",
    amount: 0,
    lead_id: ""
  })

  useEffect(() => {
    async function fetchUsers() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .order('name')

      if (error) {
        console.error('Error fetching users:', error)
        return
      }

      setUsers(data || [])
    }

    async function fetchLeads() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('leads')
        .select('id, name')
        .eq('site_id', currentSite?.id)

      if (error) {
        console.error('Error fetching leads:', error)
        return
      }

      setLeads(data || [])
    }

    if (currentSite) {
      fetchUsers()
      fetchLeads()
    }
  }, [currentSite])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentSite) {
      toast.error("Please select a site first")
      return
    }

    setIsSubmitting(true)
    try {
      const result = await createTask({
        ...formData,
        due_date: date,
        site_id: currentSite.id,
      })

      if (result.error) {
        throw new Error(result.error)
      }

      toast.success("Task created successfully")
      setOpen(false)
      setFormData({
        title: "",
        description: "",
        status: "pending",
        priority: "medium",
        site_id: currentSite.id,
        type: "",
        stage: "",
        amount: 0,
        lead_id: ""
      })
      setDate(new Date())
    } catch (error) {
      console.error("Error creating task:", error)
      toast.error(error instanceof Error ? error.message : "Failed to create task")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Task
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] z-[99999]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Task</DialogTitle>
            <DialogDescription>
              Add a new task to your project. Fill out the information below.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="Enter task title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                required
                className="h-12"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Enter task description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                required
                className="min-h-[100px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value: "low" | "medium" | "high") =>
                    setFormData({ ...formData, priority: value })
                  }
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(
                    value: "pending" | "in_progress" | "completed"
                  ) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_TYPES.map((taskType) => (
                      <SelectItem key={taskType.id} value={taskType.id}>
                        {taskType.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Stage</Label>
                <Select
                  value={formData.stage}
                  onValueChange={(value) => setFormData({ ...formData, stage: value })}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STAGES.map((stage) => (
                      <SelectItem key={stage} value={stage}>
                        {stage.charAt(0).toUpperCase() + stage.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Due Date</Label>
                <div className="relative z-[1000000]">
                  <DatePicker
                    date={date}
                    setDate={setDate}
                    className="h-12"
                    placeholder="Select due date"
                    mode="task"
                    showTimePicker={true}
                    timeFormat="12h"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.amount || ""}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                    className="h-12 pl-7"
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Lead</Label>
                <Combobox
                  options={leads.map(lead => ({ value: lead.id, label: lead.name }))}
                  value={formData.lead_id || ""}
                  onValueChange={(value) => setFormData({ ...formData, lead_id: value })}
                  placeholder="Select lead"
                  emptyMessage="No leads found"
                  className="h-12"
                />
              </div>
              <div className="grid gap-2">
                <Label>Assigned To</Label>
                <Combobox
                  options={users.map(user => ({ value: user.id, label: user.name }))}
                  value={formData.assigned_to || ""}
                  onValueChange={(value) => setFormData({ ...formData, assigned_to: value })}
                  placeholder="Select user"
                  emptyMessage="No users found"
                  icon={<Users className="h-4 w-4" />}
                  className="h-12"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={isSubmitting || !currentSite}
              className="w-full"
            >
              {isSubmitting ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 