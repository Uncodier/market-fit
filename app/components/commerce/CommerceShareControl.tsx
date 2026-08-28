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
          className={className || shellClasses.iconButton}
          aria-label={t("commerce.share.trigger") || "Share"}
        >
          <Share className={iconClassName || "w-4 h-4"} />
        </button>
      </DialogTrigger>
      <DialogContent size="sm" flush>
        <DialogHeader className="border-b-0 pb-0 pt-6 px-6 sm:pr-6 text-center">
          <DialogTitle className="text-center text-lg">{t("commerce.share.title") || "Share"}</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center justify-center pb-8 pt-4 px-6">
          {/* QR Code */}
          {shareUrl && (
            <div ref={qrRef} className="bg-white p-3 rounded-2xl border shadow-sm mb-6">
              <QRCode
                value={shareUrl}
                size={160}
                level="M"
                className="mx-auto"
              />
            </div>
          )}

          <div className="flex items-center w-full gap-2 bg-muted/40 p-1.5 rounded-lg border">
            <div className="flex-1 truncate px-2 text-sm text-muted-foreground select-all">
              {shareUrl}
            </div>
            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground" onClick={handleCopyLink} title={t("commerce.share.copyLink") || "Copy Link"}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex justify-center w-full gap-3 mt-4">
            <Button variant="outline" className="flex-1 rounded-lg" onClick={handleShareQR}>
              <Download className="w-4 h-4 mr-2" />
              {t("commerce.share.downloadQr") || "Download"}
            </Button>
            {canNativeShare && (
              <Button variant="default" className="flex-1 rounded-lg" onClick={handleNativeShare}>
                <Share className="w-4 h-4 mr-2" />
                {t("commerce.share.nativeShare") || "Share"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
