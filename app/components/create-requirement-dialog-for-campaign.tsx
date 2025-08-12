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
  FileText, 
  XCircle, 
  ClipboardList, 
  Tag,
  CheckCircle2,
} from "@/app/components/ui/icons"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useState, useEffect, useRef } from "react"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { Textarea } from "./ui/textarea"
import { toast } from "sonner"
import { useAuth } from "@/app/hooks/use-auth"
import { useSite } from "@/app/context/SiteContext"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select"
import * as z from "zod"

// Modified schema just for this specific use case
const campaignRequirementFormSchema = z.object({
  title: z.string()
    .min(3, { message: "Title must have at least 3 characters" })
    .max(120, { message: "Title cannot exceed 120 characters" }),
  description: z.string()
    .min(10, { message: "Description must have at least 10 characters" })
    .max(500, { message: "Description cannot exceed 500 characters" }),
  priority: z.enum(["high", "medium", "low"], {
    required_error: "Please select a priority",
  }),
  status: z.enum(["validated", "in-progress", "on-review", "done", "backlog", "canceled"], {
    required_error: "Please select a status",
  }),
  completionStatus: z.enum(["pending", "completed", "rejected"], {
    required_error: "Please select a completion status",
  }),
  budget: z.coerce.number()
    .min(0, { message: "Budget cannot be negative" })
    .optional()
    .nullable(),
  user_id: z.string(),
  site_id: z.string(),
  campaign_id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type CampaignRequirementFormValues = z.infer<typeof campaignRequirementFormSchema>

interface CampaignRequirementDialogProps {
  campaignId: string
  onCreateRequirement: (values: CampaignRequirementFormValues) => Promise<{ data?: any; error?: string }>
  trigger?: React.ReactNode
}

export function CampaignRequirementDialog({ 
  campaignId, 
  onCreateRequirement, 
  trigger 
}: CampaignRequirementDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { user } = useAuth()
  const { currentSite } = useSite()
  const formRef = useRef<HTMLFormElement>(null)

  // Use React Hook Form with Zod schema validation
  const form = useForm<z.infer<typeof campaignRequirementFormSchema>>({
    resolver: zodResolver(campaignRequirementFormSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      status: "backlog",
      completionStatus: "pending",
      budget: undefined,
      user_id: user?.id || "",
      site_id: currentSite?.id || "",
      campaign_id: campaignId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  })

  // Update form when user or site changes
  useEffect(() => {
    if (user?.id && currentSite?.id) {
      form.setValue("user_id", user.id)
      form.setValue("site_id", currentSite.id)
    }
  }, [user, currentSite, form])

  // Function to close dialog and reset form
  const handleClose = () => {
    if (!isLoading) {
      form.reset();
      setIsOpen(false);
    }
  }

  // Form submission handler
  const onSubmit = async (data: z.infer<typeof campaignRequirementFormSchema>) => {
    if (!user?.id || !currentSite?.id) {
      toast.error("Missing user or site information");
      return;
    }

    setIsLoading(true);

    try {
      // Update timestamps
      data.created_at = new Date().toISOString();
      data.updated_at = new Date().toISOString();
      
      // Ensure required fields are set
      data.user_id = user.id;
      data.site_id = currentSite.id;
      data.campaign_id = campaignId;

      const result = await onCreateRequirement(data);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Requirement created successfully");
        handleClose();
      }
    } catch (error) {
      console.error("Error creating requirement:", error);
      toast.error("Failed to create requirement");
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
          if (open) {
            form.reset({
              title: "",
              description: "",
              priority: "medium",
              status: "backlog",
              completionStatus: "pending",
              budget: undefined,
              user_id: user?.id || "",
              site_id: currentSite?.id || "",
              campaign_id: campaignId,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Requirement
          </Button>
        )}
      </DialogTrigger>
      <DialogContent 
        className="sm:max-w-[600px] p-6 md:p-8" 
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
          <DialogHeader className="mb-2">
            <DialogTitle>Add New Requirement</DialogTitle>
            <DialogDescription>
              Create a new requirement for this campaign
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] px-2 py-1 overflow-visible">
            <div className="grid gap-6 py-4 px-1">
              <div className="grid gap-3">
                <Label>Title</Label>
                <div className="p-[3px]">
                  <Input
                    {...form.register("title")}
                    placeholder="Enter requirement title"
                    icon={<ClipboardList className="h-4 w-4 text-muted-foreground" />}
                  />
                </div>
                {form.formState.errors.title && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <XCircle className="h-4 w-4" />
                    {form.formState.errors.title.message}
                  </p>
                )}
              </div>
              <div className="grid gap-3">
                <Label>Description</Label>
                <div className="relative p-[3px]">
                  <div className="absolute top-[14px] left-3 flex items-center pointer-events-none z-10">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <Textarea
                    {...form.register("description")}
                    placeholder="Describe your requirement"
                    className="min-h-[100px] pl-10"
                  />
                </div>
                {form.formState.errors.description && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <XCircle className="h-4 w-4" />
                    {form.formState.errors.description.message}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="grid gap-3">
                  <Label>Priority</Label>
                  <div className="relative p-[3px]">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none z-10">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <Select 
                      onValueChange={(value) => form.setValue("priority", value as "high" | "medium" | "low")}
                      defaultValue={form.getValues("priority")}
                    >
                      <SelectTrigger className="h-12 pl-10">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.formState.errors.priority && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <XCircle className="h-4 w-4" />
                      {form.formState.errors.priority.message}
                    </p>
                  )}
                </div>
                <div className="grid gap-3">
                  <Label>Status</Label>
                  <div className="relative p-[3px]">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none z-10">
                      <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <Select 
                      onValueChange={(value) => form.setValue("status", value as any)}
                      defaultValue={form.getValues("status")}
                    >
                      <SelectTrigger className="h-12 pl-10">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="backlog">Backlog</SelectItem>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="on-review">On Review</SelectItem>
                        <SelectItem value="done">Done</SelectItem>
                        <SelectItem value="validated">Validated</SelectItem>
                        <SelectItem value="canceled">Canceled</SelectItem>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="grid gap-3">
                  <Label>Completion Status</Label>
                  <div className="relative p-[3px]">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none z-10">
                      <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <Select 
                      onValueChange={(value) => form.setValue("completionStatus", value as "pending" | "completed" | "rejected")}
                      defaultValue={form.getValues("completionStatus")}
                    >
                      <SelectTrigger className="h-12 pl-10">
                        <SelectValue placeholder="Select completion status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.formState.errors.completionStatus && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <XCircle className="h-4 w-4" />
                      {form.formState.errors.completionStatus.message}
                    </p>
                  )}
                </div>
                <div className="grid gap-3">
                  <Label>Budget (Optional)</Label>
                  <div className="p-[3px]">
                    <Input
                      type="number"
                      {...form.register("budget", { valueAsNumber: true })}
                      placeholder="Enter budget amount"
                    />
                  </div>
                  {form.formState.errors.budget && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <XCircle className="h-4 w-4" />
                      {form.formState.errors.budget.message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="pt-4 mt-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose}
              disabled={isLoading}
              className="mr-2"
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
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <PlusCircle className="mr-1 h-4 w-4" />
                  Create Requirement
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 