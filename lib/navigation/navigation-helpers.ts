import { openDetailFromView } from "./detail-view-navigation"
import { navigateOrAssign, type AppRouterLike } from "./stale-router"

/**
 * Mark navigation as UI-initiated (call before programmatic navigation)
 * Uses timestamp for reliable detection across re-renders
 */
export function markUINavigation(): void {
  if (typeof window !== 'undefined') {
    const timestamp = Date.now().toString()
    try {
      sessionStorage.setItem('uiNavTimestamp', timestamp)
    } catch {
      // Storage restrictions must not prevent navigation.
    }
  }
}

export {
  NAVIGATION_HISTORY_RESET_EVENT,
  requestNavigationHistoryReset,
} from '@/lib/navigation/history-reset'

type DetailOrigin = { siteId?: string; rows: readonly { id: string }[] }

function fromView(href: string, origin?: DetailOrigin) {
  if (!origin) return href
  const pathname = href.split("?")[0]
  const base = pathname.slice(0, pathname.lastIndexOf("/"))
  return openDetailFromView(origin.siteId, href, origin.rows.map(row => `${base}/${row.id}`))
}

interface NavigateToTaskParams {
  taskId: string
  taskTitle: string
  router: AppRouterLike
  origin?: DetailOrigin
}

export function navigateToTask({ taskId, taskTitle, router, origin }: NavigateToTaskParams): void {
  markUINavigation()
  const encodedTitle = encodeURIComponent(taskTitle)
  navigateOrAssign(router, fromView(`/control-center/${taskId}?title=${encodedTitle}`, origin), { markUI: false })
}

interface NavigateToLeadParams {
  leadId: string
  leadName: string
  router: AppRouterLike
  origin?: DetailOrigin
}

export function navigateToLead({ leadId, leadName, router, origin }: NavigateToLeadParams): void {
  markUINavigation()
  const encodedName = encodeURIComponent(leadName)
  navigateOrAssign(router, fromView(`/leads/${leadId}?name=${encodedName}`, origin), { markUI: false })
}

interface NavigateToContentParams {
  contentId: string
  contentTitle: string
  router: AppRouterLike
  origin?: DetailOrigin
}

export function navigateToContent({ contentId, contentTitle, router, origin }: NavigateToContentParams): void {
  markUINavigation()
  const encodedTitle = encodeURIComponent(contentTitle)
  navigateOrAssign(router, fromView(`/content/${contentId}?title=${encodedTitle}`, origin), { markUI: false })
}

interface NavigateToSegmentParams {
  segmentId: string
  segmentName: string
  router: AppRouterLike
  origin?: DetailOrigin
}

export function navigateToSegment({ segmentId, segmentName, router, origin }: NavigateToSegmentParams): void {
  markUINavigation()
  const encodedName = encodeURIComponent(segmentName)
  navigateOrAssign(router, fromView(`/segments/${segmentId}?name=${encodedName}`, origin), { markUI: false })
}

interface NavigateToCampaignParams {
  campaignId: string
  campaignName: string
  router: AppRouterLike
  origin?: DetailOrigin
}

export function navigateToCampaign({ campaignId, campaignName, router, origin }: NavigateToCampaignParams): void {
  markUINavigation()
  const encodedName = encodeURIComponent(campaignName)
  navigateOrAssign(router, fromView(`/campaigns/${campaignId}?name=${encodedName}`, origin), { markUI: false })
}

interface NavigateToAgentParams {
  agentId: string
  agentName: string
  router: AppRouterLike
}

export function navigateToAgent({ agentId, agentName, router }: NavigateToAgentParams): void {
  markUINavigation()
  const encodedName = encodeURIComponent(agentName)
  navigateOrAssign(router, `/agents/${agentId}?name=${encodedName}`, { markUI: false })
}

interface NavigateToRequirementParams {
  requirementId: string
  requirementTitle: string
  router: AppRouterLike
  origin?: DetailOrigin
}

export function navigateToRequirement({ requirementId, requirementTitle, router, origin }: NavigateToRequirementParams): void {
  markUINavigation()
  const encodedTitle = encodeURIComponent(requirementTitle)
  navigateOrAssign(router, fromView(`/requirements/${requirementId}?title=${encodedTitle}`, origin), { markUI: false })
}

interface NavigateToExperimentParams {
  experimentId: string
  experimentName: string
  router: AppRouterLike
}

export function navigateToExperiment({ experimentId, experimentName, router }: NavigateToExperimentParams): void {
  markUINavigation()
  const encodedName = encodeURIComponent(experimentName)
  navigateOrAssign(router, `/experiments/${experimentId}?name=${encodedName}`, { markUI: false })
}

interface NavigateToChatParams {
  conversationId?: string
  agentId?: string
  conversationTitle?: string
  agentName?: string
  router: AppRouterLike
}

export function navigateToChat({ conversationId, agentId, conversationTitle, agentName, router }: NavigateToChatParams): void {
  markUINavigation()
  const params = new URLSearchParams()
  
  if (conversationId) params.set('id', conversationId)
  if (agentId) params.set('agentId', agentId)
  if (conversationTitle) params.set('title', encodeURIComponent(conversationTitle))
  if (agentName) params.set('agentName', encodeURIComponent(agentName))
  
  const queryString = params.toString()
  navigateOrAssign(router, `/chat${queryString ? `?${queryString}` : ''}`, { markUI: false })
}

interface NavigateToControlCenterParams {
  router: AppRouterLike
}

export function navigateToControlCenter({ router }: NavigateToControlCenterParams): void {
  markUINavigation()
  navigateOrAssign(router, '/control-center', { markUI: false })
}

interface NavigateToDealParams {
  dealId: string
  dealName: string
  router: AppRouterLike
  origin?: DetailOrigin
}

export function navigateToDeal({ dealId, dealName, router, origin }: NavigateToDealParams): void {
  markUINavigation()
  const encodedName = encodeURIComponent(dealName)
  navigateOrAssign(router, fromView(`/deals/${dealId}?name=${encodedName}`, origin), { markUI: false })
}

interface NavigateToOrderParams {
  orderId: string
  orderNumber?: string
  router: AppRouterLike
  origin?: DetailOrigin
}

export function navigateToOrder({ orderId, orderNumber, router, origin }: NavigateToOrderParams): void {
  markUINavigation()
  const params = new URLSearchParams()
  if (orderNumber) {
    params.set('title', encodeURIComponent(orderNumber))
  }
  const queryString = params.toString()
  navigateOrAssign(router, fromView(`/orders/${orderId}${queryString ? `?${queryString}` : ''}`, origin), { markUI: false })
}

interface NavigateToShipmentParams {
  shipmentId: string
  router: AppRouterLike
  origin?: DetailOrigin
}

export function navigateToShipment({ shipmentId, router, origin }: NavigateToShipmentParams): void {
  markUINavigation()
  navigateOrAssign(router, fromView(`/shipments/${shipmentId}`, origin), { markUI: false })
}

interface NavigateToPurchaseOrderParams {
  orderId: string
  orderNumber?: string
  basePath?: string
  router: AppRouterLike
}

export function navigateToPurchaseOrder({ orderId, orderNumber, basePath = '/purchases', router }: NavigateToPurchaseOrderParams): void {
  markUINavigation()
  const params = new URLSearchParams()
  if (orderNumber) {
    params.set('title', encodeURIComponent(orderNumber))
  }
  const queryString = params.toString()
  navigateOrAssign(router, `${basePath}/orders/${orderId}${queryString ? `?${queryString}` : ''}`, { markUI: false })
}

interface NavigateToSaleParams {
  saleId: string
  saleName?: string
  action?: string
  router: AppRouterLike
  origin?: DetailOrigin
}

export function navigateToSale({ saleId, saleName, action, router, origin }: NavigateToSaleParams): void {
  markUINavigation()
  const params = new URLSearchParams()
  if (saleName) {
    params.set('title', encodeURIComponent(saleName))
  }
  if (action) {
    params.set('action', action)
  }
  const queryString = params.toString()
  navigateOrAssign(router, fromView(`/sales/${saleId}${queryString ? `?${queryString}` : ''}`, origin), { markUI: false })
}
