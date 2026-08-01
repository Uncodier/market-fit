"use client"

import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Truck, Store, CreditCard, Package, MapPin, MonitorSmartphone, Banknote } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"

interface CartCheckoutFieldsProps {
  allowedOptions: Array<'pickup' | 'ship' | 'none'>
  fulfillment: 'pickup' | 'ship' | 'none'
  setFulfillment: (val: 'pickup' | 'ship' | 'none') => void
  pickupLocations?: any[]
  originLocationId?: string
  setOriginLocationId?: (val: string) => void
  shippingAddress?: any
  setShippingAddress?: (val: any) => void
  availablePaymentMethods?: string[]
  paymentMethod?: string
  setPaymentMethod?: (val: string) => void
  t?: (key: string) => string | undefined
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
  t: propT
}: CartCheckoutFieldsProps) {
  const { t: contextT } = useLocalization()
  const t = propT || contextT

  return (
    <>
      <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
        <Label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5 block">{t('checkout.deliveryMethod') || 'Delivery Method'}</Label>
        {allowedOptions.length === 0 ? (
          <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-900/30">
            {t('checkout.incompatibleDelivery') || 'These items cannot be purchased together due to incompatible delivery methods. Please remove some items.'}
          </div>
        ) : allowedOptions.length === 1 ? (
          <div className="h-12 px-4 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
            {allowedOptions[0] === 'pickup' && <><Store className="w-4 h-4 mr-2 text-emerald-500" />{t('checkout.storePickup') || 'Store Pickup'}</>}
            {allowedOptions[0] === 'ship' && <><Truck className="w-4 h-4 mr-2 text-blue-500" />{t('checkout.shipToMe') || 'Ship to Me'}</>}
            {allowedOptions[0] === 'dine_in' && <><MapPin className="w-4 h-4 mr-2 text-orange-500" />{t('checkout.dineIn') || 'Consume Here'}</>}
            {allowedOptions[0] === 'none' && <><MonitorSmartphone className="w-4 h-4 mr-2 text-purple-500" />{t('checkout.digitalService') || 'Digital / Service (No shipping)'}</>}
          </div>
        ) : (
          <Select value={fulfillment} onValueChange={(val: any) => setFulfillment(val)}>
            <SelectTrigger className="h-12 rounded-xl bg-gray-50 dark:bg-gray-950 dark:border-gray-800">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allowedOptions.includes('pickup') && (
                <SelectItem value="pickup">
                  <div className="flex items-center">
                    <Store className="w-4 h-4 mr-2 text-emerald-500" />
                    {t('checkout.storePickup') || 'Store Pickup'}
                  </div>
                </SelectItem>
              )}
              {allowedOptions.includes('ship') && (
                <SelectItem value="ship">
                  <div className="flex items-center">
                    <Truck className="w-4 h-4 mr-2 text-blue-500" />
                    {t('checkout.shipToMe') || 'Ship to Me'}
                  </div>
                </SelectItem>
              )}
              {allowedOptions.includes('dine_in') && (
                <SelectItem value="dine_in">
                  <div className="flex items-center">
                    <MapPin className="w-4 h-4 mr-2 text-orange-500" />
                    {t('checkout.dineIn') || 'Consume Here'}
                  </div>
                </SelectItem>
              )}
              {allowedOptions.includes('none') && (
                <SelectItem value="none">
                  <div className="flex items-center">
                    <MonitorSmartphone className="w-4 h-4 mr-2 text-purple-500" />
                    {t('checkout.digitalService') || 'Digital / Service (No shipping)'}
                  </div>
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        )}
      </div>

      {fulfillment === 'pickup' && allowedOptions.includes('pickup') && setOriginLocationId && (
        <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <Label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5 block">{t('checkout.pickupLocation') || 'Pickup Location'}</Label>
          {pickupLocations.length === 0 ? (
            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-900/30">
              {t('checkout.noPickupLocations') || 'No compatible pickup locations for these items.'}
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
          <Label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block">{t('checkout.shippingAddress') || 'Shipping Address'}</Label>
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

      {availablePaymentMethods.length > 0 && setPaymentMethod && (
        <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-gray-800">
          <Label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5 block">{t('checkout.paymentMethod') || 'Payment Method'}</Label>
          {availablePaymentMethods.length === 1 ? (
            <div className="h-12 px-4 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
              {availablePaymentMethods[0] === 'card' && <><CreditCard className="w-4 h-4 mr-2 text-blue-500" />{t('checkout.cardStripe') || 'Card (Stripe)'}</>}
              {availablePaymentMethods[0] === 'cash_on_pickup' && <><Banknote className="w-4 h-4 mr-2 text-emerald-500" />{t('checkout.cashOnPickup') || 'Cash on Pickup'}</>}
              {availablePaymentMethods[0] === 'bank_transfer' && <><Banknote className="w-4 h-4 mr-2 text-indigo-500" />{t('checkout.bankTransfer') || 'Bank Transfer'}</>}
            </div>
          ) : (
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="h-12 rounded-xl bg-gray-50 dark:bg-gray-950 dark:border-gray-800">
                <SelectValue placeholder={t('checkout.selectPayment') || "Select payment method"} />
              </SelectTrigger>
              <SelectContent>
                {availablePaymentMethods.includes('card') && (
                  <SelectItem value="card">
                    <div className="flex items-center">
                      <CreditCard className="w-4 h-4 mr-2 text-blue-500" />
                      {t('checkout.cardStripe') || 'Card (Stripe)'}
                    </div>
                  </SelectItem>
                )}
                {availablePaymentMethods.includes('cash_on_pickup') && (
                  <SelectItem value="cash_on_pickup">
                    <div className="flex items-center">
                      <Banknote className="w-4 h-4 mr-2 text-emerald-500" />
                      {t('checkout.cashOnPickup') || 'Cash on Pickup'}
                    </div>
                  </SelectItem>
                )}
                {availablePaymentMethods.includes('bank_transfer') && (
                  <SelectItem value="bank_transfer">
                    <div className="flex items-center">
                      <Banknote className="w-4 h-4 mr-2 text-indigo-500" />
                      {t('checkout.bankTransfer') || 'Bank Transfer'}
                    </div>
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
    </>
  )
}
