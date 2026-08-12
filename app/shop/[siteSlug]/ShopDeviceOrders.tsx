"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"
import { buildPublicDocPath } from "@/app/documents/public-token"
import { withInternalFrom } from "@/app/documents/internal-back"
import { resolveItemImage } from "@/app/lib/image-utils"
import { CommerceProductGrid } from "@/app/components/commerce/CommerceProductGrid"
import { getOrderByPublicToken } from "@/app/orders/send-actions"
import type { DeviceOrder, DeviceOrderItem } from "@/app/commerce/device-order-storage"
import {
  rememberDeviceOrder,
  sortDeviceOrderItemsForDisplay,
} from "@/app/commerce/device-order-storage"

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500 text-white",
  in_progress: "bg-blue-600 text-white",
  completed: "bg-emerald-600 text-white",
  cancelled: "bg-gray-600 text-white",
  draft: "bg-gray-600 text-white",
}

function OrderThumbMosaic({ items }: { items: DeviceOrderItem[] }) {
  const sorted = sortDeviceOrderItemsForDisplay(items)
  const thumbs = sorted.slice(0, 4)
  const count = thumbs.length

  if (count === 0) {
    return <div className="absolute inset-0 bg-muted" />
  }

  if (count === 1) {
    return (
      <img
        src={resolveItemImage({ name: thumbs[0].name, image_url: thumbs[0].imageUrl }, "card")}
        alt=""
        onError={(e) => {
          e.currentTarget.style.opacity = "0"
        }}
        className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
      />
    )
  }

  if (count === 2) {
    return (
      <div className="absolute inset-0 grid grid-cols-2 gap-0.5">
        {thumbs.map((item, i) => (
          <img
            key={`${item.name}-${i}`}
            src={resolveItemImage({ name: item.name, image_url: item.imageUrl }, "card")}
            alt=""
            onError={(e) => {
              e.currentTarget.style.opacity = "0"
            }}
            className="h-full w-full object-cover object-center"
          />
        ))}
      </div>
    )
  }

  if (count === 3) {
    return (
      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0.5">
        <img
          src={resolveItemImage({ name: thumbs[0].name, image_url: thumbs[0].imageUrl }, "card")}
          alt=""
          onError={(e) => {
            e.currentTarget.style.opacity = "0"
          }}
          className="row-span-2 h-full w-full object-cover object-center"
        />
        <img
          src={resolveItemImage({ name: thumbs[1].name, image_url: thumbs[1].imageUrl }, "card")}
          alt=""
          onError={(e) => {
            e.currentTarget.style.opacity = "0"
          }}
          className="h-full w-full object-cover object-center"
        />
        <img
          src={resolveItemImage({ name: thumbs[2].name, image_url: thumbs[2].imageUrl }, "card")}
          alt=""
          onError={(e) => {
            e.currentTarget.style.opacity = "0"
          }}
          className="h-full w-full object-cover object-center"
        />
      </div>
    )
  }

  return (
    <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0.5">
      {thumbs.slice(0, 4).map((item, i) => (
        <img
          key={`${item.name}-${i}`}
          src={resolveItemImage({ name: item.name, image_url: item.imageUrl }, "card")}
          alt=""
          onError={(e) => {
            e.currentTarget.style.opacity = "0"
          }}
          className="h-full w-full object-cover object-center"
        />
      ))}
    </div>
  )
}

function DeviceOrderCard({
  order,
  fromHref,
}: {
  order: DeviceOrder
  fromHref: string
}) {
  const { t } = useLocalization()
  const { formatPrice } = useDisplayCurrency()
  const href = withInternalFrom(
    buildPublicDocPath("so", order.publicAccessToken),
    fromHref
  )
  const statusKey = (order.status || "pending").toLowerCase()
  const statusLabel =
    t(`orders.status.${statusKey}`) === `orders.status.${statusKey}`
      ? statusKey.replace("_", " ").toUpperCase()
      : t(`orders.status.${statusKey}`)
  const createdLabel = order.createdAt
    ? format(new Date(order.createdAt), "MMM d, yyyy")
    : null
  const items = order.items || []
  const heroName =
    sortDeviceOrderItemsForDisplay(items)[0]?.name ||
    order.orderNumber ||
    "Order"

  return (
    <div className="group min-w-0 w-full flex flex-col">
      <div className="relative w-full overflow-hidden rounded-2xl bg-muted shrink-0 aspect-[4/3]">
        <Link href={href} className="absolute inset-0 z-0" aria-label={heroName}>
          <OrderThumbMosaic items={items} />
        </Link>

        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/55 via-black/20 to-transparent"
          aria-hidden
        />

        <div className="absolute top-3 left-3 z-20 flex flex-col items-start gap-1">
          <span
            className={`rounded-md px-2 py-1 text-[11px] font-bold shadow-sm uppercase tracking-wider ${
              STATUS_STYLES[statusKey] || STATUS_STYLES.pending
            }`}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      <Link href={href} className="pt-3 flex flex-col min-w-0">
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5 truncate">
          {order.orderNumber || order.orderId.slice(0, 8)}
        </span>
        <h3 className="font-bold leading-snug text-foreground text-base md:text-lg line-clamp-2">
          {heroName}
          {items.length > 1
            ? ` +${items.length - 1}`
            : ""}
        </h3>
        <div className="mt-1 text-sm md:text-[15px] font-medium text-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {typeof order.total === "number" && (
            <span>{formatPrice(order.total, order.currency || undefined)}</span>
          )}
          {createdLabel && (
            <span className="text-xs text-muted-foreground font-normal">{createdLabel}</span>
          )}
        </div>
      </Link>
    </div>
  )
}

export function ShopDeviceOrders({
  orders,
  siteId,
  onOrdersHydrated,
}: {
  orders: DeviceOrder[]
  siteId: string
  onOrdersHydrated?: (orders: DeviceOrder[]) => void
}) {
  const { t } = useLocalization()
  const [displayOrders, setDisplayOrders] = useState(orders)

  useEffect(() => {
    setDisplayOrders(orders)
  }, [orders])

  // Backfill thumbs for device orders cached before item snapshots existed
  useEffect(() => {
    if (!siteId) return
    let cancelled = false
    async function hydrate() {
      const need = displayOrders.filter((o) => !o.items?.length)
      if (need.length === 0) return

      const next = [...displayOrders]
      let changed = false

      await Promise.all(
        need.map(async (order) => {
          const res = await getOrderByPublicToken(order.publicAccessToken)
          if (cancelled || res.error || !res.data) return
          const lines = (res.data.items || []) as Array<{
            name?: string
            unit_price?: number
            catalog_item?: { image_url?: string | null; name?: string }
          }>
          const items: DeviceOrderItem[] = lines.map((line) => ({
            name: line.name || line.catalog_item?.name || "Item",
            imageUrl: line.catalog_item?.image_url ?? null,
            unitPrice: typeof line.unit_price === "number" ? line.unit_price : null,
          }))
          if (items.length === 0) return
          const idx = next.findIndex((o) => o.orderId === order.orderId)
          if (idx < 0) return
          const updated = {
            ...next[idx],
            items,
            status: res.data.status ?? next[idx].status,
            total: res.data.total ?? next[idx].total,
            orderNumber: res.data.order_number ?? next[idx].orderNumber,
          }
          next[idx] = updated
          rememberDeviceOrder(siteId, updated)
          changed = true
        })
      )

      if (!cancelled && changed) {
        setDisplayOrders(next)
        onOrdersHydrated?.(next)
      }
    }
    void hydrate()
    return () => {
      cancelled = true
    }
    // Only when order ids / missing items change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, displayOrders.map((o) => `${o.orderId}:${o.items?.length || 0}`).join("|")])

  if (displayOrders.length === 0) return null

  const titleKey = "shop.yourOrders"
  const hintKey = "shop.yourOrdersHint"
  const title = t(titleKey) === titleKey ? "Your orders" : t(titleKey)
  const hint =
    t(hintKey) === hintKey ? "Orders placed on this device" : t(hintKey)
  const orderWord =
    displayOrders.length === 1
      ? t("shop.order") === "shop.order"
        ? "order"
        : t("shop.order")
      : t("shop.orders") === "shop.orders"
        ? "orders"
        : t("shop.orders")

  return (
    <div id="your-orders" className="mb-16 scroll-mt-24">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            {title}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">{hint}</p>
        </div>
        <span className="text-gray-500 font-medium whitespace-nowrap">
          {displayOrders.length} {orderWord}
        </span>
      </div>

      <CommerceProductGrid totalCount={displayOrders.length}>
        {displayOrders.map((order) => (
          <DeviceOrderCard
            key={order.orderId}
            order={order}
            fromHref={`/shop/${siteId}`}
          />
        ))}
      </CommerceProductGrid>
    </div>
  )
}
