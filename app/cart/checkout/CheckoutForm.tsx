"use client"

import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Textarea } from "@/app/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Truck, Store, CreditCard, Package } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { DatePicker } from "@/app/components/ui/date-picker"
import { CheckoutIdentityPicker } from "@/app/components/commerce/CheckoutIdentityPicker"
import { VenueMap } from "@/app/components/commerce/pdp/VenueMap"
import { checkoutLabelKey, CheckoutCopyMode } from "@/app/commerce/checkout-labels"

interface CheckoutFormProps {
  session: any
  requiresAuth?: boolean
  source: string
  fulfillment: 'pickup' | 'ship' | 'none' | 'dine_in'
  setFulfillment: (val: 'pickup' | 'ship' | 'none' | 'dine_in') => void
  allowedOptions: Array<'pickup' | 'ship' | 'none' | 'dine_in'>
  customerName: string
  setCustomerName: (val: string) => void
  customerEmail: string
  setCustomerEmail: (val: string) => void
  shippingAddress: any
  setShippingAddress: (val: any) => void
  ownerSiteId: string | null
  setOwnerSiteId: (val: string | null) => void
  handleCheckout: (e: React.FormEvent) => void
  lockedDestination: boolean
  locations?: any[]
  pickupLocationId?: string
  setPickupLocationId?: (val: string) => void
  paymentMethod?: string
  setPaymentMethod?: (val: any) => void
  availablePaymentMethods?: string[]
  orderTiming?: 'now' | 'scheduled'
  setOrderTiming?: (val: 'now' | 'scheduled') => void
  scheduledFor?: Date | null
  setScheduledFor?: (val: Date | null) => void
  orderNotes?: string
  setOrderNotes?: (val: string) => void
  businessHours?: any[]
  isOpen?: boolean
  nextOpenSlot?: { at: Date, label: string } | null
  deliveryTimeLabel?: string | null
  copyMode?: CheckoutCopyMode
}

export function CheckoutForm({
  session, requiresAuth = false, source, fulfillment, setFulfillment, allowedOptions,
  customerName, setCustomerName, customerEmail, setCustomerEmail,
  shippingAddress, setShippingAddress, ownerSiteId, setOwnerSiteId,
  handleCheckout, lockedDestination, locations = [], pickupLocationId, setPickupLocationId,
  paymentMethod, setPaymentMethod, availablePaymentMethods = [],
  orderTiming = 'now', setOrderTiming, scheduledFor, setScheduledFor,
  orderNotes, setOrderNotes,
  businessHours = [], isOpen = true, nextOpenSlot, deliveryTimeLabel,
  copyMode = 'retail'
}: CheckoutFormProps) {
  const { t } = useLocalization()

  return (
    <form id="checkout-form" onSubmit={handleCheckout} className="space-y-8">
      <div className="space-y-6">
        <h3 className="text-xl font-bold">{t('checkout.contactInfo') || 'Contact Information'}</h3>
        
        <CheckoutIdentityPicker
          session={session}
          requiresAuth={requiresAuth}
          customerName={customerName}
          setCustomerName={setCustomerName}
          customerEmail={customerEmail}
          setCustomerEmail={setCustomerEmail}
          ownerSiteId={ownerSiteId}
          setOwnerSiteId={setOwnerSiteId}
          lockedDestination={lockedDestination}
        />
      </div>

      <div className="space-y-6 pt-8 border-t">
        <h3 className="text-xl font-bold">{t('checkout.orderTiming') || 'Order Timing'}</h3>
        
        {setOrderTiming && (
          <div className="space-y-4">
            <div className="inline-flex flex-col sm:flex-row p-1.5 bg-gray-100 dark:bg-zinc-800/80 rounded-2xl w-full gap-1">
              <button
                type="button"
                onClick={() => setOrderTiming('now')}
                className={`flex-1 flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl transition-all ${
                  orderTiming === 'now' 
                    ? 'bg-white dark:bg-zinc-700 text-primary shadow-sm ring-1 ring-black/5 dark:ring-white/10' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-gray-200/50 dark:hover:bg-zinc-700/50'
                }`}
              >
                <span className="text-sm font-medium whitespace-nowrap">{t('checkout.orderNow') || 'Order Now'}</span>
              </button>
              <button
                type="button"
                onClick={() => setOrderTiming('scheduled')}
                className={`flex-1 flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl transition-all ${
                  orderTiming === 'scheduled' 
                    ? 'bg-white dark:bg-zinc-700 text-primary shadow-sm ring-1 ring-black/5 dark:ring-white/10' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-gray-200/50 dark:hover:bg-zinc-700/50'
                }`}
              >
                <span className="text-sm font-medium whitespace-nowrap">{t('checkout.scheduleOrder') || 'Schedule Order'}</span>
              </button>
            </div>

            {orderTiming === 'now' && !isOpen && nextOpenSlot && (
              <div className="text-sm text-orange-700 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-300 p-4 rounded-xl border border-orange-100 dark:border-orange-900/30">
                {t('checkout.storeClosedNotice', { time: nextOpenSlot.label }) || `This store is currently closed. Your order will be processed ${nextOpenSlot.label}. You can also choose to Schedule for another time.`}
              </div>
            )}

            {orderTiming === 'now' && isOpen && deliveryTimeLabel && (
              <div className="text-sm text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-300 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30 flex items-center gap-2">
                <Truck className="w-5 h-5 shrink-0" />
                {t('checkout.usuallyReadyIn', { time: deliveryTimeLabel }) || `Usually ready in ${deliveryTimeLabel}.`}
              </div>
            )}

            {orderTiming === 'scheduled' && setScheduledFor && (
              <div className="p-4 bg-gray-50 dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                  {t('checkout.selectTime') || 'Select Time'}
                </Label>
                <DatePicker
                  date={scheduledFor || undefined}
                  setDate={(date: Date) => setScheduledFor(date)}
                  showTimePicker={true}
                  timeFormat="12h"
                  mode="task"
                  showEvents={true}
                  className="w-full h-12 rounded-xl bg-background border-input ring-0 shadow-none"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Show for both shop and marketplace when they have valid options */}
      <div className="space-y-6 pt-8 border-t">
        <h3 className="text-xl font-bold">{t(checkoutLabelKey('checkout.deliveryMethod', copyMode)) || 'Delivery Method'}</h3>
        
        <div>
          {allowedOptions.length === 0 ? (
            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-100 dark:border-red-900/30">
              {t('checkout.incompatibleDelivery') || 'These items cannot be purchased together due to incompatible delivery methods. Please remove some items.'}
            </div>
          ) : (
            <div className="inline-flex flex-col sm:flex-row p-1.5 bg-gray-100 dark:bg-zinc-800/80 rounded-2xl w-full gap-1">
              {allowedOptions.includes('pickup') && (
                <button
                  type="button"
                  onClick={() => setFulfillment('pickup')}
                  className={`flex-1 flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl transition-all ${
                    fulfillment === 'pickup' 
                      ? 'bg-white dark:bg-zinc-700 text-primary shadow-sm ring-1 ring-black/5 dark:ring-white/10' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-gray-200/50 dark:hover:bg-zinc-700/50'
                  }`}
                >
                  <Store className="w-4 h-4 shrink-0" />
                  <span className="text-sm font-medium whitespace-nowrap">{t(checkoutLabelKey('checkout.storePickup', copyMode)) || 'Store Pickup'}</span>
                </button>
              )}
              {allowedOptions.includes('ship') && (
                <button
                  type="button"
                  onClick={() => setFulfillment('ship')}
                  className={`flex-1 flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl transition-all ${
                    fulfillment === 'ship' 
                      ? 'bg-white dark:bg-zinc-700 text-primary shadow-sm ring-1 ring-black/5 dark:ring-white/10' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-gray-200/50 dark:hover:bg-zinc-700/50'
                  }`}
                >
                  <Truck className="w-4 h-4 shrink-0" />
                  <span className="text-sm font-medium whitespace-nowrap">{t(checkoutLabelKey('checkout.shipToMe', copyMode)) || 'Ship to Me'}</span>
                </button>
              )}
              {allowedOptions.includes('dine_in') && (
                <button
                  type="button"
                  onClick={() => setFulfillment('dine_in')}
                  className={`flex-1 flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl transition-all ${
                    fulfillment === 'dine_in' 
                      ? 'bg-white dark:bg-zinc-700 text-primary shadow-sm ring-1 ring-black/5 dark:ring-white/10' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-gray-200/50 dark:hover:bg-zinc-700/50'
                  }`}
                >
                  <Store className="w-4 h-4 shrink-0" />
                  <span className="text-sm font-medium whitespace-nowrap">{t('checkout.dineIn') || 'Consume Here'}</span>
                </button>
              )}
              {allowedOptions.includes('none') && (
                <button
                  type="button"
                  onClick={() => setFulfillment('none')}
                  className={`flex-1 flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl transition-all ${
                    fulfillment === 'none' 
                      ? 'bg-white dark:bg-zinc-700 text-primary shadow-sm ring-1 ring-black/5 dark:ring-white/10' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-gray-200/50 dark:hover:bg-zinc-700/50'
                  }`}
                >
                  <Package className="w-4 h-4 shrink-0" />
                  <span className="text-sm font-medium whitespace-nowrap">{t(checkoutLabelKey('checkout.digitalService', copyMode)) || 'Digital / Service'}</span>
                </button>
              )}
            </div>
          )}
        </div>

          {(fulfillment === 'pickup' || fulfillment === 'dine_in') && allowedOptions.some(opt => opt === 'pickup' || opt === 'dine_in') && (
            <div className="space-y-4 pt-2">
              <Label className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
                {fulfillment === 'pickup' ? (t(checkoutLabelKey('checkout.pickupLocation', copyMode)) || 'Pickup Location') : (t('checkout.location') || 'Location')}
              </Label>
              {locations.length === 0 ? (
                <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-100 dark:border-red-900/30">
                  {t(checkoutLabelKey('checkout.noPickupLocations', copyMode)) || 'No valid locations available for these items.'}
                </div>
              ) : locations.length === 1 ? (
                <div className="rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-sm overflow-hidden">
                  <div className="p-4">
                    <div className="font-semibold mb-1">{locations[0].name}</div>
                    {(() => {
                      const parts = [locations[0].address, locations[0].city, locations[0].state, locations[0].zip, locations[0].country].filter(Boolean);
                      if (parts.length === 0) return null;
                      return (
                        <div className="flex items-start gap-2 mt-2 text-gray-600 dark:text-gray-300 leading-relaxed">
                          <Store className="w-4 h-4 mt-0.5 shrink-0" />
                          <span>{parts.join(', ')}</span>
                        </div>
                      );
                    })()}
                  </div>
                  <VenueMap
                    name={locations[0].name}
                    address={locations[0].address}
                    city={locations[0].city}
                    variant="card"
                    className="w-full rounded-none border-x-0 border-b-0 border-t border-gray-200 dark:border-gray-800"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <Select value={pickupLocationId} onValueChange={(v: string) => setPickupLocationId?.(v)}>
                    <SelectTrigger className="h-12 rounded-xl">
                      <SelectValue placeholder={t('checkout.selectPickupLocation') || 'Select a pickup location'} />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {pickupLocationId && (
                    (() => {
                      const loc = locations.find(l => l.id === pickupLocationId);
                      if (!loc) return null;
                      const parts = [loc.address, loc.city, loc.state, loc.zip, loc.country].filter(Boolean);
                      
                      return (
                        <div className="mt-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-sm overflow-hidden">
                          <div className="p-4">
                            <div className="font-semibold mb-1">{loc.name}</div>
                            {parts.length > 0 && (
                              <div className="flex items-start gap-2 mt-2 text-gray-600 dark:text-gray-300 leading-relaxed">
                                <Store className="w-4 h-4 mt-0.5 shrink-0" />
                                <span>{parts.join(', ')}</span>
                              </div>
                            )}
                          </div>
                          <VenueMap
                            name={loc.name}
                            address={loc.address}
                            city={loc.city}
                            variant="card"
                            className="w-full rounded-none border-x-0 border-b-0 border-t border-gray-200 dark:border-gray-800"
                          />
                        </div>
                      );
                    })()
                  )}
                </div>
              )}
            </div>
          )}

          {fulfillment === 'ship' && allowedOptions.includes('ship') && (
            <div className="space-y-4">
              <div>
                <Label className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">{t(checkoutLabelKey('checkout.shippingAddress', copyMode)) || 'Shipping Address'}</Label>
                <Input placeholder={t('checkout.streetAddress') || 'Street Address'} value={shippingAddress?.line1} onChange={e => setShippingAddress({...shippingAddress, line1: e.target.value})} required className="h-12 rounded-xl mb-3" />
                <Input placeholder={t('checkout.aptSuite') || 'Apt, Suite, etc. (optional)'} value={shippingAddress?.line2} onChange={e => setShippingAddress({...shippingAddress, line2: e.target.value})} className="h-12 rounded-xl mb-3" />
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <Input placeholder={t('checkout.city') || 'City'} value={shippingAddress?.city} onChange={e => setShippingAddress({...shippingAddress, city: e.target.value})} required className="h-12 rounded-xl" />
                  <Input placeholder={t('checkout.state') || 'State'} value={shippingAddress?.state} onChange={e => setShippingAddress({...shippingAddress, state: e.target.value})} className="h-12 rounded-xl" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder={t('checkout.zipCode') || 'ZIP Code'} value={shippingAddress?.zip} onChange={e => setShippingAddress({...shippingAddress, zip: e.target.value})} required className="h-12 rounded-xl" />
                  <Input placeholder={t('checkout.country') || 'Country'} value={shippingAddress?.country} onChange={e => setShippingAddress({...shippingAddress, country: e.target.value})} className="h-12 rounded-xl" />
                </div>
              </div>
            </div>
          )}

          {setOrderNotes && (
            <div className="space-y-4 pt-6 border-t mt-6">
              <h3 className="text-xl font-bold">
                {t('checkout.specialInstructions') || 'Special instructions'}
              </h3>
              <Textarea
                id="checkout-special-instructions"
                value={orderNotes || ''}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder={
                  t('checkout.specialInstructionsPlaceholder') ||
                  'Any special requests for this order? (optional)'
                }
                className="resize-none min-h-[100px] rounded-xl"
              />
            </div>
          )}

          {availablePaymentMethods.length > 0 && (
            <div className="space-y-4 pt-6 border-t mt-6">
              <h3 className="text-xl font-bold">{t('checkout.paymentDetails') || 'Payment Details'}</h3>
              
              <div className="inline-flex flex-col sm:flex-row p-1.5 bg-gray-100 dark:bg-zinc-800/80 rounded-2xl w-full gap-1">
                {availablePaymentMethods.includes('card') && (
                  <button
                    type="button"
                    onClick={() => setPaymentMethod?.('card')}
                    className={`flex-1 flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl transition-all ${
                      paymentMethod === 'card' 
                        ? 'bg-white dark:bg-zinc-700 text-primary shadow-sm ring-1 ring-black/5 dark:ring-white/10' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-gray-200/50 dark:hover:bg-zinc-700/50'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 shrink-0" />
                    <span className="text-sm font-medium whitespace-nowrap">{t('checkout.cardStripe') || 'Card (Stripe)'}</span>
                  </button>
                )}
                {availablePaymentMethods.includes('cash_on_pickup') && (
                  <button
                    type="button"
                    onClick={() => setPaymentMethod?.('cash_on_pickup')}
                    className={`flex-1 flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl transition-all ${
                      paymentMethod === 'cash_on_pickup' 
                        ? 'bg-white dark:bg-zinc-700 text-primary shadow-sm ring-1 ring-black/5 dark:ring-white/10' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-gray-200/50 dark:hover:bg-zinc-700/50'
                    }`}
                  >
                    <Store className="w-4 h-4 shrink-0" />
                    <span className="text-sm font-medium whitespace-nowrap">{t(checkoutLabelKey('checkout.cashOnPickup', copyMode)) || 'Cash on Pickup'}</span>
                  </button>
                )}
                {availablePaymentMethods.includes('bank_transfer') && (
                  <button
                    type="button"
                    onClick={() => setPaymentMethod?.('bank_transfer')}
                    className={`flex-1 flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl transition-all ${
                      paymentMethod === 'bank_transfer' 
                        ? 'bg-white dark:bg-zinc-700 text-primary shadow-sm ring-1 ring-black/5 dark:ring-white/10' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-gray-200/50 dark:hover:bg-zinc-700/50'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 shrink-0" />
                    <span className="text-sm font-medium whitespace-nowrap">{t('checkout.bankTransfer') || 'Bank Transfer'}</span>
                  </button>
                )}
              </div>
            </div>
          )}
      </div>
    </form>
  )
}
