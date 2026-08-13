import { useState, useEffect } from "react"
import { Button } from "./ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogForm,
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
import { DatePicker } from "@/app/components/ui/date-picker"
import { PlusCircle, Users } from "./ui/icons"
import { useSite } from "@/app/context/SiteContext"
import { createTask } from "@/app/tasks/actions"
import { toast } from "sonner"
import { type CreateTaskFormValues } from "@/app/tasks/types"
import { Combobox } from "./ui/combobox"
import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { resolveRelationId } from "@/app/commerce/resolve-relation"
import { TASK_TYPES } from "@/app/leads/types"
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
  onTaskCreated?: () => void
}

export function CreateTaskDialog({ trigger, onTaskCreated }: CreateTaskDialogProps) {
  const { currentSite } = useSite()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [date, setDate] = useState<Date>(new Date())
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([])
  const [leads, setLeads] = useState<Array<{ id: string; name: string }>>([])
  const [leadValue, setLeadValue] = useState<RelationSelectValue>(null)
  const [formData, setFormData] = useState<CreateTaskFormValues>({
    title: "",
    description: "",
    status: "pending",
    priority: 2,
    site_id: currentSite?.id || "",
    type: "",
    stage: "",
    amount: 0
  })

  useEffect(() => {
    async function fetchUsers() {
      if (!currentSite) return

      const supabase = createClient()
      
      // Get site owner
      const { data: ownerData, error: ownerError } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('id', currentSite.user_id)
        .single()

      if (ownerError && ownerError.code !== 'PGRST116') {
        console.error('Error fetching site owner:', ownerError)
      }

      // Get site members - first get the member records
      const { data: siteMembers, error: siteMembersError } = await supabase
        .from('site_members')
        .select('user_id')
        .eq('site_id', currentSite.id)
        .eq('status', 'active')
        .not('user_id', 'is', null)

      if (siteMembersError) {
        console.error('Error fetching site members:', siteMembersError)
      }

      // Get profiles for site members
      let memberProfiles: Array<{ id: string; name: string }> = []
      if (siteMembers && siteMembers.length > 0) {
        const memberUserIds = siteMembers.map((m: { user_id: string }) => m.user_id)
        
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', memberUserIds)

        if (profilesError) {
          console.error('Error fetching member profiles:', profilesError)
        } else {
          memberProfiles = profilesData || []
        }
      }

      // Combine owner and members
      const allUsers = []
      
      // Add owner if found
      if (ownerData) {
        allUsers.push(ownerData)
      }
      
      // Add members
      allUsers.push(...memberProfiles)

      // Remove duplicates (in case owner is also in members table) and sort
      const uniqueUsers = allUsers.filter((user, index, self) => 
        index === self.findIndex(u => u.id === user.id)
      ).sort((a, b) => a.name.localeCompare(b.name))

      setUsers(uniqueUsers)
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
      let resolvedLeadId = null;
      if (leadValue) {
        const { id, error } = await resolveRelationId("lead", leadValue, currentSite.id);
        if (error) throw new Error(error);
        resolvedLeadId = id;
      }

      // Clean the data - convert empty strings to undefined for optional fields
      const cleanedData = {
        ...formData,
        scheduled_date: date,
        site_id: currentSite.id,
        lead_id: resolvedLeadId || undefined,
        assignee: formData.assignee || undefined,
        type: formData.type || undefined,
        stage: formData.stage || undefined,
      }

      const result = await createTask(cleanedData)

      if (result.error) {
        throw new Error(result.error)
      }

      toast.success("Task created successfully")
      setOpen(false)
      setFormData({
        title: "",
        description: "",
        status: "pending",
        priority: 2,
        site_id: currentSite.id,
        type: "",
        stage: "",
        amount: 0
      })
      setLeadValue(null)
      setDate(new Date())
      
      // Emit custom event for task creation
      const event = new CustomEvent('task:created', {
        detail: { task: result.data }
      })
      window.dispatchEvent(event)
      
      if (onTaskCreated) {
        onTaskCreated()
      }
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
      <DialogContent size="md" busy={isSubmitting}>
        <DialogForm onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Task</DialogTitle>
            <DialogDescription>
              Add a new task to your project. Fill out the information below.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4">
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
            <div className="grid gap-2">
              <Label>Due Date</Label>
              <div className="relative z-[1000000]">
                <DatePicker
                  date={date}
                  setDate={setDate}
                  className="h-12 w-full"
                  placeholder="Select due date"
                  mode="task"
                  showTimePicker={true}
                  timeFormat="12h"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Priority</Label>
                <Select
                  value={formData.priority.toString()}
                  onValueChange={(value) =>
                    setFormData({ ...formData, priority: parseInt(value) })
                  }
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Low</SelectItem>
                    <SelectItem value="2">Medium</SelectItem>
                    <SelectItem value="3">High</SelectItem>
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
                        <div className="flex items-center gap-2">
                          <span>{taskType.emoji}</span>
                          <span>{taskType.name}</span>
                        </div>
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
                  className="h-12 pl-7 w-full"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Lead</Label>
                <RelationSelect
                  options={leads.map(lead => ({ id: lead.id, label: lead.name }))}
                  value={leadValue}
                  onValueChange={setLeadValue}
                  placeholder="Select lead"
                  emptyMessage="No leads found"
                />
              </div>
              <div className="grid gap-2">
                <Label>Assigned To</Label>
                <Combobox
                  options={users.map(user => ({ value: user.id, label: user.name }))}
                  value={formData.assignee || ""}
                  onValueChange={(value) => setFormData({ ...formData, assignee: value })}
                  placeholder="Select user"
                  emptyMessage="No users found"
                  icon={<Users className="h-4 w-4" />}
                  className="h-12"
                />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !currentSite}
            >
              {isSubmitting ? "Creating..." : "Create task"}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  )
} 