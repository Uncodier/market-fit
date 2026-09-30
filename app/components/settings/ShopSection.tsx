"use client"

import QRCode from "react-qr-code"
import { type SiteFormValues } from "./form-schema"
import { FormLabel, FormDescription } from "../ui/form"

import { Button } from "../ui/button"

import { Link, Copy, Download, ExternalLink } from "../ui/icons"

import { useShopSection } from "./use-shop-section"
import { ShopHeroCard } from "./ShopHeroCard"
import { ShopTrustCard } from "./ShopTrustCard"
import { ShopPayoutsCard } from "./ShopPayoutsCard"
import { ShopPaymentsCard } from "./ShopPaymentsCard"
interface ShopSectionProps {
  active: boolean
  onSave?: (data: SiteFormValues) => void
  siteId?: string
}

export function ShopSection(props: ShopSectionProps) {
 const model = useShopSection(props)
 const { siteUrl, handleCopyUrl, handleDownloadQR } = model
 if (!props.active) return null
  return (
    <div className="space-y-6">
      {/* Marketplace URL & QR Code */}
      <div id="shop-share" className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
            <Link className="h-5 w-5 text-muted-foreground" />
            Share & Promote
          </h3>
          <p className="text-sm text-muted-foreground mt-1">Share your marketplace link and QR code.</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-6 items-center border rounded-xl p-4 md:p-6 bg-card text-card-foreground shadow-sm">
          <div className="flex items-center gap-4 w-full md:w-auto shrink-0 justify-center">
            <div id="marketplace-qr-code-container" className="shrink-0 bg-white p-1.5 rounded-lg border shadow-sm">
              <QRCode
                value={siteUrl}
                size={72}
                level="M"
              />
            </div>
            
            <div className="flex flex-col items-start gap-2">
              <div className="space-y-0.5">
                <h4 className="font-semibold text-sm">Marketplace QR Code</h4>
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
            <FormLabel className="text-sm font-semibold">Store Link</FormLabel>
            <FormDescription className="text-xs">
              This is your public marketplace URL. Share it with your customers on social media, in campaigns, or directly via messages.
            </FormDescription>
            <div className="flex items-center gap-2 mt-2 bg-muted/50 border rounded-lg p-1.5 pl-3">
              <span className="flex-1 text-sm font-mono text-muted-foreground truncate select-all">{siteUrl}</span>
              <div className="flex items-center gap-1 shrink-0">
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={handleCopyUrl} title="Copy Link">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => window.open(siteUrl, '_blank')} title="Open Link">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <ShopHeroCard {...model} />

      {/* Trust & Shipping */}
      <ShopTrustCard {...model} />

      <ShopPayoutsCard {...model} />

      {/* Payment & Delivery Policy */}
      <ShopPaymentsCard {...model} />
    </div>
  )
}