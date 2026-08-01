"use client"

import { useState, useEffect, useRef } from "react"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { toast } from "sonner"
import { checkInTicket } from "@/app/commerce/ticket-check-in"
import { Loader2, QrCode, Ticket } from "@/app/components/ui/icons"

import { Skeleton } from "@/app/components/ui/skeleton"
import { resolveBuyerIdentityForSite, type BuyerIdentityResolution } from "@/app/commerce/resolve-buyer-qr"
import { BuyerIdentitySheet } from "../components/BuyerIdentitySheet"

export default function CheckInClient() {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  
  const [manualCode, setManualCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [permissionError, setPermissionError] = useState(false)
  
  const [identityData, setIdentityData] = useState<BuyerIdentityResolution | null>(null)
  const [showIdentitySheet, setShowIdentitySheet] = useState(false)

  const scannerRef = useRef<any>(null)
  
  const handleCheckIn = async (code: string) => {
    const trimmed = code.trim()
    if (!trimmed || !currentSite?.id) return
    
    if (trimmed.startsWith("mf:user:")) {
      setLoading(true)
      const res = await resolveBuyerIdentityForSite({ code: trimmed, siteId: currentSite.id })
      setLoading(false)
      
      if (res.error) {
        toast.error(res.error)
      } else if (res.data) {
        setIdentityData(res.data)
        setShowIdentitySheet(true)
      }
      
      if (code === manualCode) setManualCode("")
      return
    }

    setLoading(true)
    const { success, message, itemName, error } = await checkInTicket({ code: trimmed, siteId: currentSite.id })
    setLoading(false)
    
    if (error) {
      toast.error(error)
    } else if (success) {
      toast.success(`${message}: ${itemName}`)
    }
    
    if (code === manualCode) {
      setManualCode("")
    }
  }

  useEffect(() => {
    setIsClient(true)
  }, [])

  const startScanner = () => {
    setPermissionError(false)
    let isMounted = true;

    import("html5-qrcode").then((module) => {
      if (!isMounted) return;
      const { Html5Qrcode } = module;
      
      try {
        if (!scannerRef.current) {
          scannerRef.current = new Html5Qrcode("qr-reader")
        }
        
        scannerRef.current.start(
          { facingMode: "environment" },
          { 
            fps: 10, 
            qrbox: { width: 250, height: 250 }
          },
          (decodedText: string) => {
            if (scannerRef.current?.isScanning) {
              scannerRef.current.pause(true)
              handleCheckIn(decodedText).finally(() => {
                setTimeout(() => {
                  if (scannerRef.current && isMounted) {
                    scannerRef.current.resume()
                  }
                }, 2000)
              })
            }
          },
          () => {} // ignore errors
        ).catch((err: any) => {
          console.error("Error starting scanner:", err)
          setPermissionError(true)
        })
      } catch (err) {
        console.error("Error initializing scanner:", err);
        setPermissionError(true)
      }
    });
    
    return () => {
      isMounted = false;
    }
  }

  useEffect(() => {
    if (!isClient || !currentSite?.id) return
    
    const cleanup = startScanner()
    
    return () => {
      if (cleanup) cleanup()
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            scannerRef.current.stop().then(() => {
              scannerRef.current?.clear()
            }).catch(console.error)
          } else {
            scannerRef.current.clear()
          }
        } catch (e) {
          console.error("Error clearing scanner:", e)
        }
      }
    }
  }, [currentSite?.id, isClient])

  if (!isClient || !currentSite?.id) {
    return (
      <div className="flex-1 bg-muted/20 flex flex-col">
        <StickyHeader>
          <div className="flex items-center w-full px-4 h-14">
            <h1 className="font-bold text-lg">{t('pos.checkIn.title') || 'Access Check-in'}</h1>
          </div>
        </StickyHeader>
        
        <div className="flex-1 p-4 md:p-8 max-w-3xl mx-auto w-full flex flex-col gap-8">
          <div className="bg-card rounded-2xl border shadow-sm p-6 overflow-hidden">
            <div className="flex items-center gap-3 mb-6">
              <Skeleton className="w-10 h-10 rounded-full shrink-0" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
            <Skeleton className="w-full h-[300px] rounded-xl" />
          </div>
          
          <div className="bg-card rounded-2xl border shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <Skeleton className="w-10 h-10 rounded-full shrink-0" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
            <div className="flex gap-3">
              <Skeleton className="flex-1 h-10" />
              <Skeleton className="w-24 h-10" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
      <div className="flex-1 bg-muted/20 flex flex-col">
        <StickyHeader>
          <div className="flex items-center w-full px-4 h-14">
            <h1 className="font-bold text-lg">{t('pos.checkIn.title') || 'Access Check-in'}</h1>
          </div>
        </StickyHeader>
      
      <div className="flex-1 p-4 md:p-8 max-w-3xl mx-auto w-full flex flex-col gap-8">
        <div className="bg-card rounded-2xl border shadow-sm p-6 overflow-hidden">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <QrCode size={20} />
            </div>
            <div>
              <h2 className="font-bold text-lg">{t('pos.checkIn.scannerTitle') || 'Scan QR Code'}</h2>
              <p className="text-sm text-muted-foreground">{t('pos.checkIn.scannerDesc') || 'Point the camera at the ticket or pass QR code'}</p>
            </div>
          </div>
          
          <div className="rounded-xl overflow-hidden border bg-black/5 relative">
            <div id="qr-reader" className="w-full" style={{ minHeight: "300px" }}></div>
            {permissionError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-muted/80 backdrop-blur-sm z-10">
                <QrCode size={48} className="text-muted-foreground mb-4 opacity-50" />
                <h3 className="font-semibold text-lg mb-2">{t('pos.checkIn.cameraErrorTitle') || 'Camera Access Denied'}</h3>
                <p className="text-sm text-muted-foreground max-w-sm mb-4">
                  {t('pos.checkIn.cameraErrorDesc') || 'Please allow camera access in your browser settings to scan QR codes, or enter the code manually below.'}
                </p>
                <Button variant="outline" onClick={startScanner}>
                  {t('common.retry') || 'Retry'}
                </Button>
              </div>
            )}
          </div>
        </div>
        
        <div className="bg-card rounded-2xl border shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-muted text-muted-foreground flex items-center justify-center shrink-0">
              <Ticket size={20} />
            </div>
            <div>
              <h2 className="font-bold text-lg">{t('pos.checkIn.manualTitle') || 'Manual Entry'}</h2>
              <p className="text-sm text-muted-foreground">{t('pos.checkIn.manualDesc') || 'Enter ticket or pass code manually'}</p>
            </div>
          </div>
          
          <form 
            onSubmit={(e) => {
              e.preventDefault()
              handleCheckIn(manualCode)
            }}
            className="flex gap-3"
          >
            <Input 
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder={t('pos.checkIn.codePlaceholder') || 'Enter code...'}
              className="flex-1"
              disabled={loading}
            />
            <Button type="submit" disabled={!manualCode.trim() || loading} className="w-24">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (t('common.submit') || 'Submit')}
            </Button>
          </form>
        </div>
      </div>
      
      <BuyerIdentitySheet 
        open={showIdentitySheet}
        data={identityData}
        onClose={() => {
          setShowIdentitySheet(false)
          setIdentityData(null)
          // Resume scanner if needed
          if (scannerRef.current && scannerRef.current.isScanning === false) { // might be paused
            scannerRef.current.resume()
          }
        }}
      />
    </div>
  )
}
