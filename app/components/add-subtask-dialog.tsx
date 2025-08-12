import { Button } from "@/app/components/ui/button"
import { LoadingSkeleton } from "@/app/components/ui/loading-skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/ui/dialog"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { 
  PlusCircle, 
  ClipboardList,
  XCircle,
  CheckCircle2
} from "@/app/components/ui/icons"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useState, useRef } from "react"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select"
import * as z from "zod"

// Define the schema for subtask form
const subtaskFormSchema = z.object({
  title: z.string()
    .min(3, { message: "Title must have at least 3 characters" })
    .max(120, { message: "Title cannot exceed 120 characters" }),
  status: z.enum(["completed", "in-progress", "pending"], {
    required_error: "Please select a status",
  }),
  campaignId: z.string()
});

export type SubtaskFormValues = z.infer<typeof subtaskFormSchema>

interface AddSubtaskDialogProps {
  campaignId: string
  onAddSubtask: (values: SubtaskFormValues) => Promise<{ data?: any; error?: string }>
  trigger?: React.ReactNode
}

export function AddSubtaskDialog({ campaignId, onAddSubtask, trigger }: AddSubtaskDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  // Use React Hook Form with Zod schema validation
  const form = useForm<z.infer<typeof subtaskFormSchema>>({
    resolver: zodResolver(subtaskFormSchema),
    defaultValues: {
      title: "",
      status: "pending",
      campaignId: campaignId
    },
  })

  // Function to close dialog and reset form
  const handleClose = () => {
    if (!isLoading) {
      form.reset();
      setIsOpen(false);
    }
  }

  // Form submission handler
  const onSubmit = async (data: z.infer<typeof subtaskFormSchema>) => {
    setIsLoading(true);

    try {
      // Make sure campaignId is set
      data.campaignId = campaignId;

      const result = await onAddSubtask(data);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Task added successfully");
        handleClose();
      }
    } catch (error) {
      console.error("Error adding task:", error);
      toast.error("Failed to add task");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog 
      open={isOpen}
      modal={true}
      onOpenChange={(open) => {
        if (!isLoading) {
          setIsOpen(open)
          
          // Reset form when opening the dialog
          if (open) {
            form.reset({
              title: "",
              status: "pending",
              campaignId: campaignId
            });
          }
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Task
          </Button>
        )}
      </DialogTrigger>
      <DialogContent 
        className="sm:max-w-[500px]" 
        onEscapeKeyDown={(e) => {
          if (isLoading) e.preventDefault()
        }}
        onPointerDownOutside={(e) => {
          if (isLoading) e.preventDefault()
        }}
        onInteractOutside={(e) => {
          if (isLoading) e.preventDefault()
        }}
      >
        <form onSubmit={form.handleSubmit(onSubmit)} ref={formRef}>
          <DialogHeader>
            <DialogTitle>Add New Task</DialogTitle>
            <DialogDescription>
              Create a new task for this campaign.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid gap-2">
              <Label>Title</Label>
              <Input
                {...form.register("title")}
                placeholder="Enter task title"
                icon={<ClipboardList className="h-4 w-4 text-muted-foreground" />}
              />
              {form.formState.errors.title && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <XCircle className="h-4 w-4" />
                  {form.formState.errors.title.message}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                </div>
                <Select 
                  onValueChange={(value) => form.setValue("status", value as "completed" | "in-progress" | "pending")}
                  defaultValue={form.getValues("status")}
                >
                  <SelectTrigger className="h-12 pl-10">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.formState.errors.status && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <XCircle className="h-4 w-4" />
                  {form.formState.errors.status.message}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={isLoading}
              className="gap-1"
            >
              {isLoading ? (
                <>
                  <LoadingSkeleton variant="button" size="sm" />
                  <span>Adding...</span>
                </>
              ) : (
                <>
                  <PlusCircle className="mr-1 h-4 w-4" />
                  Add Task
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 