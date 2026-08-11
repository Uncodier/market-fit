"use client"

import { useRef, useState } from "react"
import { Button } from "@/app/components/ui/button"
import { useLocalization } from "@/app/context/LocalizationContext"
import { VisitSliderCard } from "./VisitSliderCard"
import { VisitPhotoCapture, type VisitPhotoCaptureHandle } from "./VisitPhotoCapture"

export function VisitPhotoStep({
  index,
  activeIndex,
  unlocked,
  isActive,
  photoDataUrl,
  submitting,
  nextIsComplete,
  onActivate,
  onBack,
  onChange,
  onContinue,
}: {
  index: number
  activeIndex: number
  unlocked: boolean
  isActive: boolean
  photoDataUrl: string | null
  submitting: boolean
  nextIsComplete: boolean
  onActivate: () => void
  onBack: () => void
  onChange: (value: string | null) => void
  onContinue: () => void
}) {
  const { t } = useLocalization()
  const photoCaptureRef = useRef<VisitPhotoCaptureHandle>(null)
  const [cameraReady, setCameraReady] = useState(false)

  return (
    <VisitSliderCard
      index={index}
      activeIndex={activeIndex}
      unlocked={unlocked}
      isActive={isActive}
      title={t("visits.steps.photo.title")}
      description={t("visits.steps.photo.description")}
      onActivate={onActivate}
      showMobileBack
      onBack={onBack}
      footer={
        <Button
          className="w-full font-semibold shadow-sm"
          disabled={submitting || (!photoDataUrl ? !cameraReady : false)}
          onClick={() => {
            if (!photoDataUrl) {
              photoCaptureRef.current?.capture()
              return
            }
            onContinue()
          }}
        >
          {!photoDataUrl
            ? t("visits.photo.take")
            : nextIsComplete
              ? submitting
                ? t("visits.actions.submitting")
                : t("visits.actions.complete")
              : t("visits.actions.continue")}
        </Button>
      }
    >
      <VisitPhotoCapture
        ref={photoCaptureRef}
        value={photoDataUrl}
        onChange={onChange}
        onReadyChange={setCameraReady}
      />
    </VisitSliderCard>
  )
}
