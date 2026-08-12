"use client"

import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Truck, Store, CreditCard, MapPin, MonitorSmartphone, Banknote } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { DatePicker } from "@/app/components/ui/date-picker"
import { checkoutLabelKey, CheckoutCopyMode } from "@/app/commerce/checkout-labels"
import type { ReactNode } from "react"

interface CartCheckoutFieldsProps {
  allowedOptions: Array<'pickup' | 'ship' | 'none' | 'dine_in'>
  fulfillment: 'pickup' | 'ship' | 'none' | 'dine_in'
  setFulfillment: (val: 'pickup' | 'ship' | 'none' | 'dine_in') => void
  pickupLocations?: any[]
  originLocationId?: string
  setOriginLocationId?: (val: string) => void
  shippingAddress?: any
  setShippingAddress?: (val: any) => void
  availablePaymentMethods?: string[]
  paymentMethod?: string
  setPaymentMethod?: (val: string) => void
  orderTiming?: 'now' | 'scheduled'
  setOrderTiming?: (val: 'now' | 'scheduled') => void
  scheduledFor?: Date | null
  setScheduledFor?: (val: Date | null) => void
  isOpen?: boolean
  nextOpenSlot?: { at: Date, label: string } | null
  deliveryTimeLabel?: string | null
  t?: (key: string) => string | undefined
  copyMode?: CheckoutCopyMode
}

function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string; icon?: ReactNode }>
  value: T
  onChange: (val: T) => void
}) {
  return (
    <div className="inline-flex p-1 bg-gray-100 dark:bg-zinc-800/80 rounded-xl w-full gap-1">
      {options.map((opt) => {
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-lg transition-all min-w-0 ${
              selected
                ? 'bg-white dark:bg-zinc-700 text-primary shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                : 'text-muted-foreground hover:text-foreground hover:bg-gray-200/50 dark:hover:bg-zinc-700/50'
            }`}
          >
            {opt.icon}
            <span className="text-xs font-medium whitespace-nowrap truncate">{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function CartCheckoutFields({
  allowedOptions,
  fulfillment,
  setFulfillment,
  pickupLocations = [],
  originLocationId,
  setOriginLocationId,
  shippingAddress,
  setShippingAddress,
  availablePaymentMethods = [],
  paymentMethod,
  setPaymentMethod,
  orderTiming = 'now',
  setOrderTiming,
  scheduledFor,
  setScheduledFor,
  isOpen = true,
  nextOpenSlot,
  deliveryTimeLabel,
  t: propT,
  copyMode = 'retail'
}: CartCheckoutFieldsProps) {
  const { t: contextT } = useLocalization()
  const t = propT || contextT

  const deliveryOptions = (
    [
      allowedOptions.includes('pickup') && {
        value: 'pickup' as const,
        label: t(checkoutLabelKey('checkout.storePickup', copyMode)) || 'Store Pickup',
        icon: <Store className="w-3.5 h-3.5 text-emerald-500 shrink-0" />,
      },
      allowedOptions.includes('ship') && {
        value: 'ship' as const,
        label: t(checkoutLabelKey('checkout.shipToMe', copyMode)) || 'Ship to Me',
        icon: <Truck className="w-3.5 h-3.5 text-blue-500 shrink-0" />,
      },
      allowedOptions.includes('dine_in') && {
        value: 'dine_in' as const,
        label: t('checkout.dineIn') || 'Consume Here',
        icon: <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0" />,
      },
      allowedOptions.includes('none') && {
        value: 'none' as const,
        label: t('checkout.digitalService') || 'Digital / Service',
        icon: <MonitorSmartphone className="w-3.5 h-3.5 text-purple-500 shrink-0" />,
      },
    ] as const
  ).filter(Boolean) as Array<{ value: typeof fulfillment; label: string; icon: ReactNode }>

  const paymentOptions = (
    [
      availablePaymentMethods.includes('card') && {
        value: 'card',
        label: t('checkout.cardStripe') || 'Card (Stripe)',
        icon: <CreditCard className="w-3.5 h-3.5 text-blue-500 shrink-0" />,
      },
      availablePaymentMethods.includes('cash_on_pickup') && {
        value: 'cash_on_pickup',
        label: t(checkoutLabelKey('checkout.cashOnPickup', copyMode)) || 'Cash on Pickup',
        icon: <Banknote className="w-3.5 h-3.5 text-emerald-500 shrink-0" />,
      },
      availablePaymentMethods.includes('bank_transfer') && {
        value: 'bank_transfer',
        label: t('checkout.bankTransfer') || 'Bank Transfer',
        icon: <Banknote className="w-3.5 h-3.5 text-indigo-500 shrink-0" />,
      },
    ] as const
  ).filter(Boolean) as Array<{ value: string; label: string; icon: ReactNode }>

  return (
    <>
      {setOrderTiming && (
        <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
          <Label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5 block">{t('checkout.orderTiming') || 'Order Timing'}</Label>
          <div className="mb-3">
            <SegmentedTabs
              value={orderTiming}
              onChange={setOrderTiming}
              options={[
                { value: 'now' as const, label: t('checkout.orderNow') || 'Order Now' },
                { value: 'scheduled' as const, label: t('checkout.scheduleOrder') || 'Schedule Order' },
              ]}
            />
          </div>

          {orderTiming === 'now' && !isOpen && nextOpenSlot && (
            <div className="text-xs text-orange-700 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-300 p-3 rounded-lg border border-orange-100 dark:border-orange-900/30 mb-3">
              {t('checkout.storeClosedNotice', { time: nextOpenSlot.label }) || `This store is closed. Order will be processed ${nextOpenSlot.label}.`}
            </div>
          )}

          {orderTiming === 'now' && isOpen && deliveryTimeLabel && (
            <div className="text-xs text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-300 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/30 mb-3 flex items-center gap-2">
              <Truck className="w-4 h-4" />
              {t('checkout.usuallyReadyIn', { time: deliveryTimeLabel }) || `Usually ready in ${deliveryTimeLabel}.`}
            </div>
          )}

          {orderTiming === 'scheduled' && setScheduledFor && (
            <div className="mb-3">
              <DatePicker
                date={scheduledFor || undefined}
                setDate={(date: Date) => setScheduledFor(date)}
                showTimePicker={true}
                timeFormat="12h"
                mode="task"
                showEvents={true}
                className="w-full h-12 rounded-xl bg-gray-50 dark:bg-gray-950 dark:border-gray-800 ring-0 shadow-none"
              />
            </div>
          )}
        </div>
      )}

      <div className={`${setOrderTiming ? 'mt-4' : 'mt-6 pt-6 border-t border-gray-100 dark:border-gray-800'}`}>
        <Label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5 block">{t(checkoutLabelKey('checkout.deliveryMethod', copyMode)) || 'Delivery Method'}</Label>
        {allowedOptions.length === 0 ? (
          <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-900/30">
            {t('checkout.incompatibleDelivery') || 'These items cannot be purchased together due to incompatible delivery methods. Please remove some items.'}
          </div>
        ) : (
          <SegmentedTabs
            value={fulfillment}
            onChange={setFulfillment}
            options={deliveryOptions}
          />
        )}
      </div>

      {(fulfillment === 'pickup' || fulfillment === 'dine_in') && allowedOptions.some(opt => opt === 'pickup' || opt === 'dine_in') && setOriginLocationId && (
        <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <Label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5 block">
            {fulfillment === 'pickup' ? (t(checkoutLabelKey('checkout.pickupLocation', copyMode)) || 'Pickup Location') : (t('checkout.location') || 'Location')}
          </Label>
          {pickupLocations.length === 0 ? (
            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-900/30">
              {t(checkoutLabelKey('checkout.noPickupLocations', copyMode)) || 'No valid locations available for these items.'}
            </div>
          ) : pickupLocations.length === 1 ? (
            <div className="h-12 px-4 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
              {pickupLocations[0].name}
            </div>
          ) : (
            <Select value={originLocationId} onValueChange={setOriginLocationId}>
              <SelectTrigger className="h-12 rounded-xl bg-gray-50 dark:bg-gray-950 dark:border-gray-800">
                <SelectValue placeholder={t('checkout.selectLocation') || "Select location"} />
              </SelectTrigger>
              <SelectContent>
                {pickupLocations.map((loc: any) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {fulfillment === 'ship' && allowedOptions.includes('ship') && setShippingAddress && shippingAddress && (
        <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-gray-800">
          <Label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block">{t(checkoutLabelKey('checkout.shippingAddress', copyMode)) || 'Shipping Address'}</Label>
          <Input placeholder={t('checkout.streetAddress') || "Street Address"} value={shippingAddress.line1} onChange={e => setShippingAddress({...shippingAddress, line1: e.target.value})} required className="h-12 rounded-xl bg-gray-50 dark:bg-gray-950 dark:border-gray-800" />
          <Input placeholder={t('checkout.aptSuite') || "Apt, Suite, etc. (optional)"} value={shippingAddress.line2} onChange={e => setShippingAddress({...shippingAddress, line2: e.target.value})} className="h-12 rounded-xl bg-gray-50 dark:bg-gray-950 dark:border-gray-800" />
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder={t('checkout.city') || "City"} value={shippingAddress.city} onChange={e => setShippingAddress({...shippingAddress, city: e.target.value})} required className="h-12 rounded-xl bg-gray-50 dark:bg-gray-950 dark:border-gray-800" />
            <Input placeholder={t('checkout.state') || "State"} value={shippingAddress.state} onChange={e => setShippingAddress({...shippingAddress, state: e.target.value})} className="h-12 rounded-xl bg-gray-50 dark:bg-gray-950 dark:border-gray-800" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder={t('checkout.zipCode') || "ZIP Code"} value={shippingAddress.zip} onChange={e => setShippingAddress({...shippingAddress, zip: e.target.value})} required className="h-12 rounded-xl bg-gray-50 dark:bg-gray-950 dark:border-gray-800" />
            <Input placeholder={t('checkout.country') || "Country"} value={shippingAddress.country} onChange={e => setShippingAddress({...shippingAddress, country: e.target.value})} className="h-12 rounded-xl bg-gray-50 dark:bg-gray-950 dark:border-gray-800" />
          </div>
        </div>
      )}

      {paymentOptions.length > 0 && setPaymentMethod && (
        <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-gray-800">
          <Label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5 block">{t('checkout.paymentMethod') || 'Payment Method'}</Label>
          <SegmentedTabs
            value={paymentMethod || paymentOptions[0].value}
            onChange={setPaymentMethod}
            options={paymentOptions}
          />
        </div>
      )}
    </>
  )
}
