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

interface NavigateToTaskParams {
  taskId: string
  taskTitle: string
  router: AppRouterLike
}

export function navigateToTask({ taskId, taskTitle, router }: NavigateToTaskParams): void {
  markUINavigation()
  const encodedTitle = encodeURIComponent(taskTitle)
  navigateOrAssign(router, `/control-center/${taskId}?title=${encodedTitle}`, { markUI: false })
}

interface NavigateToLeadParams {
  leadId: string
  leadName: string
  router: AppRouterLike
}

export function navigateToLead({ leadId, leadName, router }: NavigateToLeadParams): void {
  markUINavigation()
  const encodedName = encodeURIComponent(leadName)
  navigateOrAssign(router, `/leads/${leadId}?name=${encodedName}`, { markUI: false })
}

interface NavigateToContentParams {
  contentId: string
  contentTitle: string
  router: AppRouterLike
}

export function navigateToContent({ contentId, contentTitle, router }: NavigateToContentParams): void {
  markUINavigation()
  const encodedTitle = encodeURIComponent(contentTitle)
  navigateOrAssign(router, `/content/${contentId}?title=${encodedTitle}`, { markUI: false })
}

interface NavigateToSegmentParams {
  segmentId: string
  segmentName: string
  router: AppRouterLike
}

export function navigateToSegment({ segmentId, segmentName, router }: NavigateToSegmentParams): void {
  markUINavigation()
  const encodedName = encodeURIComponent(segmentName)
  navigateOrAssign(router, `/segments/${segmentId}?name=${encodedName}`, { markUI: false })
}

interface NavigateToCampaignParams {
  campaignId: string
  campaignName: string
  router: AppRouterLike
}

export function navigateToCampaign({ campaignId, campaignName, router }: NavigateToCampaignParams): void {
  markUINavigation()
  const encodedName = encodeURIComponent(campaignName)
  navigateOrAssign(router, `/campaigns/${campaignId}?name=${encodedName}`, { markUI: false })
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
}

export function navigateToRequirement({ requirementId, requirementTitle, router }: NavigateToRequirementParams): void {
  markUINavigation()
  const encodedTitle = encodeURIComponent(requirementTitle)
  navigateOrAssign(router, `/requirements/${requirementId}?title=${encodedTitle}`, { markUI: false })
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
}

export function navigateToDeal({ dealId, dealName, router }: NavigateToDealParams): void {
  markUINavigation()
  const encodedName = encodeURIComponent(dealName)
  navigateOrAssign(router, `/deals/${dealId}?name=${encodedName}`, { markUI: false })
}

interface NavigateToOrderParams {
  orderId: string
  orderNumber?: string
  router: AppRouterLike
}

export function navigateToOrder({ orderId, orderNumber, router }: NavigateToOrderParams): void {
  markUINavigation()
  const params = new URLSearchParams()
  if (orderNumber) {
    params.set('title', encodeURIComponent(orderNumber))
  }
  const queryString = params.toString()
  navigateOrAssign(router, `/orders/${orderId}${queryString ? `?${queryString}` : ''}`, { markUI: false })
}

interface NavigateToShipmentParams {
  shipmentId: string
  router: AppRouterLike
}

export function navigateToShipment({ shipmentId, router }: NavigateToShipmentParams): void {
  markUINavigation()
  navigateOrAssign(router, `/shipments/${shipmentId}`, { markUI: false })
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
}

export function navigateToSale({ saleId, saleName, action, router }: NavigateToSaleParams): void {
  markUINavigation()
  const params = new URLSearchParams()
  if (saleName) {
    params.set('title', encodeURIComponent(saleName))
  }
  if (action) {
    params.set('action', action)
  }
  const queryString = params.toString()
  navigateOrAssign(router, `/sales/${saleId}${queryString ? `?${queryString}` : ''}`, { markUI: false })
}
