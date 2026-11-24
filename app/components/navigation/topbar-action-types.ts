import type { CampaignOption, SegmentOption } from './use-topbar-options'

export interface TopBarActionsProps {
  isDashboardPage: boolean;
  isSegmentsPage: boolean;
  isExperimentsPage: boolean;
  isRequirementsPage: boolean;
  isLeadsPage: boolean;
  isAgentsPage: boolean;
  isAssetsPage: boolean;
  isContentPage: boolean;
  isControlCenterPage: boolean;
  isCampaignsPage: boolean;
  isSalesPage: boolean;
  isRecordsPage?: boolean;
  isRobotsPage: boolean;
  isSecurityPage: boolean;
  isAccountingPage?: boolean;
  isFinancePage?: boolean;
  isJournalEntriesPage?: boolean;
  dashboardActiveTab?: string;
  segmentData?: {
    id: string;
    activeTab: string;
    isAnalyzing: boolean;
    isGeneratingTopics: boolean;
    openAIModal: (type: "analysis" | "icp" | "topics") => void;
  } | null;
  requirementData?: {
    id: string;
    isBuilding: boolean;
    hasRequirementStatus: boolean;
  } | null;
  contentData?: {
    id: string;
    type: string;
    status: string;
  } | null;
  priceListData?: {
    id: string;
    is_active: boolean;
  } | null;
  segments?: SegmentOption[];
  campaigns?: CampaignOption[];
  isDealsPage?: boolean;
  isQuotationsPage?: boolean;
  isSettingsPage?: boolean;
  onCreateSale?: () => void;
  onCreateDeal?: () => void;
  viewMode?: string;
}
