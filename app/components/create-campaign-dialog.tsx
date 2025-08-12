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
  Ban,
  CheckCircle2,
  Clock,
  CalendarIcon,
  Tag,
  BarChart,
  ShoppingCart
} from "@/app/components/ui/icons"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
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
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { Switch } from "@/app/components/ui/switch"
import { cn } from "@/lib/utils"
import { campaignFormSchema, type CampaignFormValues } from "../campaigns/schema"
import * as z from "zod"

interface Segment {
  id: string
  name: string
  description: string
}

interface Requirement {
  id: string
  title: string
  description: string
}

interface CreateCampaignDialogProps {
  segments: Segment[]
  requirements: Requirement[]
  onCreateCampaign: (values: CampaignFormValues) => Promise<{ data?: any; error?: string }>
  trigger?: React.ReactNode
}

const CAMPAIGN_TYPES = [
  { value: "inbound", label: "Inbound Marketing" },
  { value: "outbound", label: "Outbound Marketing" },
  { value: "branding", label: "Branding" },
  { value: "product", label: "Product Marketing" },
  { value: "events", label: "Events" },
  { value: "success", label: "Customer Success" },
  { value: "account", label: "Account-Based Marketing" },
  { value: "community", label: "Community Marketing" },
  { value: "guerrilla", label: "Guerrilla Marketing" },
  { value: "affiliate", label: "Affiliate Marketing" },
  { value: "experiential", label: "Experiential Marketing" },
  { value: "programmatic", label: "Programmatic Advertising" },
  { value: "performance", label: "Performance Marketing" },
  { value: "publicRelations", label: "Public Relations" }
]

export function CreateCampaignDialog({ 
  segments, 
  requirements, 
  onCreateCampaign,
  trigger 
}: CreateCampaignDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { user } = useAuth()
  const { currentSite } = useSite()

  const form = useForm<z.infer<typeof campaignFormSchema>>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      type: "inbound",
      segments: [],
      requirements: [],
      budget: {
        allocated: 0,
        remaining: 0,
        currency: "USD"
      },
      revenue: {
        actual: 0,
        projected: 0,
        estimated: 0,
        currency: "USD"
      },
      site_id: currentSite?.id || "",
      user_id: user?.id || ""
    }
  })

  const handleClose = () => {
    if (!isLoading) {
      form.reset()
      setIsOpen(false)
    }
  }

  const onSubmit = async (values: z.infer<typeof campaignFormSchema>) => {
    if (!user || !currentSite) {
      toast.error("You must be logged in and have a site selected to create a campaign")
      return
    }

    try {
      setIsLoading(true)
      
      // Add site_id and user_id to values
      values.site_id = currentSite.id
      values.user_id = user.id

      const response = await onCreateCampaign(values)

      if (response.error) {
        toast.error(response.error)
        return
      }

      toast.success("Campaign created successfully")
      handleClose()
    } catch (error) {
      toast.error("An error occurred while creating the campaign")
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog 
      open={isOpen}
      modal={true}
      onOpenChange={(open) => {
        if (!isLoading) {
          setIsOpen(open)
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Campaign
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
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Create New Campaign</DialogTitle>
            <DialogDescription>
              Create a new marketing campaign to organize your marketing activities.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <Input
                  id="title"
                  placeholder="Campaign title"
                  className="h-12 pl-10"
                  {...form.register("title")}
                />
              </div>
              {form.formState.errors.title && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <Ban className="h-4 w-4" />
                  {form.formState.errors.title.message}
                </p>
              )}
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <div className="relative">
                <div className="absolute left-3 top-3 flex items-center pointer-events-none">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <Textarea
                  id="description"
                  placeholder="Describe the campaign objectives and goals"
                  className="min-h-[100px] pl-10 pt-2"
                  {...form.register("description")}
                />
              </div>
              {form.formState.errors.description && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <Ban className="h-4 w-4" />
                  {form.formState.errors.description.message}
                </p>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="type">Campaign Type</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <Select 
                    onValueChange={(value) => form.setValue("type", value)}
                    defaultValue={form.getValues("type")}
                  >
                    <SelectTrigger id="type" className="h-12 pl-10">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {CAMPAIGN_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {form.formState.errors.type && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <Ban className="h-4 w-4" />
                    {form.formState.errors.type.message}
                  </p>
                )}
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="priority">Priority</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <BarChart className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <Select 
                    onValueChange={(value) => form.setValue("priority", value as "high" | "medium" | "low")}
                    defaultValue={form.getValues("priority")}
                  >
                    <SelectTrigger id="priority" className="h-12 pl-10">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High Priority</SelectItem>
                      <SelectItem value="medium">Medium Priority</SelectItem>
                      <SelectItem value="low">Low Priority</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.formState.errors.priority && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <Ban className="h-4 w-4" />
                    {form.formState.errors.priority.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <Input
                    id="dueDate"
                    type="date"
                    className="h-12 pl-10"
                    {...form.register("dueDate")}
                  />
                </div>
                {form.formState.errors.dueDate && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <Ban className="h-4 w-4" />
                    {form.formState.errors.dueDate.message}
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="budget">Budget</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <Input
                    id="budget"
                    type="number"
                    placeholder="Budget amount"
                    className="h-12 pl-10"
                    onChange={(e) => {
                      const value = parseFloat(e.target.value)
                      if (!isNaN(value)) {
                        form.setValue("budget.allocated", value)
                        form.setValue("budget.remaining", value)
                      }
                    }}
                  />
                </div>
                {form.formState.errors.budget?.allocated && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <Ban className="h-4 w-4" />
                    {form.formState.errors.budget.allocated.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Target Segments</Label>
              <ScrollArea className="h-[150px] rounded-md border">
                <div className="p-4">
                  {segments.length > 0 ? (
                    segments.map((segment) => {
                      // Check if segment is already selected
                      const currentSegments = form.getValues("segments") || [];
                      const isSelected = currentSegments.includes(segment.id);
                      
                      return (
                        <div 
                          key={segment.id} 
                          className={cn(
                            "flex items-center justify-between space-x-3 space-y-0 rounded-lg border p-4 mb-2 last:mb-0",
                            "transition-colors hover:bg-muted/50",
                            isSelected ? "border-primary/50 bg-primary/5" : ""
                          )}
                        >
                          <div className="grid gap-1.5 leading-none">
                            <label
                              htmlFor={`segment-${segment.id}`}
                              className="text-sm font-medium leading-none cursor-pointer"
                            >
                              {segment.name}
                            </label>
                            <p className="text-sm text-muted-foreground">
                              {segment.description}
                            </p>
                          </div>
                          <Switch
                            id={`segment-${segment.id}`}
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              const currentSegments = form.getValues("segments") || []
                              if (checked) {
                                form.setValue("segments", [...currentSegments, segment.id])
                              } else {
                                form.setValue(
                                  "segments",
                                  currentSegments.filter((id: string) => id !== segment.id)
                                )
                              }
                            }}
                          />
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

            <div className="grid gap-2">
              <Label>Related Requirements</Label>
              <ScrollArea className="h-[150px] rounded-md border">
                <div className="p-4">
                  {requirements.length > 0 ? (
                    requirements.map((requirement) => {
                      // Check if requirement is already selected
                      const currentRequirements = form.getValues("requirements") || [];
                      const isSelected = currentRequirements.includes(requirement.id);
                      
                      return (
                        <div 
                          key={requirement.id} 
                          className={cn(
                            "flex items-center justify-between space-x-3 space-y-0 rounded-lg border p-4 mb-2 last:mb-0",
                            "transition-colors hover:bg-muted/50",
                            isSelected ? "border-primary/50 bg-primary/5" : ""
                          )}
                        >
                          <div className="grid gap-1.5 leading-none">
                            <label
                              htmlFor={`requirement-${requirement.id}`}
                              className="text-sm font-medium leading-none cursor-pointer"
                            >
                              {requirement.title}
                            </label>
                            <p className="text-sm text-muted-foreground">
                              {requirement.description}
                            </p>
                          </div>
                          <Switch
                            id={`requirement-${requirement.id}`}
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              const currentRequirements = form.getValues("requirements") || []
                              if (checked) {
                                form.setValue("requirements", [...currentRequirements, requirement.id])
                              } else {
                                form.setValue(
                                  "requirements",
                                  currentRequirements.filter((id: string) => id !== requirement.id)
                                )
                              }
                            }}
                          />
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center">
                      <p className="text-sm text-muted-foreground">No requirements available</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
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
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-pulse bg-muted rounded" />
                  <span>Creating</span>
                </div>
              ) : "Create Campaign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 