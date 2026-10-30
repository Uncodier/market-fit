import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Button } from "@/app/components/ui/button"
import { Key, BookOpen, Ticket, Calendar } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { displayValue, type BuyerAccessItem } from "../order-detail-display"

export function BuyerOrderAccess({ entitlements, reservations }: {
  entitlements: BuyerAccessItem[]
  reservations: BuyerAccessItem[]
}) {
  const { t } = useLocalization()
  const router = useRouter()
  if (!entitlements.length && !reservations.length) return null
  return (
            <Card className="md:col-span-2">
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <Key className="w-5 h-5 text-muted-foreground" />
                <CardTitle className="text-base">{t('buyer.orders.detail.access') || 'Access'}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {entitlements.map((ent: BuyerAccessItem) => {
                    const cItem = ent.catalog_item || {}
                    let icon = <BookOpen className="w-5 h-5" />
                    let link = `/buyer/library`
                    let actionText = t('buyer.orders.detail.viewAccess') || 'View Access'

                    if (cItem.kind === 'digital_asset') {
                      if (cItem.digital_subtype === 'course') {
                        link = `/buyer/course/${ent.id}`
                        actionText = t('buyer.orders.detail.viewCourse') || 'View Course'
                      } else if (cItem.digital_subtype === 'ticket') {
                        icon = <Ticket className="w-5 h-5" />
                        link = `/buyer/ticket/${ent.id}`
                        actionText = t('buyer.orders.detail.viewTicket') || 'View Ticket'
                      } else if (cItem.digital_subtype === 'pass') {
                        icon = <Ticket className="w-5 h-5" />
                        link = `/buyer/book/${ent.id}`
                        actionText = t('buyer.orders.detail.viewPass') || 'View Pass'
                      } else {
                        link = `/buyer/downloads/${ent.id}`
                        actionText = t('buyer.orders.detail.viewAsset') || 'View Asset'
                      }
                    }

                    return (
                      <div key={ent.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-muted flex flex-shrink-0 items-center justify-center text-muted-foreground">
                            {icon}
                          </div>
                          <div>
                            <div className="font-medium">{cItem.name || 'Item'}</div>
                            <div className="text-xs text-muted-foreground capitalize">{cItem.digital_subtype || cItem.kind}</div>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => router.push(link)}>
                          {actionText}
                        </Button>
                      </div>
                    )
                  })}

                  {reservations.map((res: BuyerAccessItem) => {
                    const cItem = res.catalog_item || {}
                    return (
                      <div key={res.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-muted flex flex-shrink-0 items-center justify-center text-muted-foreground">
                            <Calendar className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-medium">{cItem.name || 'Reservation'}</div>
                            <div className="text-xs text-muted-foreground capitalize">{t('buyer.orders.detail.reservation') || 'Reservation'} • {displayValue(res.status, 'buyer.orders.status', t)}</div>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => router.push(`/buyer/reservations/${res.id}`)}>
                          {t('buyer.orders.detail.viewReservation') || 'View Reservation'}
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
  )
}
