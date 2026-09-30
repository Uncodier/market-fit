import { createRef } from 'react'
import type { useSimpleMessagesView } from '@/app/components/simple-messages-view/use-simple-messages-view'

type MessagesViewModel = ReturnType<typeof useSimpleMessagesView>

export function createMessagesViewModel(): MessagesViewModel {
  return {
    className: '', activeRobotInstance: undefined, isBrowserVisible: false, hasTopHeaderSpace: true,
    skillSelection: { skill_mode: 'auto', skill_slugs: [] }, setSkillSelection: jest.fn(),
    isDarkMode: false, message: '', setMessage: jest.fn(), handleMessageChange: jest.fn(),
    textareaRef: createRef<HTMLTextAreaElement>(), userProfile: null,
    selectedContext: { leads: [], contents: [], requirements: [], tasks: [], campaigns: [], quotations: [], deals: [], records: [] },
    setSelectedContext: jest.fn(), selectedActivity: 'ask', setSelectedActivity: jest.fn(),
    isStepIndicatorExpanded: false, setIsStepIndicatorExpanded: jest.fn(),
    isBacklogIndicatorExpanded: false, setIsBacklogIndicatorExpanded: jest.fn(),
    isEditPendingModalOpen: false, setIsEditPendingModalOpen: jest.fn(),
    editPendingId: '', setEditPendingId: jest.fn(), editPendingMessage: '', setEditPendingMessage: jest.fn(),
    lastUserMessage: '',
    imageParameters: { format: 'PNG', aspectRatio: '1:1', quality: 'hd' },
    videoParameters: { aspectRatio: '16:9', resolution: '720p', duration: 6 },
    audioParameters: { format: 'MP3' },
    handleImageParameterChange: jest.fn(), handleVideoParameterChange: jest.fn(), handleAudioParameterChange: jest.fn(),
    messagesEndRef: createRef<HTMLDivElement>(), messagesContainerRef: createRef<HTMLDivElement>(),
    bottomContainerRef: createRef<HTMLDivElement>(), bottomPadding: 0,
    jumpToLatestLogs: jest.fn(), showJumpToLatest: false, isStartingRobot: false,
    isWaitingForResponse: false, isNewMakinaThinking: false, hasMessageBeenSent: false,
    handleSendMessage: jest.fn().mockResolvedValue(undefined), isLoadingLogs: false, isLoadingMore: false,
    collapsedSystemMessages: new Set<string>(), collapsedToolDetails: new Set<string>(), expandedToolGroups: new Set<string>(),
    toggleSystemMessageCollapse: jest.fn(), toggleToolDetails: jest.fn(), toggleToolGroup: jest.fn(),
    steps: [], instancePlans: [], getCurrentStep: jest.fn(), latestRequirementStatus: null, requirementBacklog: null,
    isEditBacklogModalOpen: false, editBacklogTitle: '', setEditBacklogTitle: jest.fn(),
    openEditBacklogModal: jest.fn(), closeEditBacklogModal: jest.fn(), saveBacklogItem: jest.fn(),
    isEditModalOpen: false, editTitle: '', editDescription: '', setEditTitle: jest.fn(), setEditDescription: jest.fn(),
    openEditModal: jest.fn(), closeEditModal: jest.fn(), saveStep: jest.fn(), deleteStep: jest.fn(),
    toggleStepStatus: jest.fn(), pausePlan: jest.fn(), resumePlan: jest.fn(), cancelPlan: jest.fn(), canEditOrDeleteStep: jest.fn(),
    isEditPlanModalOpen: false, editPlanTitle: '', editPlanDescription: '',
    setEditPlanTitle: jest.fn(), setEditPlanDescription: jest.fn(), openEditPlanModal: jest.fn(), closeEditPlanModal: jest.fn(), savePlan: jest.fn(),
    assets: [], deleteAsset: jest.fn(), isInstanceStarting: false, isInstanceRunning: false, runningUserLog: null,
    cancelWorkflow: jest.fn(), isCancelling: false, pendingWork: [], removePending: jest.fn(), editPending: jest.fn(),
    sendNow: jest.fn(), sendingId: null, handleScroll: jest.fn(), shouldShowNewMakina: true, processedTimeline: [],
    lastProcessGroupId: undefined, isEmpty: true, allStepsCompleted: false,
    showFloatingPlanAppendix: false, showPinnedRunningBubble: false, showFloatingBacklog: false,
  }
}