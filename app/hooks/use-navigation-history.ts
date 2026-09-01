export { useNavigationHistory } from '@/app/hooks/use-breadcrumb-history'
export type { HistoryItem } from '@/lib/navigation/breadcrumb-engine'
export {
  markUINavigation,
  requestNavigationHistoryReset,
  NAVIGATION_HISTORY_RESET_EVENT,
  navigateToTask,
  navigateToLead,
  navigateToContent,
  navigateToSegment,
  navigateToCampaign,
  navigateToAgent,
  navigateToRequirement,
  navigateToExperiment,
  navigateToChat,
  navigateToControlCenter,
  navigateToDeal,
  navigateToOrder,
  navigateToShipment,
  navigateToPurchaseOrder,
  navigateToSale,
} from '@/lib/navigation/navigation-helpers'
