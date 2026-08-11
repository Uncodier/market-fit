"use client"

import { useRef, useState } from "react"
import { Button } from "@/app/components/ui/button"
import { useLocalization } from "@/app/context/LocalizationContext"
import { VisitSliderCard } from "./VisitSliderCard"
import { VisitPhotoCapture, type VisitPhotoCaptureHandle } from "./VisitPhotoCapture"

export function VisitIdStep({
  index,
  activeIndex,
  unlocked,
  isActive,
  idDataUrl,
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
  idDataUrl: string | null
  submitting: boolean
  nextIsComplete: boolean
  onActivate: () => void
  onBack: () => void
  onChange: (value: string | null) => void
  onContinue: () => void
}) {
  const { t } = useLocalization()
  const captureRef = useRef<VisitPhotoCaptureHandle>(null)
  const [cameraReady, setCameraReady] = useState(false)

  return (
    <VisitSliderCard
      index={index}
      activeIndex={activeIndex}
      unlocked={unlocked}
      isActive={isActive}
      title={t("visits.steps.id.title")}
      description={t("visits.steps.id.description")}
      onActivate={onActivate}
      showMobileBack
      onBack={onBack}
      footer={
        <Button
          className="w-full font-semibold shadow-sm"
          disabled={submitting || (!idDataUrl ? !cameraReady : false)}
          onClick={() => {
            if (!idDataUrl) {
              captureRef.current?.capture()
              return
            }
            onContinue()
          }}
        >
          {!idDataUrl
            ? t("visits.id.capture")
            : nextIsComplete
              ? submitting
                ? t("visits.actions.submitting")
                : t("visits.actions.complete")
              : t("visits.actions.continue")}
        </Button>
      }
    >
      <VisitPhotoCapture
        ref={captureRef}
        variant="id"
        value={idDataUrl}
        onChange={onChange}
        onReadyChange={setCameraReady}
      />
    </VisitSliderCard>
  )
}
