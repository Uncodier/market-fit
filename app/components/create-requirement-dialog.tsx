import { Button } from "@/app/components/ui/button"
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
  Users, 
  XCircle, 
  ClipboardList, 
  Tag,
  CheckCircle2,
  Archive,
  LayoutGrid
} from "@/app/components/ui/icons"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useState, useEffect, useRef } from "react"
import { Switch } from "@/app/components/ui/switch"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { Textarea } from "./ui/textarea"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useAuth } from "@/app/hooks/use-auth"
import { useSite } from "@/app/context/SiteContext"
import { Checkbox } from "@/app/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select"
import { requirementFormSchema } from "../requirements/schema"
import type { RequirementFormValues } from "../requirements/actions"
import * as z from "zod"

interface Segment {
  id: string
  name: string
  description: string
}

interface Campaign {
  id: string
  title: string
  description: string
}

interface CreateRequirementDialogProps {
  segments: Segment[]
  campaigns?: Campaign[]
  onCreateRequirement: (values: RequirementFormValues) => Promise<{ data?: any; error?: string }>
  trigger?: React.ReactNode
}

export function CreateRequirementDialog({ segments, campaigns = [], onCreateRequirement, trigger }: CreateRequirementDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedSegments, setSelectedSegments] = useState<string[]>([])
  const { user } = useAuth()
  const { currentSite } = useSite()
  const formRef = useRef<HTMLFormElement>(null)

  // Use React Hook Form with Zod schema validation
  const form = useForm<z.infer<typeof requirementFormSchema>>({
    resolver: zodResolver(requirementFormSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "task",
      priority: "medium",
      status: "backlog",
      completionStatus: "pending",
      source: "Campaign",
      segments: [],
      campaigns: [],
      budget: undefined,
      user_id: user?.id || "",
      site_id: currentSite?.id || "",
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
      setSelectedSegments([]);
      setIsOpen(false);
    }
  }

  // Form submission handler
  const onSubmit = async (data: z.infer<typeof requirementFormSchema>) => {
    if (!user?.id || !currentSite?.id) {
      toast.error("Missing user or site information");
      return;
    }

    // Make sure segments from local state are in the form data
    data.segments = selectedSegments;

    setIsLoading(true);

    try {
      // Update timestamps
      data.created_at = new Date().toISOString();
      data.updated_at = new Date().toISOString();
      
      // Ensure user_id and site_id are set
      data.user_id = user.id;
      data.site_id = currentSite.id;

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
          
          // When opening the dialog, initialize segments to empty array
          if (open) {
            const initialSegments: string[] = [];
            setSelectedSegments(initialSegments);
            form.setValue("segments", initialSegments);
          }
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Requirement
          </Button>
        )}
      </DialogTrigger>
      <DialogContent 
        className="sm:max-w-[600px]" 
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
            <DialogTitle>Create New Requirement</DialogTitle>
            <DialogDescription>
              Create a new product requirement aligned with specific segments.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid gap-2">
              <Label>Title</Label>
              <Input
                {...form.register("title")}
                placeholder="Enter requirement title"
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
              <Label>Type</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                </div>
                <Select 
                  onValueChange={(value) => form.setValue("type", value as "content" | "design" | "research" | "follow_up" | "task" | "develop" | "analytics" | "testing" | "approval" | "coordination" | "strategy" | "optimization" | "automation" | "integration" | "planning" | "payment")}
                  defaultValue={form.getValues("type") || "task"}
                >
                  <SelectTrigger className="h-12 pl-10">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="content">Content</SelectItem>
                    <SelectItem value="design">Design</SelectItem>
                    <SelectItem value="research">Research</SelectItem>
                    <SelectItem value="follow_up">Follow Up</SelectItem>
                    <SelectItem value="task">Task</SelectItem>
                    <SelectItem value="develop">Develop</SelectItem>
                    <SelectItem value="analytics">Analytics</SelectItem>
                    <SelectItem value="testing">Testing</SelectItem>
                    <SelectItem value="approval">Approval</SelectItem>
                    <SelectItem value="coordination">Coordination</SelectItem>
                    <SelectItem value="strategy">Strategy</SelectItem>
                    <SelectItem value="optimization">Optimization</SelectItem>
                    <SelectItem value="automation">Automation</SelectItem>
                    <SelectItem value="integration">Integration</SelectItem>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="payment">Payment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.formState.errors.type && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <XCircle className="h-4 w-4" />
                  {form.formState.errors.type.message}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <div className="relative">
                <div className="absolute top-[14px] left-3 flex items-center pointer-events-none">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Priority</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
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
              <div className="grid gap-2">
                <Label>Status</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <Select 
                    onValueChange={(value) => form.setValue("status", value as "validated" | "in-progress" | "backlog")}
                    defaultValue={form.getValues("status")}
                  >
                    <SelectTrigger className="h-12 pl-10">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="validated">Validated</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="backlog">Backlog</SelectItem>
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
            <div className="grid gap-2">
              <Label>Campaign</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                </div>
                <Select 
                  onValueChange={(value) => {
                    // Set as array with single value (campaigns is defined as string[] in the schema)
                    form.setValue("campaigns", value !== "none" ? [value] : [])
                    
                    // If a campaign is selected, update the source field with the campaign title
                    if (value && value !== "none") {
                      const selectedCampaign = campaigns.find(c => c.id === value);
                      if (selectedCampaign) {
                        form.setValue("source", selectedCampaign.title);
                      }
                    } else {
                      form.setValue("source", "Campaign");
                    }
                  }}
                  defaultValue="none"
                >
                  <SelectTrigger className="h-12 pl-10">
                    <SelectValue placeholder="Select campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {campaigns.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Budget</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    className="h-4 w-4 text-muted-foreground"
                  >
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/>
                    <path d="M12 18V6"/>
                  </svg>
                </div>
                <Input
                  {...form.register("budget")}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Enter budget amount"
                  className="pl-10"
                />
              </div>
              {form.formState.errors.budget && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <XCircle className="h-4 w-4" />
                  {form.formState.errors.budget.message}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Segments
              </Label>
              <div className="relative">
                <ScrollArea className="h-[200px] rounded-md border">
                  <div className="p-4">
                    {segments.length > 0 ? (
                      segments.map((segment) => {
                        const currentSegments = selectedSegments;
                        const isSelected = currentSegments.includes(segment.id);
                        
                        return (
                          <div 
                            key={segment.id} 
                            className={cn(
                              "flex items-center justify-between space-x-3 space-y-0 rounded-lg border p-4 mb-2 last:mb-0",
                              "transition-colors hover:bg-muted/50 cursor-pointer",
                              isSelected ? "border-primary/50 bg-primary/5" : ""
                            )}
                            onClick={() => {
                              // Toggle selection state on row click
                              const newValue = !isSelected;
                              const newSelectedSegments = newValue
                                ? [...selectedSegments, segment.id]
                                : selectedSegments.filter(id => id !== segment.id);
                              
                              // Update local state
                              setSelectedSegments(newSelectedSegments);
                              
                              // Also update form value
                              form.setValue("segments", newSelectedSegments);
                            }}
                          >
                            <div className="grid gap-1.5 leading-none">
                              <label
                                htmlFor={`segment-${segment.id}`}
                                className="text-sm font-medium leading-none cursor-pointer"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {segment.name}
                              </label>
                              <p className="text-sm text-muted-foreground">
                                {segment.description}
                              </p>
                            </div>
                            <div onClick={(e) => e.stopPropagation()}>
                              <Switch
                                id={`segment-${segment.id}`}
                                checked={isSelected}
                                onCheckedChange={(checked) => {
                                  // Calculate new selected segments
                                  const newSelectedSegments = checked
                                    ? [...selectedSegments, segment.id]
                                    : selectedSegments.filter(id => id !== segment.id);
                                  
                                  // Update local state
                                  setSelectedSegments(newSelectedSegments);
                                  
                                  // Also update form value
                                  form.setValue("segments", newSelectedSegments, {
                                    shouldDirty: true,
                                    shouldTouch: true,
                                    shouldValidate: true
                                  });
                                }}
                              />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-4 text-center">
                        <p className="text-sm text-muted-foreground">No segments available</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
              {form.formState.errors.segments && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <XCircle className="h-4 w-4" />
                  {form.formState.errors.segments.message}
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
              className="h-12"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="h-12">
              {isLoading ? "Creating..." : "Create Requirement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 