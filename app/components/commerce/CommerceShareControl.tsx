"use client"

import React, { useState, useEffect, useRef } from "react"
import { Share, Copy, Download } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/app/components/ui/dialog"
import { useLocalization } from "@/app/context/LocalizationContext"
import QRCode from "react-qr-code"
import { toast } from "sonner"
import { shellClasses } from "./CommerceShellHeader"
import { copyToClipboard } from "@/app/utils/clipboard"

interface CommerceShareControlProps {
  url?: string
  title?: string
  className?: string
  iconClassName?: string
}

export function CommerceShareControl({ 
  url, 
  title = "Check this out", 
  className,
  iconClassName 
}: CommerceShareControlProps) {
  const { t } = useLocalization()
  const [open, setOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState("")
  const [canNativeShare, setCanNativeShare] = useState(false)
  const qrRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    if (url) {
      setShareUrl(url)
    } else if (typeof window !== "undefined") {
      setShareUrl(window.location.href)
    }
    
    // Evaluate native share support only on the client
    setCanNativeShare(typeof navigator !== "undefined" && !!navigator.share)
  }, [url])

  const handleCopyLink = async () => {
    try {
      const success = await copyToClipboard(shareUrl)
      if (success) {
        toast.success(t("commerce.share.copySuccess") || "Link copied to clipboard")
        setOpen(false)
      } else {
        throw new Error("Clipboard API failed")
      }
    } catch (err) {
      console.error("Failed to copy", err)
      toast.error(t("commerce.share.copyError") || "Failed to copy link")
    }
  }

  const handleNativeShare = async () => {
    try {
      if (canNativeShare) {
        await navigator.share({
          title,
          url: shareUrl
        })
        setOpen(false)
      }
    } catch (err) {
      // User cancelled or it failed
      console.log("Share failed or cancelled", err)
    }
  }

  const handleShareQR = async () => {
    const svg = qrRef.current?.querySelector("svg")
    if (!svg) return
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    const img = new window.Image()
    const xml = new XMLSerializer().serializeToString(svg)
    const svg64 = btoa(unescape(encodeURIComponent(xml)))
    const image64 = "data:image/svg+xml;base64," + svg64

    img.onload = async () => {
      canvas.width = img.width + 40
      canvas.height = img.height + 40
      if (ctx) {
        ctx.fillStyle = "white"
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 20, 20)
      }
      
      canvas.toBlob(async (blob) => {
        if (!blob) return
        if (canNativeShare && typeof navigator.canShare === 'function') {
          const file = new File([blob], "qr-code.png", { type: "image/png" })
          if (navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({
                files: [file],
                title: t("commerce.share.qrCode") || "QR Code",
                text: title || "Check this out"
              })
              setOpen(false)
              return
            } catch (err) {
              console.log("Share cancelled or failed", err)
            }
          }
        }
        // Fallback to download
        const downloadUrl = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = downloadUrl
        a.download = "qr-code.png"
        a.click()
        URL.revokeObjectURL(downloadUrl)
      }, "image/png")
    }
    img.src = image64
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button 
          className={className || `${shellClasses.iconButton} hover:bg-black/5 dark:hover:bg-white/5 !min-w-0 h-9 px-3 gap-1.5`}
          aria-label={t("commerce.share.trigger") || "Share"}
        >
          <Share className={iconClassName || "w-4 h-4"} />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">{t("commerce.share.title") || "Share this page"}</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center justify-center space-y-6 py-4">
          {/* QR Code */}
          {shareUrl && (
            <div ref={qrRef} className="bg-white p-4 rounded-xl shadow-sm border">
              <QRCode
                value={shareUrl}
                size={180}
                level="M"
                className="mx-auto"
              />
            </div>
          )}
          <p className="text-sm text-muted-foreground text-center">
            {t("commerce.share.qrHelper") || "Scan this QR code to open on another device"}
          </p>

          <div className="flex flex-col w-full gap-3 mt-4">
            <Button onClick={handleShareQR} variant="outline" className="w-full">
              <Download className="w-4 h-4 mr-2" />
              {t("commerce.share.downloadQr") || "Share / Download QR"}
            </Button>
            {canNativeShare && (
              <Button onClick={handleNativeShare} className="w-full">
                <Share className="w-4 h-4 mr-2" />
                {t("commerce.share.nativeShare") || "Share via..."}
              </Button>
            )}
            <Button onClick={handleCopyLink} variant={canNativeShare ? "outline" : "default"} className="w-full">
              <Copy className="w-4 h-4 mr-2" />
              {t("commerce.share.copyLink") || "Copy Link"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
