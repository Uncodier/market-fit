"use client"

import { useLocalization } from "@/app/context/LocalizationContext"
import { PdpPriceBlock } from "./PdpPriceBlock"
import { PdpPurchaseCtas } from "./PdpPurchaseCtas"
import { PdpCtaButton } from "./PdpCtaButton"
import { CheckCircle } from "@/app/components/ui/icons"

interface TicketPurchaseCardProps {
  price: number
  currency: string
  imageUrl?: string | null
  itemName: string
  date?: string | null
  time?: string | null
  isSellable: boolean
  catalogSize: number
  onAdd: () => void
  onBuyNow: () => void
  onViewTicket?: () => void
  ownedEntitlement?: any
  className?: string
  merchNode?: React.ReactNode
}

export function TicketPurchaseCard({
  price,
  currency,
  imageUrl,
  itemName,
  date,
  time,
  isSellable,
  catalogSize,
  onAdd,
  onBuyNow,
  onViewTicket,
  ownedEntitlement,
  className = "",
  merchNode,
}: TicketPurchaseCardProps) {
  const { t } = useLocalization()

  return (
    <div className={`relative drop-shadow-[0_20px_25px_rgba(0,0,0,0.05)] ${className}`}>
      {/* Contenedor principal con recorte físico */}
      <div 
        className="relative bg-card rounded-[2rem] border border-border"
        style={{
          maskImage: "radial-gradient(circle 16px at 0% calc(50% - 1px), transparent 16px, black 16.5px), radial-gradient(circle 16px at 100% calc(50% - 1px), transparent 16px, black 16.5px)",
          maskComposite: "intersect",
          WebkitMaskImage: "radial-gradient(circle 16px at 0% calc(50% - 1px), transparent 16px, black 16.5px), radial-gradient(circle 16px at 100% calc(50% - 1px), transparent 16px, black 16.5px)",
          WebkitMaskComposite: "source-in"
        }}
      >
        {/* Mitad superior: Info y compra */}
        <div className="p-6 sm:p-8 border-b-2 border-dashed border-border/60 relative rounded-t-[2rem] bg-card">
          {(date || time) && (
            <div className="flex flex-col gap-1 mb-6 text-sm font-medium">
              {date && <span className="text-foreground">{date}</span>}
              {time && <span className="text-muted-foreground">{time}</span>}
            </div>
          )}

          {ownedEntitlement ? (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-primary rounded-full mb-4 shadow-lg shadow-primary/20 ring-4 ring-primary/5">
                <CheckCircle className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="text-lg font-black text-foreground tracking-tight mb-1">
                {t('pdp.youOwnThisTicket') || 'You have a ticket for this event'}
              </h3>
              <p className="text-xs text-muted-foreground mb-6">
                {t('pdp.viewYourTicketText') || 'You can view your ticket and QR code in your library.'}
              </p>
              {onViewTicket && (
                <PdpCtaButton onClick={onViewTicket} className="w-full">
                  {t('buyer.library.actions.ticket') || 'View Ticket'}
                </PdpCtaButton>
              )}
            </div>
          ) : (
            <>
              <div className="mb-6">
                <PdpPriceBlock price={price} currency={currency} />
                {merchNode && <div className="mt-4">{merchNode}</div>}
              </div>
              
              <div className="hidden lg:block">
                <PdpPurchaseCtas
                  catalogSize={catalogSize}
                  disabled={!isSellable}
                  disabledLabel={!isSellable ? (t('pdp.soldOut') || 'Sold Out') : null}
                  onAdd={onAdd}
                  onBuyNow={onBuyNow}
                  buyNowLabel={t('pdp.getTickets') || 'Get Tickets'}
                  presentation="stack"
                />
              </div>
            </>
          )}
        </div>

        {/* Mitad inferior: código de barras decorativo */}
        <div className="p-6 bg-muted/30 rounded-b-[2rem] flex flex-col items-center justify-center gap-1.5 pt-8">
          <div className="flex justify-center items-end h-12 w-full gap-[2px] opacity-30 mix-blend-multiply dark:mix-blend-screen px-2">
            {[...Array(45)].map((_, i) => {
              // Algoritmo determinista simple para generar barras de distintos grosores
              const weight = [1, 2, 1, 3, 1, 2, 4, 1, 1, 2][i % 10]
              return (
                <div 
                  key={i} 
                  className={`bg-foreground h-full rounded-[1px]`} 
                  style={{ width: `${weight * 2}px` }}
                />
              )
            })}
          </div>
          <div className="font-mono text-[10px] tracking-[0.25em] text-muted-foreground/50 opacity-60">
            {itemName.substring(0, 3).toUpperCase().padEnd(3, 'X')}0{Math.abs(price).toString().padStart(4, '0')}001
          </div>
        </div>
      </div>
      {/* Arcos decorativos superpuestos para dar la ilusión del borde recortado */}
      <div 
        className="absolute left-[-17px] top-[calc(50%-1px)] -translate-y-1/2 w-[32px] h-[32px] rounded-full border border-border pointer-events-none z-10" 
        style={{ clipPath: "polygon(50% 0, 100% 0, 100% 100%, 50% 100%)" }}
      />
      <div 
        className="absolute right-[-17px] top-[calc(50%-1px)] -translate-y-1/2 w-[32px] h-[32px] rounded-full border border-border pointer-events-none z-10" 
        style={{ clipPath: "polygon(0 0, 50% 0, 50% 100%, 0 100%)" }}
      />
    </div>
  )
}
