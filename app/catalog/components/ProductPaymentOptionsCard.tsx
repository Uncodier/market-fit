"use client"

import { CatalogItem } from "@/app/types"
import { Card, CardHeader, CardTitle, CardContent } from "@/app/components/ui/card"
import { Label } from "@/app/components/ui/label"
import { Switch } from "@/app/components/ui/switch"
import { CreditCard, Store } from "@/app/components/ui/icons"
import { PaymentMethodType } from "@/app/commerce/payment-options"
import { useLocalization } from "@/app/context/LocalizationContext"

interface Props {
  formData: Partial<CatalogItem>;
  setFormData: (val: Partial<CatalogItem>) => void;
}

export function ProductPaymentOptionsCard({ formData, setFormData }: Props) {
  const { t } = useLocalization();
  const metadata = formData.metadata || {};
  // If payment_options is missing, it inherits from site settings, but we track overrides here.
  const currentOptions: PaymentMethodType[] | undefined = Array.isArray(metadata.payment_options) 
    ? metadata.payment_options 
    : undefined;

  const isOverride = currentOptions !== undefined;

  const handleOverrideToggle = (checked: boolean) => {
    setFormData({
      ...formData,
      metadata: {
        ...metadata,
        payment_options: checked ? ['card', 'cash_on_pickup', 'bank_transfer'] : undefined
      }
    });
  };

  const handleMethodToggle = (method: PaymentMethodType, checked: boolean) => {
    if (!isOverride) return;
    let next = [...currentOptions];
    if (checked && !next.includes(method)) next.push(method);
    if (!checked) next = next.filter(m => m !== method);
    
    setFormData({
      ...formData,
      metadata: {
        ...metadata,
        payment_options: next
      }
    });
  };

  return (
    <Card className="border dark:border-white/5 border-black/5 shadow-sm">
      <CardHeader className="border-b dark:border-white/5 border-black/5 bg-gray-50/50 dark:bg-zinc-900/50 pb-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-gray-500" />
              {t('catalog.paymentOptions.override') || 'Payment Override'}
            </CardTitle>
            <p className="text-sm text-gray-500">{t('catalog.paymentOptions.overrideDesc') || 'Override site default payment methods for this product.'}</p>
          </div>
          <Switch 
            checked={isOverride} 
            onCheckedChange={handleOverrideToggle}
            aria-label="Override site payment methods"
          />
        </div>
      </CardHeader>
      
      {isOverride && (
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between border rounded-lg p-3">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-500" />
                {t('catalog.paymentOptions.onlineCard') || 'Online Card Payment (Stripe)'}
              </Label>
              <p className="text-xs text-gray-500">{t('catalog.paymentOptions.onlineCardDesc') || 'Allow customers to pay online'}</p>
            </div>
            <Switch 
              checked={currentOptions.includes('card')} 
              onCheckedChange={(c) => handleMethodToggle('card', c)}
            />
          </div>
          
          <div className="flex items-center justify-between border rounded-lg p-3">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Store className="w-4 h-4 text-emerald-500" />
                {t('catalog.paymentOptions.cashOnPickup') || 'Cash on Pickup'}
              </Label>
              <p className="text-xs text-gray-500">{t('catalog.paymentOptions.cashOnPickupDesc') || 'Allow customers to pay cash at store'}</p>
            </div>
            <Switch 
              checked={currentOptions.includes('cash_on_pickup')} 
              onCheckedChange={(c) => handleMethodToggle('cash_on_pickup', c)}
            />
          </div>

          <div className="flex items-center justify-between border rounded-lg p-3">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-500" />
                {t('catalog.paymentOptions.bankTransfer') || 'Bank Transfer'}
              </Label>
              <p className="text-xs text-gray-500">{t('catalog.paymentOptions.bankTransferDesc') || 'Allow customers to pay via bank transfer'}</p>
            </div>
            <Switch 
              checked={currentOptions.includes('bank_transfer')} 
              onCheckedChange={(c) => handleMethodToggle('bank_transfer', c)}
            />
          </div>
          
          {currentOptions.length === 0 && (
            <p className="text-sm text-red-500 font-medium">{t('catalog.paymentOptions.requireMethod') || 'Please select at least one payment method.'}</p>
          )}
        </CardContent>
      )}
    </Card>
  )
}
