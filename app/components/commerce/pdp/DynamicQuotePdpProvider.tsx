"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { CatalogItem } from "@/app/types"
import { getDynamicPricingConfig } from "@/app/catalog/dynamic-pricing"
import { validateDynamicQuoteFields } from "@/app/components/commerce/DynamicQuoteFieldsForm"
import { getQuotation } from "@/app/quotations/actions"
import { findOrCreateLeadForBuyer } from "@/app/commerce/resolve-buyer-lead"
import { requestDynamicQuote } from "@/app/quotations/dynamic-quote-actions"
import {
  pollDynamicQuoteProgress,
  type DynamicQuoteProgressLog,
} from "@/app/quotations/dynamic-quote-progress"
import { startQuoteCheckout } from "@/app/commerce/quote-cart"
import { usePdpCart } from "./usePdpCart"
import { afterAddToCartHref } from "./pdp-purchase-cta"
import { toast } from "sonner"
import { useAuthContext as useAuth } from "@/app/components/auth/auth-provider"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useRouter } from "next/navigation"

export interface DynamicQuotePdpContextValue {
  item: CatalogItem
  config: NonNullable<ReturnType<typeof getDynamicPricingConfig>>
  values: Record<string, unknown>
  setValues: (values: Record<string, unknown>) => void
  quantity: number
  setQuantity: (qty: number) => void
  email: string
  setEmail: (email: string) => void
  loading: boolean
  quotationId: string | null
  status: string | null
  unitPrice: number | null
  validUntil: string | null
  quotationStatus: string | null
  progressLogs: DynamicQuoteProgressLog[]
  expired: boolean
  canAccept: boolean
  isGuest: boolean
  handleGetQuote: () => Promise<void>
  handleCheckout: () => Promise<void>
  handleAddToCart: () => Promise<void>
  fieldsDisabled: boolean
}

const DynamicQuotePdpContext = createContext<DynamicQuotePdpContextValue | null>(null)

export function useDynamicQuotePdp() {
  const ctx = useContext(DynamicQuotePdpContext)
  if (!ctx) {
    throw new Error("DynamicQuote PDP components must be used within DynamicQuotePdpProvider")
  }
  return ctx
}

interface DynamicQuotePdpProviderProps {
  item: CatalogItem
  backUrl: string
  children: ReactNode
}

type QuoteProgressData = {
  logs?: DynamicQuoteProgressLog[]
  unitPrice?: number | null
  status?: string | null
  validUntil?: string | null
}

export function DynamicQuotePdpProvider({
  item,
  backUrl,
  children,
}: DynamicQuotePdpProviderProps) {
  const { t } = useLocalization()
  const router = useRouter()
  const config = useMemo(() => getDynamicPricingConfig(item), [item])
  const { startBuyNow, addToCartStorage } = usePdpCart(item.site_id)
  const { user } = useAuth()

  const [values, setValues] = useState<Record<string, unknown>>({})
  const [quantity, setQuantity] = useState(1)
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [quotationId, setQuotationId] = useState<string | null>(null)
  const [quotationItemId, setQuotationItemId] = useState<string | null>(null)
  const [progressAccessToken, setProgressAccessToken] = useState<string | null>(
    null
  )
  const [status, setStatus] = useState<string | null>(null)
  const [unitPrice, setUnitPrice] = useState<number | null>(null)
  const [validUntil, setValidUntil] = useState<string | null>(null)
  const [quotationStatus, setQuotationStatus] = useState<string | null>(null)
  const [progressLogs, setProgressLogs] = useState<DynamicQuoteProgressLog[]>([])
  const statusRef = useRef<string | null>(null)
  const unitPriceRef = useRef<number | null>(null)
  const quotationStatusRef = useRef<string | null>(null)
  statusRef.current = status
  unitPriceRef.current = unitPrice
  quotationStatusRef.current = quotationStatus
  const prevStatusRef = useRef<string | null>(null)

  useEffect(() => {
    if (user?.email) setEmail(user.email)
  }, [user?.email])

  useEffect(() => {
    if (!quotationId) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let inFlight = false
    const deadline = Date.now() + 2 * 60 * 1000

    const isTerminal = () =>
      ["priced", "awaiting_authorization", "failed"].includes(
        statusRef.current || ""
      ) ||
      ["accepted", "rejected", "expired", "cancelled"].includes(
        quotationStatusRef.current || ""
      )

    const schedule = (delay: number) => {
      if (!cancelled && !isTerminal() && Date.now() < deadline) {
        timer = setTimeout(poll, delay)
      }
    }

    const poll = async () => {
      if (cancelled || inFlight || isTerminal() || Date.now() >= deadline) {
        return
      }
      if (document.visibilityState === "hidden" || !navigator.onLine) {
        schedule(10_000)
        return
      }

      inFlight = true
      const currentStatus = statusRef.current
      const hasPrice = (unitPriceRef.current ?? 0) > 0
      const needsSync =
        Boolean(quotationItemId) &&
        (!hasPrice ||
          currentStatus === "processing" ||
          !currentStatus)

      try {
        if (needsSync && quotationItemId && progressAccessToken) {
          const progress = await pollDynamicQuoteProgress(
            quotationItemId,
            progressAccessToken
          )
          if (cancelled) return
          const progressData = progress.data as QuoteProgressData | undefined
          if (progressData?.logs) setProgressLogs(progressData.logs)
          if (progressData?.unitPrice != null && progressData.unitPrice > 0) {
            setUnitPrice(progressData.unitPrice)
            unitPriceRef.current = progressData.unitPrice
          }
          if (progressData?.status) {
            setStatus(progressData.status)
            statusRef.current = progressData.status
          }
          if (progressData?.validUntil) {
            setValidUntil(progressData.validUntil)
          }
        }

        const res = await getQuotation(quotationId)
        if (cancelled || res.error || !res.data) return
        setQuotationStatus(res.data.status)
        quotationStatusRef.current = res.data.status
        const line = (res.data.items || []).find(
          (i: { catalog_item_id?: string }) => i.catalog_item_id === item.id
        )
        const dq = line?.metadata?.dynamic_quote
        if (line?.unit_price != null && Number(line.unit_price) > 0) {
          setUnitPrice(Number(line.unit_price))
          unitPriceRef.current = Number(line.unit_price)
          const nextStatus = dq?.status || "priced"
          setStatus(nextStatus)
          statusRef.current = nextStatus
        } else if (dq?.status === "processing" || dq?.status === "failed") {
          setStatus(dq.status)
          statusRef.current = dq.status
        }
        if (res.data.valid_until) setValidUntil(res.data.valid_until)
        if (line?.id && !quotationItemId) setQuotationItemId(line.id)
      } finally {
        inFlight = false
        schedule((unitPriceRef.current ?? 0) > 0 ? 4000 : 2000)
      }
    }

    void poll()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [quotationId, quotationItemId, progressAccessToken, item.id])

  useEffect(() => {
    if (
      prevStatusRef.current === "processing" &&
      status &&
      status !== "processing"
    ) {
      if (status === "priced" || status === "awaiting_authorization") {
        toast.success(t("pdp.dynamicQuote.ready") || "Quote ready")
      }
    }
    prevStatusRef.current = status
  }, [status, t])

  const expired =
    validUntil && !Number.isNaN(new Date(validUntil).getTime())
      ? new Date(validUntil) < new Date()
      : false

  const canAccept =
    !expired &&
    unitPrice != null &&
    unitPrice > 0 &&
    (status === "priced" || status === "awaiting_authorization") &&
    (!config?.requires_authorization || quotationStatus === "sent")

  const handleGetQuote = useCallback(async () => {
    if (!config) return
    const guest = !user
    const validationError = validateDynamicQuoteFields(config, values, t)
    if (validationError) {
      toast.error(validationError)
      return
    }
    if (guest && !email.trim()) {
      toast.error("Email is required to request a quote")
      return
    }

    setLoading(true)
    try {
      const emailToUse = guest ? email.trim() : user?.email || ""
      const leadRes = await findOrCreateLeadForBuyer({
        siteId: item.site_id,
        email: emailToUse,
        name: user?.user_metadata?.full_name || emailToUse,
        buyerUserId: user?.id || null,
      })
      if (leadRes.error || !leadRes.lead) {
        throw new Error(leadRes.error || "Failed to resolve buyer")
      }

      const res = await requestDynamicQuote({
        siteId: item.site_id,
        catalogItemId: item.id,
        leadId: leadRes.lead.id,
        quantity,
        fieldValues: values,
      })

      if (res.error && !res.data?.quotationId) {
        throw new Error(res.error)
      }
      if (!res.data?.quotationId) {
        throw new Error("Quote request did not return a quotation")
      }

      setQuotationId(res.data.quotationId)
      if (res.data.quotationItemId) setQuotationItemId(res.data.quotationItemId)
      if (res.data.progressAccessToken) {
        setProgressAccessToken(res.data.progressAccessToken)
      }
      setStatus(res.data.status || "processing")
      if (res.data.unitPrice != null) setUnitPrice(res.data.unitPrice)
      if (res.data.validUntil) setValidUntil(res.data.validUntil)
      if (res.data.status === "processing" || !res.data.status) {
        setProgressLogs([
          {
            id: "starting",
            logType: "status",
            text: t("pdp.dynamicQuote.calculating") || "Calculating your quote...",
            createdAt: new Date().toISOString(),
          },
        ])
      }

      if (res.data.status === "awaiting_authorization") {
        toast.message(t("pdp.dynamicQuote.pendingApproval") || "Quote pending seller approval")
      } else if (res.data.status === "priced") {
        toast.success(t("pdp.dynamicQuote.ready") || "Quote ready")
      }
    } catch (err: unknown) {
      console.error("DynamicQuotePdpPanel handleGetQuote error:", err)
      toast.error(
        err instanceof Error
          ? err.message
          : t("pdp.dynamicQuote.failed") || "Failed to request quote"
      )
    } finally {
      setLoading(false)
    }
  }, [config, values, email, item, user, quantity, t])

  const pricedItem = useCallback((): CatalogItem | null => {
    if (unitPrice == null || unitPrice <= 0) return null
    return { ...item, target_sale_price: unitPrice } as CatalogItem
  }, [item, unitPrice])

  const handleCheckout = useCallback(async () => {
    const quoteItem = pricedItem()
    if (!quotationId || !quoteItem) return
    setLoading(true)
    try {
      if (quotationStatus === "sent") {
        const res = await getQuotation(quotationId)
        if (res.error || !res.data) throw new Error(res.error || "Quotation not found")
        const path = startQuoteCheckout(res.data, { returnTo: backUrl })
        router.push(path)
      } else {
        startBuyNow(quoteItem, quantity, backUrl)
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to checkout with quote")
    } finally {
      setLoading(false)
    }
  }, [pricedItem, quotationId, quotationStatus, startBuyNow, quantity, backUrl, router])

  const handleAddToCart = useCallback(async () => {
    const quoteItem = pricedItem()
    if (!quotationId || !quoteItem) return
    setLoading(true)
    try {
      addToCartStorage(quoteItem, quantity)
      toast.success(
        `${quoteItem.name} ${t("marketplace.addedToCart") || "added to cart"}`
      )
      router.push(afterAddToCartHref(backUrl))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add quote to cart")
    } finally {
      setLoading(false)
    }
  }, [pricedItem, quotationId, addToCartStorage, quantity, t, router, backUrl])

  if (!config) {
    return <>{children}</>
  }

  const value: DynamicQuotePdpContextValue = {
    item,
    config,
    values,
    setValues,
    quantity,
    setQuantity,
    email,
    setEmail,
    loading,
    quotationId,
    status,
    unitPrice,
    validUntil,
    quotationStatus,
    progressLogs,
    expired: Boolean(expired),
    canAccept: Boolean(canAccept),
    isGuest: !user,
    handleGetQuote,
    handleCheckout,
    handleAddToCart,
    fieldsDisabled: loading || (status === "processing" && Boolean(quotationId)),
  }

  return (
    <DynamicQuotePdpContext.Provider value={value}>
      {children}
    </DynamicQuotePdpContext.Provider>
  )
}
