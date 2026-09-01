/**
 * Mark navigation as UI-initiated (call before programmatic navigation)
 * Uses timestamp for reliable detection across re-renders
 */
export function markUINavigation(): void {
  if (typeof window !== 'undefined') {
    const timestamp = Date.now().toString()
    sessionStorage.setItem('uiNavTimestamp', timestamp)
  }
}

export {
  NAVIGATION_HISTORY_RESET_EVENT,
  requestNavigationHistoryReset,
} from '@/lib/navigation/history-reset'

interface NavigateToTaskParams {
  taskId: string
  taskTitle: string
  router: any
}

export function navigateToTask({ taskId, taskTitle, router }: NavigateToTaskParams): void {
  markUINavigation()
  const encodedTitle = encodeURIComponent(taskTitle)
  router.push(`/control-center/${taskId}?title=${encodedTitle}`)
}

interface NavigateToLeadParams {
  leadId: string
  leadName: string
  router: any
}

export function navigateToLead({ leadId, leadName, router }: NavigateToLeadParams): void {
  markUINavigation()
  const encodedName = encodeURIComponent(leadName)
  router.push(`/leads/${leadId}?name=${encodedName}`)
}

interface NavigateToContentParams {
  contentId: string
  contentTitle: string
  router: any
}

export function navigateToContent({ contentId, contentTitle, router }: NavigateToContentParams): void {
  markUINavigation()
  const encodedTitle = encodeURIComponent(contentTitle)
  router.push(`/content/${contentId}?title=${encodedTitle}`)
}

interface NavigateToSegmentParams {
  segmentId: string
  segmentName: string
  router: any
}

export function navigateToSegment({ segmentId, segmentName, router }: NavigateToSegmentParams): void {
  markUINavigation()
  const encodedName = encodeURIComponent(segmentName)
  router.push(`/segments/${segmentId}?name=${encodedName}`)
}

interface NavigateToCampaignParams {
  campaignId: string
  campaignName: string
  router: any
}

export function navigateToCampaign({ campaignId, campaignName, router }: NavigateToCampaignParams): void {
  markUINavigation()
  const encodedName = encodeURIComponent(campaignName)
  router.push(`/campaigns/${campaignId}?name=${encodedName}`)
}

interface NavigateToAgentParams {
  agentId: string
  agentName: string
  router: any
}

export function navigateToAgent({ agentId, agentName, router }: NavigateToAgentParams): void {
  markUINavigation()
  const encodedName = encodeURIComponent(agentName)
  router.push(`/agents/${agentId}?name=${encodedName}`)
}

interface NavigateToRequirementParams {
  requirementId: string
  requirementTitle: string
  router: any
}

export function navigateToRequirement({ requirementId, requirementTitle, router }: NavigateToRequirementParams): void {
  markUINavigation()
  const encodedTitle = encodeURIComponent(requirementTitle)
  router.push(`/requirements/${requirementId}?title=${encodedTitle}`)
}

interface NavigateToExperimentParams {
  experimentId: string
  experimentName: string
  router: any
}

export function navigateToExperiment({ experimentId, experimentName, router }: NavigateToExperimentParams): void {
  markUINavigation()
  const encodedName = encodeURIComponent(experimentName)
  router.push(`/experiments/${experimentId}?name=${encodedName}`)
}

interface NavigateToChatParams {
  conversationId?: string
  agentId?: string
  conversationTitle?: string
  agentName?: string
  router: any
}

export function navigateToChat({ conversationId, agentId, conversationTitle, agentName, router }: NavigateToChatParams): void {
  markUINavigation()
  const params = new URLSearchParams()
  
  if (conversationId) params.set('id', conversationId)
  if (agentId) params.set('agentId', agentId)
  if (conversationTitle) params.set('title', encodeURIComponent(conversationTitle))
  if (agentName) params.set('agentName', encodeURIComponent(agentName))
  
  const queryString = params.toString()
  router.push(`/chat${queryString ? `?${queryString}` : ''}`)
}

interface NavigateToControlCenterParams {
  router: any
}

export function navigateToControlCenter({ router }: NavigateToControlCenterParams): void {
  markUINavigation()
  router.push('/control-center')
}

interface NavigateToDealParams {
  dealId: string
  dealName: string
  router: any
}

export function navigateToDeal({ dealId, dealName, router }: NavigateToDealParams): void {
  markUINavigation()
  const encodedName = encodeURIComponent(dealName)
  router.push(`/deals/${dealId}?name=${encodedName}`)
}

interface NavigateToOrderParams {
  orderId: string
  orderNumber?: string
  router: any
}

export function navigateToOrder({ orderId, orderNumber, router }: NavigateToOrderParams): void {
  markUINavigation()
  const params = new URLSearchParams()
  if (orderNumber) {
    params.set('title', encodeURIComponent(orderNumber))
  }
  const queryString = params.toString()
  router.push(`/orders/${orderId}${queryString ? `?${queryString}` : ''}`)
}

interface NavigateToShipmentParams {
  shipmentId: string
  router: any
}

export function navigateToShipment({ shipmentId, router }: NavigateToShipmentParams): void {
  markUINavigation()
  router.push(`/shipments/${shipmentId}`)
}

interface NavigateToPurchaseOrderParams {
  orderId: string
  orderNumber?: string
  basePath?: string
  router: any
}

export function navigateToPurchaseOrder({ orderId, orderNumber, basePath = '/purchases', router }: NavigateToPurchaseOrderParams): void {
  markUINavigation()
  const params = new URLSearchParams()
  if (orderNumber) {
    params.set('title', encodeURIComponent(orderNumber))
  }
  const queryString = params.toString()
  router.push(`${basePath}/orders/${orderId}${queryString ? `?${queryString}` : ''}`)
}

interface NavigateToSaleParams {
  saleId: string
  saleName?: string
  action?: string
  router: any
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
  router.push(`/sales/${saleId}${queryString ? `?${queryString}` : ''}`)
}
