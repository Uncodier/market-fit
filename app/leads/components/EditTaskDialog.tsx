"use client"

import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Textarea } from "@/app/components/ui/textarea"
import { Label } from "@/app/components/ui/label"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/app/components/ui/select"
import { DatePicker } from "@/app/components/ui/date-picker"
import { format, addDays } from "date-fns"
import { Task, TASK_TYPES, JOURNEY_STAGES, TASK_STATUSES } from "../types"
import { useTasks } from "../context/TasksContext"

interface EditTaskDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  task: Task | null
}

export function EditTaskDialog({ isOpen, onOpenChange, task }: EditTaskDialogProps) {
  const { updateTask } = useTasks()
  
  // Form state
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [type, setType] = useState<Task["type"]>("meeting")
  const [stage, setStage] = useState<Task["stage"]>("awareness")
  const [status, setStatus] = useState<Task["status"]>("pending")
  const [scheduledDate, setScheduledDate] = useState<Date>(new Date())
  const [amount, setAmount] = useState<string>("")
  const [notes, setNotes] = useState<string>("")
  const [submitting, setSubmitting] = useState(false)
  
  // Load task data when dialog opens or task changes
  useEffect(() => {
    if (task && isOpen) {
      setTitle(task.title || "")
      setDescription(task.description || "")
      setType(task.type)
      setStage(task.stage)
      setStatus(task.status)
      setScheduledDate(new Date(task.scheduled_date))
      setAmount(task.amount ? task.amount.toString() : "")
      setNotes(task.notes || "")
    }
  }, [task, isOpen])
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!task) return
    
    setSubmitting(true)
    
    try {
      // Create update data object
      const updateData: Partial<Task> = {
        title,
        description,
        type,
        stage,
        status,
        scheduled_date: scheduledDate.toISOString(),
        notes
      }
      
      // Only include amount for specific task types or non-awareness stages
      if ((["quote", "contract", "payment"].includes(type) || stage !== "awareness") && amount) {
        updateData.amount = Number(amount)
      } else {
        updateData.amount = undefined
      }
      
      // Add completed_date if status is set to completed
      if (status === "completed" && task.status !== "completed") {
        updateData.completed_date = new Date().toISOString()
      } else if (status !== "completed") {
        updateData.completed_date = undefined
      }
      
      await updateTask(task.id, updateData)
      
      // Close dialog
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to update task:", error)
    } finally {
      setSubmitting(false)
    }
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 gap-2">
              <Label htmlFor="title" className="text-sm font-medium">Title <span className="text-red-500">*</span></Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-12"
                placeholder="Enter task title"
                required
              />
            </div>
            
            <div className="grid grid-cols-1 gap-2">
              <Label htmlFor="description" className="text-sm font-medium">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[80px]"
                placeholder="Enter task description"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid grid-cols-1 gap-2">
                <Label htmlFor="type" className="text-sm font-medium">Type</Label>
                <Select
                  value={type}
                  onValueChange={(value) => setType(value as Task["type"])}
                >
                  <SelectTrigger id="type" className="h-12">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_TYPES.map((type) => (
                      <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {stage !== "awareness" && (
                <div className="grid grid-cols-1 gap-2">
                  <Label htmlFor="amount" className="text-sm font-medium">Amount ($)</Label>
                  <Input
                    id="amount"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="h-12"
                  />
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid grid-cols-1 gap-2">
                <Label htmlFor="status" className="text-sm font-medium">Status</Label>
                <Select
                  value={status}
                  onValueChange={(value) => setStatus(value as Task["status"])}
                >
                  <SelectTrigger id="status" className="h-12">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map((status) => (
                      <SelectItem key={status.id} value={status.id}>{status.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-1 gap-2">
                <Label className="text-sm font-medium">Scheduled Date</Label>
                <div className="relative z-[200]">
                  <DatePicker 
                    date={scheduledDate}
                    setDate={setScheduledDate}
                    position="top"
                    className="w-full"
                    mode="task"
                  />
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-2">
              <Label htmlFor="notes" className="text-sm font-medium">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[80px]"
                placeholder="Enter additional notes"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 