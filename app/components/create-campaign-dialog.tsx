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
import { useForm } from "react-hook-form"
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

interface CreateCampaignDialogProps {
  segments?: Array<{ id: string; name: string; description: string }>
  requirements?: Array<{ id: string; title: string; description: string }>
  onCreateCampaign: (values: CampaignFormValues) => Promise<{ data?: any; error?: string }>
  trigger?: React.ReactNode
}

export function CreateCampaignDialog({
  segments = [],
  requirements = [],
  onCreateCampaign,
  trigger,
}: CreateCampaignDialogProps) {
  const { t } = useLocalization()
  const router = useRouter()
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
        setIsOpen(open)
      },
    })

  const onSubmit = async (values: z.infer<typeof campaignFormSchema>) => {
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

      toast.success("Campaign created")
      const id = response.data?.id
      form.reset()
      setIsOpen(false)
      if (id) router.push(`/campaigns/${id}`)
    } catch (error) {
      toast.error("An error occurred while creating the campaign")
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
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
            <CreateCampaignFields
              form={form}
              segments={segments}
              requirements={requirements}
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
            <Button type="submit" disabled={isLoading}>
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
