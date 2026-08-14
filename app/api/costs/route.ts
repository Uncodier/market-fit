import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { startOfMonth, subDays, subMonths } from "date-fns"
import {
  BILL_COST_STATUSES,
  addCalendarDays,
  aggregateByCategory,
  buildCostCategories,
  buildCostDistribution,
  buildMonthlyCostData,
  costRowsInRange,
  inclusiveEndWithUtcSlack,
  mapPurchasesToCostRows,
  parseDateParam,
  periodTypeFromDays,
  shouldIncludeBillsInCostReport,
  sumCosts,
  toDateOnly,
  type CostTransaction,
  type PurchaseCostRow,
  type PurchaseItemCostRow,
} from "@/lib/costs/aggregate-costs"

export const dynamic = "force-dynamic"

const TRANSACTION_COLUMNS = "id, type, amount, category, date, campaign_id, segment_id"

function emptyPayload(extras: Record<string, unknown> = {}) {
  return {
    totalCosts: {
      actual: 0,
      previous: 0,
      percentChange: 0,
      formattedActual: "0",
      formattedPrevious: "0",
    },
    costCategories: [],
    monthlyData: [],
    costDistribution: [],
    periodType: "custom",
    noData: true,
    ...extras,
  }
}

function applyCostFilters(
  query: any,
  opts: {
    siteId: string
    startDate: string
    endInclusive: string
    campaignId?: string | null
    segmentId?: string | null
    segmentCampaignIds?: string[]
  }
) {
  let next = query
    .eq("site_id", opts.siteId)
    .gte("date", opts.startDate)
    .lte("date", opts.endInclusive)

  if (opts.campaignId && opts.campaignId !== "all") {
    next = next.eq("campaign_id", opts.campaignId)
  }

  if (opts.segmentId && opts.segmentId !== "all") {
    const campaignIds = opts.segmentCampaignIds || []
    if (campaignIds.length > 0) {
      next = next.or(
        `segment_id.eq.${opts.segmentId},campaign_id.in.(${campaignIds.join(",")})`
      )
    } else {
      next = next.eq("segment_id", opts.segmentId)
    }
  }

  return next
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const siteId = searchParams.get("siteId")
    const segmentId = searchParams.get("segmentId")
    const campaignId = searchParams.get("campaignId")
    const startDateParam = searchParams.get("startDate")
    const endDateParam = searchParams.get("endDate")

    if (!siteId) {
      return NextResponse.json({ error: "Site ID is required" }, { status: 400 })
    }

    if (siteId.startsWith("demo-")) {
      return NextResponse.json(
        emptyPayload({
          metadata: { warning: "Demo site detected" },
        })
      )
    }

    const supabase = await createClient()

    const endDate = parseDateParam(endDateParam, new Date())
    const startDate = parseDateParam(startDateParam, subDays(endDate, 30))
    const currentStart = toDateOnly(startDate)
    const currentEnd = toDateOnly(endDate)
    const currentEndInclusive = inclusiveEndWithUtcSlack(currentEnd)

    const periodLength = endDate.getTime() - startDate.getTime()
    const daysDiff = Math.max(1, Math.floor(periodLength / (1000 * 60 * 60 * 24)))
    const periodType = periodTypeFromDays(daysDiff)
    const previousEnd = addCalendarDays(currentStart, -1)
    const previousStart = addCalendarDays(previousEnd, -(daysDiff - 1))

    let segmentCampaignIds: string[] = []
    if (segmentId && segmentId !== "all") {
      const { data: campaignSegments } = await supabase
        .from("campaign_segments")
        .select("campaign_id")
        .eq("segment_id", segmentId)
      segmentCampaignIds = (campaignSegments || [])
        .map((row) => row.campaign_id)
        .filter(Boolean)
    }

    const filterOpts = {
      siteId,
      campaignId,
      segmentId,
      segmentCampaignIds,
    }

    const monthlyStart = startOfMonth(subMonths(endDate, 5))
    const monthlyStartDate = toDateOnly(monthlyStart)
    const includeBills = shouldIncludeBillsInCostReport(campaignId, segmentId)
    const billsQueryStart = previousStart < monthlyStartDate ? previousStart : monthlyStartDate

    const currentQuery = applyCostFilters(
      supabase.from("transactions").select(TRANSACTION_COLUMNS),
      {
        ...filterOpts,
        startDate: currentStart,
        endInclusive: currentEndInclusive,
      }
    )

    const previousQuery = applyCostFilters(
      supabase.from("transactions").select(TRANSACTION_COLUMNS),
      {
        ...filterOpts,
        startDate: previousStart,
        endInclusive: previousEnd,
      }
    )

    const monthlyQuery = applyCostFilters(
      supabase.from("transactions").select(TRANSACTION_COLUMNS),
      {
        ...filterOpts,
        startDate: monthlyStartDate,
        endInclusive: currentEndInclusive,
      }
    )

    const billsQuery = includeBills
      ? supabase
          .from("purchases")
          .select("id, amount, purchase_date, status")
          .eq("site_id", siteId)
          .in("status", [...BILL_COST_STATUSES])
          .gte("purchase_date", billsQueryStart)
          .lte("purchase_date", currentEndInclusive)
      : Promise.resolve({ data: [] as PurchaseCostRow[], error: null })

    const [
      { data: currentTransactions, error: currentError },
      { data: prevTransactions },
      { data: monthlyTransactions },
      { data: purchases, error: purchasesError },
    ] = await Promise.all([currentQuery, previousQuery, monthlyQuery, billsQuery])

    if (currentError) {
      console.error("Error fetching current transactions:", currentError)
      return NextResponse.json(
        { error: "Failed to fetch transaction data" },
        { status: 500 }
      )
    }

    if (purchasesError) {
      console.error("Error fetching bills:", purchasesError)
      return NextResponse.json(
        { error: "Failed to fetch bill data" },
        { status: 500 }
      )
    }

    let billRows: CostTransaction[] = []
    if (includeBills && purchases && purchases.length > 0) {
      const purchaseIds = purchases.map((purchase) => purchase.id)
      const { data: purchaseItems, error: itemsError } = await supabase
        .from("purchase_items")
        .select("purchase_id, catalog_item_id, subtotal, quantity, unit_cost, catalog_items(kind)")
        .in("purchase_id", purchaseIds)

      if (itemsError) {
        console.error("Error fetching bill line items:", itemsError)
        return NextResponse.json(
          { error: "Failed to fetch bill data" },
          { status: 500 }
        )
      }

      billRows = mapPurchasesToCostRows(
        purchases as PurchaseCostRow[],
        (purchaseItems || []) as PurchaseItemCostRow[]
      )
    }

    const current = [
      ...((currentTransactions || []) as CostTransaction[]),
      ...costRowsInRange(billRows, currentStart, currentEndInclusive),
    ]
    const previous = [
      ...((prevTransactions || []) as CostTransaction[]),
      ...costRowsInRange(billRows, previousStart, previousEnd),
    ]
    const monthly = [
      ...((monthlyTransactions || []) as CostTransaction[]),
      ...costRowsInRange(billRows, monthlyStartDate, currentEndInclusive),
    ]

    const metadata = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      prevStartDate: parseDateParam(previousStart, startDate).toISOString(),
      prevEndDate: parseDateParam(previousEnd, endDate).toISOString(),
      segmentId: segmentId || "all",
      campaignId: campaignId || "all",
    }

    if (current.length === 0 && monthly.length === 0) {
      return NextResponse.json(emptyPayload({ periodType, metadata }))
    }

    const totalCosts = sumCosts(current)
    const prevTotalCosts = sumCosts(previous)
    const percentChange =
      prevTotalCosts > 0 ? ((totalCosts - prevTotalCosts) / prevTotalCosts) * 100 : totalCosts > 0 ? 100 : 0

    const categories = aggregateByCategory(current)
    const prevCategories = aggregateByCategory(previous)
    const costCategories = buildCostCategories(categories, prevCategories)
    const costDistribution = buildCostDistribution(categories, totalCosts)
    const monthlyData = buildMonthlyCostData(monthly, 6, endDate)

    return NextResponse.json({
      totalCosts: {
        actual: totalCosts,
        previous: prevTotalCosts,
        percentChange,
        formattedActual: totalCosts.toLocaleString(),
        formattedPrevious: prevTotalCosts.toLocaleString(),
      },
      costCategories,
      monthlyData,
      costDistribution,
      periodType,
      noData: current.length === 0,
      metadata,
    })
  } catch (error) {
    console.error("Error in Costs API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
