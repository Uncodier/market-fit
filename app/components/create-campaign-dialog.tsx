"use client"

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
import { PlusCircle } from "@/app/components/ui/icons"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { toast } from "sonner"
import { useAuth } from "@/app/hooks/use-auth"
import { useSite } from "@/app/context/SiteContext"
import { campaignFormSchema, type CampaignFormValues } from "../campaigns/schema"
import * as z from "zod"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useRouter } from "next/navigation"
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog"
import { useDirtyDialogClose } from "@/app/components/ui/use-dirty-dialog-close"
import { CreateCampaignFields } from "@/app/components/create-campaign-fields"
import type { DialogOptionsStatus } from './dialog-options-feedback'

interface CreateCampaignDialogProps {
  segments?: Array<{ id: string; name: string; description: string }>
  onCreateCampaign: (values: CampaignFormValues) => Promise<{ data?: { id: string } | null; error?: string | null }>
  trigger?: React.ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
  optionsStatus: DialogOptionsStatus
}

export function CreateCampaignDialog({
  segments = [],
  onCreateCampaign,
  trigger,
  open, onOpenChange, optionsStatus,
}: CreateCampaignDialogProps) {
  const { t } = useLocalization()
  const router = useRouter()
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
      createWithAi: false,
      budget: { allocated: 0, remaining: 0, currency: "USD" },
      revenue: { actual: 0, projected: 0, estimated: 0, currency: "USD" },
      site_id: currentSite?.id || "",
      user_id: user?.id || "",
    },
  })

  const { discardOpen, setDiscardOpen, handleOpenChange, confirmDiscard } =
    useDirtyDialogClose({
      dirty: form.formState.isDirty,
      busy: isLoading,
      onOpenChange: (open) => {
        if (!open) form.reset()
        onOpenChange(open)
      },
    })

  const selectedSegments = useWatch({ control: form.control, name: 'segments' }) ?? []
  const segmentsValid = selectedSegments.every(id => segments.some(s => s.id === id))

  const onSubmit = async (values: z.infer<typeof campaignFormSchema>) => {
    if (!optionsStatus.ready || isLoading || !segmentsValid) return
    if (!user || !currentSite) {
      toast.error("You must be logged in and have a site selected to create a campaign")
      return
    }

    try {
      setIsLoading(true)
      values.site_id = currentSite.id
      values.user_id = user.id
      const response = await onCreateCampaign(values)

      if (response.error) {
        toast.error(response.error)
        return
      }

      toast.success(values.createWithAi ? "Campaign and AI requirement created" : "Campaign created")
      const id = response.data?.id
      form.reset()
      onOpenChange(false)
      if (id) router.push(`/campaigns/${id}`)
    } catch (error) {
      toast.error("An error occurred while creating the campaign")
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Campaign
          </Button>
        )}
      </DialogTrigger>
      <DialogContent size="lg" busy={isLoading}>
        <DialogForm onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{t("campaigns.create.title") || "New campaign"}</DialogTitle>
            <DialogDescription>
              {t("campaigns.create.description") ||
                "Create a marketing campaign to organize your activities."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-6">
            {optionsStatus.ready && !segmentsValid && <div role="alert" className="space-y-2">
              <p>A selected segment is no longer available.</p>
              <Button type="button" variant="outline" onClick={() => form.setValue('segments',
                selectedSegments.filter(id => segments.some(s => s.id === id)), { shouldDirty: true })}>Clear unavailable segments</Button>
            </div>}
            <CreateCampaignFields
              form={form}
              segments={segments}
              optionsStatus={optionsStatus}
              t={t}
            />
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              {t("campaigns.create.cancel") || "Cancel"}
            </Button>
            <Button type="submit" disabled={isLoading || !optionsStatus.ready || !segmentsValid}>
              {isLoading
                ? t("campaigns.create.creating") || "Creating..."
                : t("campaigns.create.submit") || "Create campaign"}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Discard changes?"
        description="Your changes will be lost."
        confirmLabel="Discard"
        variant="destructive"
        onConfirm={confirmDiscard}
        dataPermission="allow"
      />
    </Dialog>
  )
}
