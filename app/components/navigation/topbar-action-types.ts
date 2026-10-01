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
  segments: Array<{ id: string; name: string; description: string }>;
  propSegments?: Array<{ id: string; name: string; description: string }>;
  requirements: Array<{ id: string; title: string; description: string }>;
  campaigns: Array<{ id: string; title: string; description: string }>;
  isDealsPage?: boolean;
  isQuotationsPage?: boolean;
  isSettingsPage?: boolean;
  onCreateSale?: () => void;
  onCreateDeal?: () => void;
  viewMode?: string;
}
