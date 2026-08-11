"use client"

import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from "react"
import { Button } from "@/app/components/ui/button"
import { useLocalization } from "@/app/context/LocalizationContext"

export type VisitPhotoCaptureHandle = {
  capture: () => boolean
  isReady: () => boolean
}

export type VisitPhotoCaptureVariant = "face" | "id"

type Props = {
  disabled?: boolean
  value?: string | null
  onChange: (dataUrl: string | null) => void
  onReadyChange?: (ready: boolean) => void
  variant?: VisitPhotoCaptureVariant
}

function FaceGuideOverlay() {
  const maskId = useId().replace(/:/g, "")
  // Smaller, more centered guide so the face sits farther from the camera edges.
  const head = { cx: 100, cy: 64, rx: 24, ry: 30 }
  const shoulders =
    "M 62 128 C 62 102, 78 94, 100 94 C 122 94, 138 102, 138 128"

  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      <svg className="w-full h-full" viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice">
        <defs>
          <mask id={maskId}>
            <rect width="200" height="150" fill="white" />
            <ellipse cx={head.cx} cy={head.cy} rx={head.rx} ry={head.ry} fill="black" />
            <path d={`${shoulders} L 138 150 L 62 150 Z`} fill="black" />
          </mask>
        </defs>
        <rect width="200" height="150" fill="rgba(0,0,0,0.45)" mask={`url(#${maskId})`} />
        <ellipse
          cx={head.cx}
          cy={head.cy}
          rx={head.rx}
          ry={head.ry}
          fill="none"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="1.5"
          strokeDasharray="5 4"
        />
        <path
          d={shoulders}
          fill="none"
          stroke="rgba(255,255,255,0.7)"
          strokeWidth="1.5"
          strokeDasharray="5 4"
        />
      </svg>
    </div>
  )
}

function IdGuideOverlay() {
  const maskId = useId().replace(/:/g, "")
  const card = { x: 28, y: 34, w: 144, h: 82, rx: 6 }

  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      <svg className="w-full h-full" viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice">
        <defs>
          <mask id={maskId}>
            <rect width="200" height="150" fill="white" />
            <rect
              x={card.x}
              y={card.y}
              width={card.w}
              height={card.h}
              rx={card.rx}
              fill="black"
            />
          </mask>
        </defs>
        <rect width="200" height="150" fill="rgba(0,0,0,0.45)" mask={`url(#${maskId})`} />
        <rect
          x={card.x}
          y={card.y}
          width={card.w}
          height={card.h}
          rx={card.rx}
          fill="none"
          stroke="rgba(255,255,255,0.9)"
          strokeWidth="1.5"
          strokeDasharray="5 4"
        />
      </svg>
    </div>
  )
}

export const VisitPhotoCapture = forwardRef<VisitPhotoCaptureHandle, Props>(
  function VisitPhotoCapture({ disabled, value, onChange, onReadyChange, variant = "face" }, ref) {
    const { t } = useLocalization()
    const videoRef = useRef<HTMLVideoElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [ready, setReady] = useState(false)
    const isId = variant === "id"
    const mirror = !isId

    useEffect(() => {
      onReadyChange?.(ready && !value)
    }, [ready, value, onReadyChange])

    useEffect(() => {
      let cancelled = false

      async function start() {
        setError(null)
        setReady(false)
        try {
          if (!navigator?.mediaDevices?.getUserMedia) {
            setError(t("visits.photo.cameraUnsupported"))
            return
          }
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: isId ? { ideal: "environment" } : "user" },
            audio: false,
          })
          if (cancelled) {
            stream.getTracks().forEach((track) => track.stop())
            return
          }
          streamRef.current = stream
          if (videoRef.current) {
            videoRef.current.srcObject = stream
            await videoRef.current.play()
            setReady(true)
          }
        } catch {
          setError(t("visits.photo.cameraDenied"))
        }
      }

      if (!value) start()

      return () => {
        cancelled = true
        streamRef.current?.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
    }, [value, t, isId])

    const capture = () => {
      const video = videoRef.current
      if (!video || !ready || value) return false
      const canvas = document.createElement("canvas")
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480
      const ctx = canvas.getContext("2d")
      if (!ctx) return false
      if (mirror) {
        // Mirror to match the on-screen selfie preview.
        ctx.translate(canvas.width, 0)
        ctx.scale(-1, 1)
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85)
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setReady(false)
      onChange(dataUrl)
      return true
    }

    useImperativeHandle(ref, () => ({
      capture,
      isReady: () => ready && !value && !error,
    }))

    const alt = isId ? t("visits.id.alt") : t("visits.photo.alt")
    const retakeLabel = isId ? t("visits.id.retake") : t("visits.photo.retake")
    const hint = isId ? t("visits.id.centerHint") : t("visits.photo.centerHint")

    if (value) {
      return (
        <div className="space-y-3">
          <div className="rounded-lg border overflow-hidden bg-muted aspect-video relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt={alt} className="w-full h-full object-cover" />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => onChange(null)} disabled={disabled}>
            {retakeLabel}
          </Button>
        </div>
      )
    }

    return (
      <div className="space-y-3">
        <div className="rounded-lg border overflow-hidden bg-black aspect-video relative">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full h-full object-cover${mirror ? " scale-x-[-1]" : ""}`}
          />
          {isId ? <IdGuideOverlay /> : <FaceGuideOverlay />}
          <p className="absolute bottom-2 left-0 right-0 text-center text-[11px] text-white/85 px-3">
            {hint}
          </p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    )
  }
)
