"use client"

import { useState, useEffect } from "react"
import type { Dispatch, SetStateAction } from "react"
import { CatalogItem } from "@/app/types"
import { Button } from "@/app/components/ui/button"
import { Label } from "@/app/components/ui/label"
import { Switch } from "@/app/components/ui/switch"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardDescription,
  SectionCardContent,
  SectionCardFooter,
} from "@/app/components/ui/section-card"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { ProductPaymentOptionsCard } from "./ProductPaymentOptionsCard"
import { ItemSpecsEditor } from "./ItemSpecsEditor"
import QRCode from "react-qr-code"
import { toast } from "sonner"
import { Download, Copy, ExternalLink, Link } from "@/app/components/ui/icons"

interface MarketplaceTabProps {
  item: CatalogItem | null
  formData: Partial<CatalogItem>
  setFormData: Dispatch<SetStateAction<Partial<CatalogItem>>>
  handleSave: () => void
  saving: boolean
}

export function MarketplaceTab({
  item,
  formData,
  setFormData,
  handleSave,
  saving,
}: MarketplaceTabProps) {

  const [origin, setOrigin] = useState("")

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin)
    }
  }, [])

  const itemUrl = item?.id && origin ? `${origin}/marketplace/${item.id}` : ""
  const isListed = formData.is_marketplace_listed ?? true

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(itemUrl)
      toast.success("URL copied to clipboard")
    } catch (err) {
      toast.error("Failed to copy URL")
    }
  }

  const handleDownloadQR = () => {
    const container = document.getElementById("marketplace-item-qr-container")
    const svg = container?.querySelector("svg")
    if (svg) {
      const svgData = new XMLSerializer().serializeToString(svg)
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      const img = new Image()
      img.onload = () => {
        canvas.width = img.width
        canvas.height = img.height
        if (ctx) {
          ctx.fillStyle = "white"
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, 0, 0)
          const pngFile = canvas.toDataURL("image/png")
          const downloadLink = document.createElement("a")
          downloadLink.download = `${item?.id || "marketplace"}-qr.png`
          downloadLink.href = pngFile
          downloadLink.click()
        }
      }
      img.src = "data:image/svg+xml;base64," + btoa(svgData)
    }
  }

  return (
    <div className="mx-auto max-w-[800px] space-y-6">
      {item && isListed && (
        <div id="marketplace-item-share" className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
              <Link className="h-5 w-5 text-muted-foreground" />
              Share & Promote
            </h3>
            <p className="text-sm text-muted-foreground mt-1">Share your item's marketplace link and QR code.</p>
          </div>
          
          <div className="flex flex-col md:flex-row gap-6 items-center border rounded-xl p-4 md:p-6 bg-card text-card-foreground shadow-sm">
            <div className="flex items-center gap-4 w-full md:w-auto shrink-0 justify-center">
              <div id="marketplace-item-qr-container" className="shrink-0 bg-white p-1.5 rounded-lg border shadow-sm">
                <QRCode
                  value={itemUrl}
                  size={72}
                  level="M"
                />
              </div>
              
              <div className="flex flex-col items-start gap-2">
                <div className="space-y-0.5">
                  <h4 className="font-semibold text-sm">Item QR Code</h4>
                  <p className="text-xs text-muted-foreground">Scan to visit</p>
                </div>
                <Button variant="secondary" size="sm" type="button" onClick={handleDownloadQR} className="h-7 text-xs px-3">
                  <Download className="h-3 w-3 mr-1.5" />
                  Download
                </Button>
              </div>
            </div>

            <div className="hidden md:block w-px h-16 bg-border shrink-0" />

            <div className="flex-1 space-y-2 w-full">
              <Label className="text-sm font-semibold">Marketplace Link</Label>
              <p className="text-xs text-muted-foreground">
                This is your public marketplace URL for this item. Share it with your customers on social media, in campaigns, or directly via messages.
              </p>
              <div className="flex items-center gap-2 mt-2 bg-muted/50 border rounded-lg p-1.5 pl-3">
                <span className="flex-1 text-sm font-mono text-muted-foreground truncate select-all">{itemUrl}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={handleCopyUrl} title="Copy Link">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => window.open(itemUrl, '_blank')} title="Open Link">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <SectionCard>
        <SectionCardHeader>
          <SectionCardTitle>Marketplace Listing</SectionCardTitle>
        </SectionCardHeader>
        <SectionCardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="is_marketplace_listed" className="text-base cursor-pointer">List in Marketplace</Label>
              <p className="text-sm text-muted-foreground">Make visible on the public marketplace</p>
            </div>
            <Switch
              id="is_marketplace_listed"
              checked={formData.is_marketplace_listed ?? true}
              onCheckedChange={(checked) => setFormData({...formData, is_marketplace_listed: checked as boolean})}
            />
          </div>
        </SectionCardContent>
        <ActionFooter>
          <Button variant="outline" onClick={handleSave} disabled={saving} size="sm">Save Listing</Button>
        </ActionFooter>
      </SectionCard>

      {item && (
        <ProductPaymentOptionsCard
          formData={formData}
          setFormData={setFormData}
          handleSave={handleSave}
          saving={saving}
        />
      )}

      {item && (
        <ItemSpecsEditor
          catalogItemId={item.id}
          item={item}
          handleSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  )
}
