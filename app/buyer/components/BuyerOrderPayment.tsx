import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { CreditCard } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { displayValue, formatOrderDate, getOrderSales, paymentAmounts, recordedAmount, type Amount, type BuyerOrderDetail } from "../order-detail-display"
import { BuyerOrderPayAction } from "./BuyerOrderPayAction"
import { orderPaymentState } from "../order-payment"

export function BuyerOrderSummary({ order, formatCurrency }: { order: BuyerOrderDetail; formatCurrency: (amount: Amount) => string }) {
  const { t } = useLocalization()
  return <section aria-label={t('buyer.orders.detail.summary')} className="border-t bg-muted/30 p-4 md:px-6">
      <dl className="space-y-3 text-sm max-w-sm ml-auto tabular-nums">
        {(['subtotal', 'discount_total', 'tax_total', 'shipping_cost'] as const).map(field => {
          const amount = recordedAmount(order[field])
          if (amount === null || (['discount_total', 'tax_total'].includes(field) && amount === 0)) return null
          const key = { subtotal: 'subtotal', discount_total: 'discount', tax_total: 'tax', shipping_cost: 'shippingCost' }[field]
          return <div className="flex justify-between gap-4" key={field}>
            <dt className="text-muted-foreground">{t(`buyer.orders.detail.${key}`)}</dt>
            <dd>{field === 'discount_total' ? '-' : ''}{formatCurrency(amount)}</dd>
          </div>
        })}
        <div className="flex justify-between gap-4 border-t pt-3 text-base font-bold">
          <dt>{t('buyer.orders.detail.total')} <span className="text-xs font-normal text-muted-foreground">{order.currency || 'USD'}</span></dt>
          <dd>{formatCurrency(order.total)}</dd>
        </div>
      </dl>
  </section>
}

export function BuyerOrderPayment({ order, formatCurrency, demo = false }: { order: BuyerOrderDetail; formatCurrency: (amount: Amount) => string; demo?: boolean }) {
  const { t, locale } = useLocalization()
  const sales = getOrderSales(order)
  return <Card className="min-w-0 overflow-hidden">
    <CardHeader className="flex flex-row items-center gap-2 space-y-0 p-4 md:px-6">
      <CreditCard className="h-5 w-5 text-muted-foreground" />
      <CardTitle className="text-base">{t('buyer.orders.detail.payment')}</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4 px-4 pb-4 md:px-6 md:pb-6">
      {!sales.length && <p className="text-sm text-muted-foreground">{t('buyer.orders.detail.noPayment')}</p>}
      {sales.map((sale, index) => {
        const { paid, due } = paymentAmounts(sale)
        const payments = [...(sale.payments || [])].sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0))
        const method = payments[0]?.method || sale.payment_method
        return <section key={index} className="space-y-4 text-sm [&:not(:first-child)]:border-t [&:not(:first-child)]:pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">{t('buyer.orders.detail.paymentStatus')}</span>
            <Badge variant="outline">{displayValue(sale.status, 'buyer.orders.status', t)}</Badge>
          </div>
          {method && <div><p className="text-muted-foreground">{t('buyer.orders.detail.paymentMethod')}</p><p>{displayValue(method, 'buyer.orders.paymentMethod', t)}</p></div>}
          <dl className="border-t pt-3 space-y-2">
            {paid !== null && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t('buyer.orders.detail.paidAmount')}</dt><dd className="font-medium">{formatCurrency(paid)}</dd></div>}
            {due !== null && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t('buyer.orders.detail.amountDue')}</dt><dd className="font-medium">{formatCurrency(due)}</dd></div>}
          </dl>
          {payments.length > 0 && <details className="border-t pt-3">
            <summary className="cursor-pointer font-medium">{t('buyer.orders.detail.paymentHistory')}</summary>
            <ul className="divide-y mt-2">{payments.map((payment, i) => <li key={payment.id || i} className="py-3 flex flex-wrap justify-between gap-2">
              <div className="space-y-1">
                {formatOrderDate(payment.date, locale) && <time className="block text-muted-foreground" dateTime={payment.date}>{formatOrderDate(payment.date, locale)}</time>}
                {payment.method && <span>{displayValue(payment.method, 'buyer.orders.paymentMethod', t)}</span>}
              </div>
              <span className="font-medium">{formatCurrency(payment.amount)}</span>
            </li>)}</ul>
          </details>}
        </section>
      })}
    </CardContent>
    {orderPaymentState(order) && <CardFooter className="block border-t bg-muted/20 p-4 md:px-6">
      <BuyerOrderPayAction key={order.id} order={order} demo={demo} />
    </CardFooter>}
  </Card>
}