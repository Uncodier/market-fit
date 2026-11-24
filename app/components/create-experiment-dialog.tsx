import React from "react"
import { Button } from "@/app/components/ui/button"
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
} from "@/app/components/ui/dialog"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { PlusCircle, FlaskConical, FileText, Users, XCircle, Tag } from "@/app/components/ui/icons"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useState, useEffect } from "react"
import { Switch } from "@/app/components/ui/switch"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { Textarea } from "./ui/textarea"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useAuth } from "@/app/hooks/use-auth"
import { useSite } from "@/app/context/SiteContext"
import { type ExperimentFormValues } from "@/app/experiments/actions"
import { experimentFormSchema } from "@/app/experiments/schema"
import { DialogOptionsFeedback, type DialogOptionsStatus } from './dialog-options-feedback'
import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { resolveRelationId } from "@/app/commerce/resolve-relation"

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

interface CreateExperimentDialogProps {
  segments: Segment[]
  campaigns?: Campaign[]
  onCreateExperiment: (values: ExperimentFormValues) => Promise<{ data?: unknown; error?: string }>
  trigger?: React.ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
  optionsStatus: DialogOptionsStatus
}

export function CreateExperimentDialog({ segments, campaigns = [], onCreateExperiment, trigger,
  open, onOpenChange, optionsStatus }: CreateExperimentDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [campaignValue, setCampaignValue] = useState<RelationSelectValue>(null)
  
  const { user } = useAuth()
  const { currentSite } = useSite()

  const form = useForm<ExperimentFormValues>({
    resolver: zodResolver(experimentFormSchema),
    defaultValues: {
      name: "",
      description: "",
      hypothesis: "",
      segments: [],
      campaign_id: null,
      status: "draft",
      start_date: null,
      end_date: null,
      conversion: null,
      roi: null,
      preview_url: null,
      user_id: "",
      site_id: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  })
  const selectedSegments = useWatch({ control: form.control, name: 'segments' })
  const relationsValid = selectedSegments.every(id => segments.some(s => s.id === id)) &&
    (campaignValue?.mode !== 'existing' || campaigns.some(c => c.id === campaignValue.id))
  const canSubmit = optionsStatus.ready && !isLoading && relationsValid && selectedSegments.length > 0

  useEffect(() => {
    if (user?.id) {
      form.setValue("user_id", user.id)
    }
    if (currentSite?.id) {
      form.setValue("site_id", currentSite.id)
      form.setValue("preview_url", currentSite.url || null)
    }
  }, [user?.id, currentSite?.id, currentSite?.url, form])

  const handleClose = () => {
    if (isLoading) return
    onOpenChange(false)
  }

  const onSubmit = async (values: ExperimentFormValues) => {
    if (!canSubmit) return

    try {
      // Validar que exista un usuario y sitio seleccionado
      if (!user?.id) {
        toast.error("You must be logged in to create an experiment")
        return
      }

      if (!currentSite?.id) {
        toast.error("You must select a site to create an experiment")
        return
      }

      setIsLoading(true)

      // Actualizar los timestamps y datos del sitio
      values.created_at = new Date().toISOString()
      values.updated_at = new Date().toISOString()
      values.user_id = user.id
      values.site_id = currentSite.id
      values.preview_url = currentSite.url || values.preview_url

      let resolvedCampaignId = null;
      if (campaignValue) {
        const { id, error } = await resolveRelationId("campaign", campaignValue, currentSite.id);
        if (error) throw new Error(error);
        resolvedCampaignId = id;
      }
      
      values.campaign_id = resolvedCampaignId;

      const { error } = await onCreateExperiment(values)

      if (error) {
        toast.error(error)
        return
      }

      toast.success("Experiment created successfully")
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error creating experiment")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog 
      open={open}
      modal={true}
      onOpenChange={(open) => {
        if (!isLoading) {
          onOpenChange(open)
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger || (
          <Button className="rounded-full">
            <PlusCircle className="mr-2 h-4 w-4" />
            New Experiment
          </Button>
        )}
      </DialogTrigger>
      <DialogContent size="lg" busy={isLoading}>
        <DialogForm onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Create New Experiment</DialogTitle>
            <DialogDescription>
              Create a new experiment to test your hypotheses with specific segments.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-6">
            <div className="grid gap-2">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-muted-foreground" />
                <Label>Name</Label>
              </div>
              <Input
                {...form.register("name")}
                placeholder="Enter experiment name"
                className="h-12"
              />
              {form.formState.errors.name && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <XCircle className="h-4 w-4" />
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <Label>Description</Label>
              </div>
              <Textarea
                {...form.register("description")}
                placeholder="Describe your experiment"
                className="min-h-[100px]"
              />
              {form.formState.errors.description && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <XCircle className="h-4 w-4" />
                  {form.formState.errors.description.message}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <Label>Hypothesis</Label>
              </div>
              <Textarea
                {...form.register("hypothesis")}
                placeholder="What is your hypothesis?"
                className="min-h-[100px]"
              />
              {form.formState.errors.hypothesis && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <XCircle className="h-4 w-4" />
                  {form.formState.errors.hypothesis.message}
                </p>
              )}
            </div>
            
            {!optionsStatus.ready ? <DialogOptionsFeedback status={optionsStatus} /> : <>
            {!relationsValid && <div role="alert" className="space-y-2">
              <p>A selected option is no longer available.</p>
              <Button type="button" variant="outline" onClick={() => {
                form.setValue('segments', selectedSegments.filter(id => segments.some(s => s.id === id)))
                if (campaignValue?.mode === 'existing' && !campaigns.some(c => c.id === campaignValue.id)) setCampaignValue(null)
              }}>Clear unavailable options</Button>
            </div>}
            <div className="grid gap-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <Label>Target Segments</Label>
              </div>
              <ScrollArea className="h-[200px] rounded-md border">
                <div className="p-4">
                  {segments.length === 0 ? (
                    <div className="flex items-center justify-center h-24">
                      <p className="text-sm text-muted-foreground">No segments available. Please create segments first.</p>
                    </div>
                  ) : (
                    segments.map((segment) => (
                      <div 
                        key={segment.id} 
                        className={cn(
                          "flex items-center justify-between space-x-3 space-y-0 rounded-lg border p-4 mb-2 last:mb-0",
                          "transition-colors hover:bg-muted/50"
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
                          checked={selectedSegments.includes(segment.id)}
                          onCheckedChange={(checked) => {
                            const currentSegments = form.getValues("segments")
                            if (checked) {
                              form.setValue("segments", [...currentSegments, segment.id])
                            } else {
                              form.setValue(
                                "segments",
                                currentSegments.filter((id) => id !== segment.id)
                              )
                            }
                          }}
                        />
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
              {form.formState.errors.segments && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <XCircle className="h-4 w-4" />
                  {form.formState.errors.segments.message}
                </p>
              )}
            </div>

            {/* Campaign Selector */}
            <div className="grid gap-2">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <Label>Associated Campaign</Label>
              </div>
              <RelationSelect
                options={campaigns.map((c) => ({ id: c.id, label: c.title }))}
                value={campaignValue}
                onValueChange={setCampaignValue}
                placeholder="Select a campaign (optional)"
                emptyMessage="No campaigns found"
                className="h-12"
              />
              <p className="text-xs text-muted-foreground">
                Link this experiment to a marketing campaign to track performance
              </p>
            </div>
            </>}
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isLoading ? "Creating..." : "Create Experiment"}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  )
} 