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
import { useLocalization } from "@/app/context/LocalizationContext"
import { createTask } from "@/app/tasks/actions"
import { toast } from "sonner"
import { type CreateTaskFormValues } from "@/app/tasks/types"
import { Combobox } from "./ui/combobox"
import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { resolveRelationId } from "@/app/commerce/resolve-relation"
import { TASK_TYPES } from "@/app/leads/types"
import { createClient } from "@/lib/supabase/client"
import { siteMembersService } from "@/app/services/site-members-service"

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
  const { t } = useLocalization()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [date, setDate] = useState<Date>(new Date())
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([])
  const [leads, setLeads] = useState<Array<{ id: string; name: string }>>([])
  const [leadValue, setLeadValue] = useState<RelationSelectValue>(null)
    const [taskCalendarValue, setTaskCalendarValue] = useState<RelationSelectValue>(null)
    const [schedules, setSchedules] = useState<any[]>([])
    const [schedulesLoading, setSchedulesLoading] = useState(false)
    const [taskTime, setTaskTime] = useState(new Date().toTimeString().slice(0, 5))

    useEffect(() => {
      async function fetchCalendars() {
        if (!currentSite) return
        setSchedulesLoading(true)
        try {
          const supabase = createClient()
          
        // 1. Site calendars
        const cals: any[] = []
        const siteCals = currentSite?.settings?.calendars || []
        siteCals.forEach((cal: any) => {
          cals.push({
            id: cal.id,
            name: cal.name,
            duration_minutes: cal.duration || 30,
            type: 'site',
            label: `${cal.name} (Team)`,
            location: cal.location || null
          })
        })
        
        // 2. Profile event types
        if (users.length > 0) {
          const memberIds = users.map(u => u.id)
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, name, settings")
            .in("id", memberIds)
            
          if (profilesData) {
            profilesData.forEach(profile => {
              const eventTypes = profile.settings?.calendar?.event_types || []
              eventTypes.forEach((et: any) => {
                cals.push({
                  id: et.id,
                  name: et.title,
                  duration_minutes: et.duration || 30,
                  type: 'profile',
                  label: `${et.title} (${profile.name || 'User'})`,
                  owner_id: profile.id,
                  location: et.location || null
                })
              })
            })
          }
        }
          
          setSchedules(cals)
        } catch (error) {
          console.error("Error fetching calendars:", error)
        } finally {
          setSchedulesLoading(false)
        }
      }
      
      if (open) {
        fetchCalendars()
      }
    }, [currentSite, open, users])

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
      try {
        const uniqueUsers = await siteMembersService.getAssigneeOptions(currentSite.id)
        setUsers(uniqueUsers)
      } catch (error) {
        console.error("Error fetching site members:", error)
      }
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

      const cleanedData: any = {
        ...formData,
        description: formData.description || null,
        scheduled_date: new Date(`${date.toISOString().split("T")[0]}T${taskTime}:00`),
        site_id: currentSite.id,
        lead_id: resolvedLeadId || undefined,
        assignee: formData.assignee || undefined,
        type: formData.type || undefined,
        stage: formData.stage || undefined,
      }
      
      const taskCalendarId = taskCalendarValue?.mode === "existing" ? taskCalendarValue.id : null
      const taskCalendarSchedule = schedules.find(s => s.id === taskCalendarId)

      if (taskCalendarSchedule) {
        const startDateObj = new Date(`${date.toISOString().split("T")[0]}T${taskTime}:00`)
        const endDateObj = new Date(startDateObj.getTime() + (taskCalendarSchedule.duration_minutes * 60000))
        cleanedData.description = formData.description || null
        cleanedData.metadata = {
          _calendar_context: {
            origin: "tasks_modal",
            catalog_item_id: taskCalendarSchedule.id,
            catalog_item_name: taskCalendarSchedule.name || "Team Calendar",
            duration: `${taskCalendarSchedule.duration_minutes} min`,
            end_time: endDateObj.toISOString(),
            location: taskCalendarSchedule.location || null
          }
        }
      } else {
        cleanedData.description = formData.description || null
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
      setTaskCalendarValue(null)
      setDate(new Date())
      setTaskTime(new Date().toTimeString().slice(0, 5))
      
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
              <Label>Calendar (Optional)</Label>
              <RelationSelect
                options={schedules.map((schedule: any) => ({
                  id: schedule.id,
                  label: schedule.label || schedule.name || "Unnamed Calendar",
                }))}
                value={taskCalendarValue}
                onValueChange={setTaskCalendarValue}
                allowCreate={false}
                placeholder="Link to a specific calendar/schedule..."
                emptyMessage={schedulesLoading ? "Loading calendars..." : "No calendars found"}
                className="h-12"
              />
            </div>
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
              <Label>Due Date & Time</Label>
              <div className="flex gap-2">
                <div className="relative z-[1000000] flex-1">
                  <DatePicker
                    date={date}
                    setDate={setDate}
                    className="h-12 w-full"
                    placeholder={t("datePicker.selectDueDate")}
                  />
                </div>
                <div className="w-[120px]">
                  <Input
                    type="time"
                    value={taskTime}
                    onChange={(e) => setTaskTime(e.target.value)}
                    className="h-12"
                  />
                </div>
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