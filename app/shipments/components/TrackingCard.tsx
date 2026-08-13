"use client"

import { useState } from "react"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { updateShipmentTracking, generateTrackingNumber } from "@/app/shipments/actions"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardDescription,
  SectionCardContent,
  SectionCardFooter,
} from "@/app/components/ui/section-card"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { Send, Save } from "@/app/components/ui/icons"
import { toast } from "sonner"

interface TrackingCardProps {
  shipmentId: string
  initialCarrier: string
  initialTracking: string
  onUpdate: (carrier: string, tracking: string) => void
}

export function TrackingCard({ shipmentId, initialCarrier, initialTracking, onUpdate }: TrackingCardProps) {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  
  const [carrier, setCarrier] = useState(initialCarrier)
  const [tracking, setTracking] = useState(initialTracking)
  const [savingTracking, setSavingTracking] = useState(false)

  const handleSaveTracking = async () => {
    if (!currentSite) return
    setSavingTracking(true)
    const { data, error } = await updateShipmentTracking(currentSite.id, shipmentId, {
      carrier,
      tracking_number: tracking
    })
    
    if (error) {
      toast.error(error)
    } else if (data) {
      toast.success(t('shipments.trackingUpdated') || "Tracking updated")
      onUpdate(data.carrier || "", data.tracking_number || "")
    }
    setSavingTracking(false)
  }

  const handleGenerate = async () => {
    if (!currentSite) return
    const num = await generateTrackingNumber(currentSite.id)
    setTracking(num)
  }

  return (
    <SectionCard>
      <SectionCardHeader>
        <SectionCardTitle className="flex items-center gap-2"><Send className="h-5 w-5 text-muted-foreground"/> {t('shipments.trackingInfo') || 'Tracking Info'}</SectionCardTitle>
      </SectionCardHeader>
      <SectionCardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t('shipments.carrier') || 'Carrier'}</Label>
            <Input value={carrier} onChange={e => setCarrier(e.target.value)} placeholder="e.g. UPS, FedEx" />
          </div>
          <div className="space-y-2">
            <Label>{t('shipments.trackingNumber') || 'Tracking Number'}</Label>
            <div className="flex gap-2">
              <Input value={tracking} onChange={e => setTracking(e.target.value)} placeholder="Tracking code" />
              <Button type="button" variant="outline" onClick={handleGenerate}>
                {t('shipments.generate') || 'Generate'}
              </Button>
            </div>
          </div>
        </div>
      </SectionCardContent>
      <ActionFooter>
        <Button variant="outline" onClick={handleSaveTracking} disabled={savingTracking || (carrier === initialCarrier && tracking === initialTracking)} size="sm">
          <Save className="h-4 w-4 mr-2" /> {t('common.save') || 'Save Tracking'}
        </Button>
      </ActionFooter>
    </SectionCard>
  )
}
