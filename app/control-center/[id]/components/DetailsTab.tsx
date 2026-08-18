"use client"

import { useState, useEffect, RefObject } from "react"
import { useRouter } from "next/navigation"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardDescription,
  SectionCardContent,
  SectionCardFooter,
} from "@/app/components/ui/section-card"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Textarea } from "@/app/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { resolveRelationId } from "@/app/commerce/resolve-relation"
import { Label } from "@/app/components/ui/label"
import { Trash2, AlertTriangle, Clock, User } from "@/app/components/ui/icons"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/app/components/ui/dialog"
import { toast } from "sonner"
import { Task } from "@/app/types"
import { createClient } from "@/utils/supabase/client"
import { siteMembersService } from "@/app/services/site-members-service"
import { useSite } from "@/app/context/SiteContext"
import { DatePicker } from "@/app/components/ui/date-picker"
import { TimeSelect } from "@/app/components/ui/time-select"
import { Badge } from "@/app/components/ui/badge"
import { navigateToControlCenter } from "@/app/hooks/use-navigation-history"

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
  const [savingSection, setSavingSection] = useState<string | null>(null)
  const [leads, setLeads] = useState<Array<{ id: string; name: string }>>([])
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([])
  
  let initialNotes = task.description || ""
  let initialCalendarId = null
  let initialCalendarName = "Calendar"
  let initialCalendarContext = task.metadata?._calendar_context || null

  if (!initialCalendarContext) {
    try {
      const parsed = JSON.parse(task.description || "{}")
      if (parsed._calendar_context) {
        initialNotes = parsed.notes || ""
        initialCalendarContext = parsed._calendar_context
      }
    } catch (e) {}
  } else {
    try {
      const parsed = JSON.parse(task.description || "{}")
      if (parsed._calendar_context) {
        initialNotes = parsed.notes || ""
      }
    } catch (e) {}
  }

  if (initialCalendarContext) {
    initialCalendarId = initialCalendarContext.catalog_item_id
    initialCalendarName = initialCalendarContext.catalog_item_name || "Calendar"
  }

  const [leadValue, setLeadValue] = useState<RelationSelectValue>(
    task.lead_id ? { mode: "existing", id: task.lead_id, label: task.leads?.name || "Unknown Lead" } : null
  )

  const [taskCalendarValue, setTaskCalendarValue] = useState<RelationSelectValue>(
    initialCalendarId ? { mode: "existing", id: initialCalendarId, label: initialCalendarName } : null
  )
  const [calendarContext, setCalendarContext] = useState<any>(initialCalendarContext)
  const [schedules, setSchedules] = useState<any[]>([])
  const [schedulesLoading, setSchedulesLoading] = useState(false)

  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    status: Task['status'];
    stage: string;
    scheduled_date: Date;
    lead_id: string;
    assignee: string;
    type: string;
    notes: string;
  }>({
    title: task.title,
    description: initialNotes,
    status: task.status,
    stage: task.stage || "",
    scheduled_date: new Date(task.scheduled_date),
    lead_id: task.lead_id || "",
    assignee: task.assignee || "",
    type: task.type || "",
    notes: task.metadata?.notes || ""
  })

  // Fetch calendars
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
            profilesData.forEach((profile: any) => {
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
    
    fetchCalendars()
  }, [currentSite, users])

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

      try {
        setUsers(await siteMembersService.getAssigneeOptions(currentSite.id))
      } catch (error) {
        console.error("Error fetching site members:", error)
        setUsers([])
      }
    }

    fetchData()
  }, [currentSite])

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!currentSite) return

    try {
      let finalLeadId = formData.lead_id;
      if (leadValue && leadValue.mode === "create") {
         const { id, error } = await resolveRelationId("lead", leadValue, currentSite.id);
         if (error) throw new Error(error);
         finalLeadId = id || "";
      } else if (leadValue && leadValue.mode === "existing") {
         finalLeadId = leadValue.id;
      } else if (!leadValue) {
         finalLeadId = "";
      }

      let finalDescription = formData.description;
      const taskCalendarId = taskCalendarValue?.mode === "existing" ? taskCalendarValue.id : null;
      const taskCalendarSchedule = schedules.find(s => s.id === taskCalendarId);
      let newContext = calendarContext;

      if (taskCalendarSchedule) {
        const startDateObj = formData.scheduled_date
        const endDateObj = new Date(startDateObj.getTime() + (taskCalendarSchedule.duration_minutes * 60000))
        newContext = {
          ...calendarContext,
          origin: calendarContext?.origin || "control_center",
          catalog_item_id: taskCalendarSchedule.id,
          catalog_item_name: taskCalendarSchedule.name || "Team Calendar",
          duration: `${taskCalendarSchedule.duration_minutes} min`,
          end_time: endDateObj.toISOString(),
          location: taskCalendarSchedule.location || calendarContext?.location || null
        }
      } else {
        newContext = null;
      }

      let updatedMetadata = { ...task.metadata, notes: formData.notes }
      if (newContext) {
        updatedMetadata._calendar_context = newContext
      } else {
        delete updatedMetadata._calendar_context
      }

      const supabase = createClient()
      const { data, error } = await supabase
        .from('tasks')
        .update({
          title: formData.title,
          description: finalDescription || null,
          status: formData.status,
          stage: formData.stage,
          scheduled_date: formData.scheduled_date.toISOString(),
          lead_id: finalLeadId || null,
          assignee: formData.assignee || null,
          type: formData.type || null,
          metadata: updatedMetadata
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

      const taskData = data as any;
      setCalendarContext(newContext);
      setFormData({ ...formData, lead_id: finalLeadId || "" })
      if (leadValue && leadValue.mode === "create" && taskData.leads) {
         setLeadValue({ mode: "existing", id: finalLeadId, label: taskData.leads.name || "Unknown Lead" })
      }

      onSave(taskData)
      toast.success("Task updated successfully")
    } catch (error) {
      console.error('Error updating task:', error)
      toast.error("Failed to update task")
    }
  }

  // Handle save individual section
  const handleSaveSection = async (section: string) => {
    if (!currentSite) return

    setSavingSection(section)
    try {
      const supabase = createClient()
      
      let updateData: any = {}
      
      if (section === 'basic') {
        let finalDescription = formData.description;
        updateData = {
          title: formData.title,
          description: finalDescription || null,
          type: formData.type || null
        }
      } else if (section === 'status') {
        updateData = {
          status: formData.status,
          stage: formData.stage
        }
      } else if (section === 'schedule') {
        let finalLeadId = formData.lead_id;
        if (leadValue && leadValue.mode === "create") {
            const { id, error } = await resolveRelationId("lead", leadValue, currentSite.id);
            if (error) throw new Error(error);
            finalLeadId = id || "";
        } else if (leadValue && leadValue.mode === "existing") {
            finalLeadId = leadValue.id;
        } else if (!leadValue) {
            finalLeadId = "";
        }
        
        setFormData({ ...formData, lead_id: finalLeadId || "" })

        let finalDescription = formData.description;
        const taskCalendarId = taskCalendarValue?.mode === "existing" ? taskCalendarValue.id : null;
        const taskCalendarSchedule = schedules.find(s => s.id === taskCalendarId);
        let newContext = calendarContext;

        if (taskCalendarSchedule) {
          const startDateObj = formData.scheduled_date
          const endDateObj = new Date(startDateObj.getTime() + (taskCalendarSchedule.duration_minutes * 60000))
          newContext = {
            ...calendarContext,
            origin: calendarContext?.origin || "control_center",
            catalog_item_id: taskCalendarSchedule.id,
            catalog_item_name: taskCalendarSchedule.name || "Team Calendar",
            duration: `${taskCalendarSchedule.duration_minutes} min`,
            end_time: endDateObj.toISOString(),
            location: taskCalendarSchedule.location || calendarContext?.location || null
          }
        } else {
          newContext = null;
        }

        let updatedMetadata = { ...task.metadata }
        if (newContext) {
          updatedMetadata._calendar_context = newContext
        } else {
          delete updatedMetadata._calendar_context
        }

        updateData = {
          scheduled_date: formData.scheduled_date.toISOString(),
          lead_id: finalLeadId || null,
          assignee: formData.assignee || null,
          description: finalDescription || null,
          metadata: updatedMetadata
        }
        setCalendarContext(newContext);
      } else if (section === 'notes') {
        let updatedMetadata = { ...task.metadata, notes: formData.notes }
        updateData = {
          metadata: updatedMetadata
        }
      }

      const { data, error } = await supabase
        .from('tasks')
        .update(updateData)
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

      const taskData = data as any;
      if (section === 'schedule' && leadValue && leadValue.mode === "create" && taskData.leads) {
         setLeadValue({ mode: "existing", id: taskData.leads.id, label: taskData.leads.name || "Unknown Lead" })
      }

      onSave(taskData)
      const sectionNames: Record<string, string> = {
        basic: 'Basic Information',
        status: 'Status & Stage',
        schedule: 'Schedule & Assignment',
        notes: 'Notes'
      }
      toast.success(`${sectionNames[section]} saved successfully`)
    } catch (error) {
      console.error(`Error saving ${section}:`, error)
      toast.error(`Failed to save ${section}`)
    } finally {
      setSavingSection(null)
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
      navigateToControlCenter({ router })
    } catch (error) {
      console.error('Error deleting task:', error)
      toast.error("Failed to delete task")
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      {/* Task ID Information */}
      <SectionCard>
        <SectionCardHeader>
          <SectionCardTitle>Task Identification</SectionCardTitle>
          <SectionCardDescription>
            Unique identifiers for this task
          </SectionCardDescription>
        </SectionCardHeader>
        <SectionCardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 min-w-0">
              <Label>Serial ID</Label>
              <div className="font-mono text-sm bg-muted px-3 py-2 rounded-md border h-10 flex items-center">
                <span className="truncate w-full">{task.serial_id}</span>
              </div>
            </div>
            <div className="space-y-2 min-w-0">
              <Label>Internal ID</Label>
              <div className="font-mono text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md border h-10 flex items-center">
                <span className="truncate w-full">{task.id}</span>
              </div>
            </div>
          </div>
        </SectionCardContent>
      </SectionCard>

      {/* Basic Information */}
      <SectionCard>
        <SectionCardHeader>
          <SectionCardTitle>Basic Information</SectionCardTitle>
          <SectionCardDescription>
            Edit the basic details of your task
          </SectionCardDescription>
        </SectionCardHeader>
        <SectionCardContent className="space-y-4">
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
              className="min-h-[72px]"
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
        </SectionCardContent>
        <ActionFooter>
          <Button variant="outline" size="sm"
            type="button"
            onClick={() => handleSaveSection('basic')}
            disabled={savingSection === 'basic'}
          >
            {savingSection === 'basic' ? "Saving..." : "Save Basic Information"}
          </Button>
        </ActionFooter>
      </SectionCard>

      {/* Status and Stage */}
      <SectionCard>
        <SectionCardHeader>
          <SectionCardTitle>Status and Stage</SectionCardTitle>
          <SectionCardDescription>
            Update the current status and stage of your task
          </SectionCardDescription>
        </SectionCardHeader>
        <SectionCardContent className="space-y-4">
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
        </SectionCardContent>
      </SectionCard>

      {/* Schedule and Assignment */}
      <SectionCard>
        <SectionCardHeader>
          <SectionCardTitle>Schedule and Assignment</SectionCardTitle>
          <SectionCardDescription>
            Set when the task is scheduled and who it's assigned to
          </SectionCardDescription>
        </SectionCardHeader>
        <SectionCardContent className="space-y-4">
          <div className="space-y-2">
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
              className="h-[42px]"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scheduled_date">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Scheduled Date
                </div>
              </Label>
              <DatePicker
                date={formData.scheduled_date}
                setDate={(date) => {
                  const newDate = new Date(date)
                  newDate.setHours(formData.scheduled_date.getHours())
                  newDate.setMinutes(formData.scheduled_date.getMinutes())
                  setFormData({ ...formData, scheduled_date: newDate })
                }}
                mode="task"
                className="w-full h-[42px] bg-background border border-input rounded-md hover:bg-accent hover:text-accent-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 opacity-0" />
                  Time
                </div>
              </Label>
              <TimeSelect
                value={formData.scheduled_date.toTimeString().slice(0, 5)}
                onValueChange={(time) => {
                  const newDate = new Date(formData.scheduled_date)
                  const [hours, minutes] = time.split(':').map(Number)
                  newDate.setHours(hours)
                  newDate.setMinutes(minutes)
                  setFormData({ ...formData, scheduled_date: newDate })
                }}
                step={15}
                className="h-[42px]"
              />
            </div>
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
              <SelectTrigger className="h-[42px]">
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
            <RelationSelect 
              options={leads.map(lead => ({ id: lead.id, label: lead.name || "Unknown Lead" }))}
              value={leadValue}
              onValueChange={setLeadValue}
              placeholder="Select lead"
              emptyMessage="No leads found"
              className="h-[42px]"
            />
          </div>
        </SectionCardContent>
        <ActionFooter>
          <Button variant="outline" size="sm"
            type="button"
            onClick={() => handleSaveSection('schedule')}
            disabled={savingSection === 'schedule'}
          >
            {savingSection === 'schedule' ? "Saving..." : "Save Schedule & Assignment"}
          </Button>
        </ActionFooter>
      </SectionCard>

      {/* Notes */}
      <SectionCard>
        <SectionCardHeader>
          <SectionCardTitle>Notes</SectionCardTitle>
          <SectionCardDescription>
            Additional notes for this task
          </SectionCardDescription>
        </SectionCardHeader>
        <SectionCardContent>
          <Textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Enter notes here..."
            className="min-h-[120px]"
          />
        </SectionCardContent>
        <ActionFooter>
          <Button variant="outline" size="sm"
            type="button"
            onClick={() => handleSaveSection('notes')}
            disabled={savingSection === 'notes'}
          >
            {savingSection === 'notes' ? "Saving..." : "Save Notes"}
          </Button>
        </ActionFooter>
      </SectionCard>

      {/* Danger Zone */}
      <SectionCard className="border-destructive">
        <SectionCardHeader>
          <SectionCardTitle className="text-destructive">Danger Zone</SectionCardTitle>
          <SectionCardDescription>
            Actions in this section cannot be undone
          </SectionCardDescription>
        </SectionCardHeader>
        <SectionCardContent>
          <Button
            variant="destructive"
            type="button"
            onClick={() => setIsDeleteDialogOpen(true)}
            className="w-full sm:w-auto"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Task
          </Button>
        </SectionCardContent>
      </SectionCard>

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