"use client"

import React from 'react'
import { cn } from "@/lib/utils"

import { MessagesSkeleton } from "@/app/components/skeletons/messages-skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"
import { User, ChevronDown, ChevronRight, Brain, Loader } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import { markdownComponents } from './utils/markdownComponents'
import { SimpleMessagesViewProps } from './types'

import { EmptyStatePrompts, EMPTY_STATE_TYPEWRITER_PROMPTS } from './components/EmptyStatePrompts'
import { MessageInput } from './components/MessageInput'

import { MessageItem } from './components/MessageItem'
import { ProcessGroupItem } from './components/ProcessGroupItem'
import { CompletedPlanCard } from './components/CompletedPlanCard'
import { StepIndicator } from './components/StepIndicator'
import { BacklogIndicator } from './components/BacklogIndicator'

import { StepCompletedItem } from './components/StepCompletedItem'
import { ArtifactShownItem } from './components/ArtifactShownItem'
import { UserWorkflowMeta } from './components/UserWorkflowMeta'
import { CommandQueueBar } from './components/CommandQueueBar'

import { isProcessGroupLive } from './group-timeline-process'
import { useSimpleMessagesView } from "./use-simple-messages-view"
import { MessageEditDialogs } from "./MessageEditDialogs"
export function SimpleMessagesView(props: SimpleMessagesViewProps) {
const model = useSimpleMessagesView(props)
const { className, activeRobotInstance, isBrowserVisible, hasTopHeaderSpace, skillSelection, setSkillSelection, isDarkMode, message, setMessage, handleMessageChange, textareaRef, userProfile, selectedContext, setSelectedContext, selectedActivity, setSelectedActivity, isStepIndicatorExpanded, setIsStepIndicatorExpanded, isBacklogIndicatorExpanded, setIsBacklogIndicatorExpanded, setIsEditPendingModalOpen, setEditPendingId, setEditPendingMessage, lastUserMessage, imageParameters, videoParameters, audioParameters, handleImageParameterChange, handleVideoParameterChange, handleAudioParameterChange, messagesEndRef, messagesContainerRef, bottomContainerRef, bottomPadding, jumpToLatestLogs, showJumpToLatest, isStartingRobot, isWaitingForResponse, isNewMakinaThinking, hasMessageBeenSent, handleSendMessage, isLoadingLogs, isLoadingMore, collapsedSystemMessages, collapsedToolDetails, expandedToolGroups, toggleSystemMessageCollapse, toggleToolDetails, toggleToolGroup, steps, instancePlans, getCurrentStep, latestRequirementStatus, requirementBacklog, openEditBacklogModal, openEditModal, deleteStep, toggleStepStatus, pausePlan, resumePlan, cancelPlan, canEditOrDeleteStep, openEditPlanModal, assets, deleteAsset, isInstanceStarting, isInstanceRunning, runningUserLog, cancelWorkflow, isCancelling, pendingWork, removePending, sendNow, sendingId, handleScroll, shouldShowNewMakina, processedTimeline, lastProcessGroupId, isEmpty, allStepsCompleted, showFloatingPlanAppendix, showPinnedRunningBubble, showFloatingBacklog } = model
  // Show loading skeleton when loading logs
  if (isLoadingLogs) {
    return (
      <MessagesSkeleton 
        showComposerSkeleton={false} 
        hasTopHeaderSpace={hasTopHeaderSpace} 
        className={cn("flex flex-col w-full min-w-0 h-full min-h-0", className, !className?.includes('absolute') && "relative")}
        isBrowserVisible={isBrowserVisible}
      />
    )
  }

  return (
    <div className={cn("flex flex-col w-full min-w-0 h-full min-h-0", className, !className?.includes('absolute') && "relative")}>
      {/* Floating background orbs - removed per user request */}

      {/* Messages list */}
      <div
        ref={messagesContainerRef}
        className={cn(
          "block flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-none w-full min-w-0 transition-colors duration-300 ease-in-out",
        )}
        style={{ 
          transform: 'translateZ(0)', 
          backfaceVisibility: 'hidden',
          // Prevent the browser from shifting scroll arbitrarily when padding changes
          overflowAnchor: 'none'
        }}
        onScroll={handleScroll}
      >
        <div 
          className="w-full max-w-4xl mx-auto px-4 min-w-0"
        >
          {/* Spacer for sticky header and topbar blur effect */}
          <div className={cn("h-[135px] shrink-0", !hasTopHeaderSpace && "hidden lg:block")} aria-hidden="true" />
          <div className="space-y-6 pt-6 pb-6">
          
            {/* Loading indicator when fetching older logs */}
            {isLoadingMore && (
              <div className="flex justify-center py-2">
                <Loader className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
          
        {(() => {
          if (shouldShowNewMakina) {
            return (
          // New Makina context - show user messages and thinking state
          <>
            {/* Show user message if one was sent */}
            {hasMessageBeenSent && lastUserMessage && (
              <div className="flex flex-col w-full min-w-0 items-end group">
                <div className="flex items-center mb-1 gap-2 justify-end">
                  <span className="text-xs text-muted-foreground">
                    {new Date().toLocaleTimeString()}
                  </span>
                  <span className="text-sm font-medium text-primary">
                    {userProfile?.name || 'User'}
                  </span>
                  <div className="relative">
                    <Avatar className="h-7 w-7 border border-primary/20">
                      {userProfile?.avatar_url && (
                        <AvatarImage 
                          src={userProfile.avatar_url} 
                          alt={userProfile.name || 'User'} 
                        />
                      )}
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {userProfile?.name 
                          ? userProfile.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
                          : <User className="h-4 w-4" />
                        }
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </div>
                
                <div className="w-full min-w-0 overflow-hidden flex justify-end pr-8">
                  <div className="min-w-0 overflow-hidden">
                    <div 
                      className="text-sm text-foreground leading-relaxed prose prose-sm max-w-none dark:prose-invert prose-headings:font-medium prose-p:leading-relaxed prose-pre:bg-muted w-full overflow-hidden break-words rounded-lg p-4 mr-12"
                      style={{ 
                        backgroundColor: isDarkMode ? '#2d2d3d' : '#f0f0f5',
                        border: 'none', 
                        boxShadow: 'none', 
                        outline: 'none',
                        filter: 'none',
                        wordWrap: 'break-word', 
                        overflowWrap: 'break-word', 
                        wordBreak: 'break-word'
                      }}
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={markdownComponents}>
                        {lastUserMessage}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Show thinking indicator using a minimalist process group style */}
            {isNewMakinaThinking && (
              <div className="w-full min-w-0 overflow-hidden">
                <div className="w-full min-w-[min(100%,450px)] overflow-hidden max-w-[calc(100%-80px)] lg:max-w-3xl">
                  <div className="flex items-center gap-2 py-1 text-left text-xs text-muted-foreground">
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-0" />
                    <Brain className="h-3.5 w-3.5 shrink-0" />
                    <span className="font-medium truncate">Thinking</span>
                    <Loader className="h-3.5 w-3.5 shrink-0 text-muted-foreground animate-spin" />
                  </div>
                </div>
              </div>
            )}
          </>
            )
          } else {
            return (
            <>
            {/* Create unified timeline of logs and completed plans */}
            {(() => {
              if (processedTimeline.length === 0) {
                return null
              }
              

              return processedTimeline.map((item, index) => {
                let dateHeader = null;
                const currentDate = new Date(item.timestamp);
                const currentDateStr = currentDate.toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                });
                
                const prevDateStr = index > 0 
                  ? new Date(processedTimeline[index - 1].timestamp).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })
                  : null;

                if (prevDateStr !== currentDateStr) {
                  dateHeader = (
                    <div key={`date-${currentDateStr}-${index}`} className="flex justify-center my-6">
                      <span className="text-xs font-medium text-muted-foreground/60 bg-muted/50 px-3 py-1 rounded-full uppercase tracking-wider">
                        {currentDateStr}
                      </span>
                    </div>
                  );
                }

                let content = null;

                if (item.type === 'process_group') {
                  const group = item.data
                  content = (
                    <ProcessGroupItem
                      key={group.groupId}
                      group={group}
                      isDarkMode={isDarkMode}
                      isExpanded={expandedToolGroups.has(group.groupId)}
                      isLive={group.groupId === lastProcessGroupId && isProcessGroupLive(group) && (isInstanceRunning || isInstanceStarting)}
                      onToggleExpand={toggleToolGroup}
                      collapsedToolDetails={collapsedToolDetails}
                      onToggleToolDetails={toggleToolDetails}
                      isBrowserVisible={isBrowserVisible}
                      onEditPlan={openEditPlanModal}
                    />
                  )
                } else if (item.type === 'log') {
                  const log = item.data
                  const toolNameLower = (log.tool_name || log.toolName)?.toLowerCase()
                  const isStructuredOutput = toolNameLower === 'structured_output'
                  const isShowArtifact = toolNameLower === 'show_artifact'
                  const isStepCompleted = isStructuredOutput && log.message?.includes('event=step_completed')
                  
                  if (isStepCompleted) {
                    content = (
                      <StepCompletedItem
                        key={log.id}
                        log={log}
                        isDarkMode={isDarkMode}
                      />
                    )
                  } else if (isShowArtifact) {
                    if (log.log_type === 'tool_result') {
                      return null // Ignore tool_result since we already render the tool_call
                    }
                    content = (
                      <ArtifactShownItem
                        key={log.id}
                        log={log}
                        isDarkMode={isDarkMode}
                        isBrowserVisible={isBrowserVisible}
                      />
                    )
                  } else {
                    content = (
                      <MessageItem
                        key={log.id}
                        log={log}
                        isDarkMode={isDarkMode}
                        collapsedSystemMessages={collapsedSystemMessages}
                        onToggleSystemMessageCollapse={toggleSystemMessageCollapse}
                        isBrowserVisible={isBrowserVisible}
                        onCancelWorkflow={cancelWorkflow}
                        isCancellingWorkflow={isCancelling}
                      />
                    )
                  }
                } else if (item.type === 'completed_plan') {
                  content = (
                    <CompletedPlanCard 
                      key={`plan-${item.data.id}`}
                      plan={item.data}
                      onEditPlan={openEditPlanModal}
                    />
                  )
                }

                if (!content) return null;

                const timelineItemId = item.type === 'process_group' ? item.data.groupId : item.data.id
                return (
                  <React.Fragment key={`${item.type}-${timelineItemId}`}>
                    {dateHeader}
                    <div data-timeline-item-id={`${item.type}-${timelineItemId}`}>{content}</div>
                  </React.Fragment>
                );
              })
            })()}
            
            {/* Loading indicator when waiting for response using minimalist process group style */}
            {(isWaitingForResponse || isNewMakinaThinking) && (
              <div className="w-full min-w-0 overflow-hidden">
                <div className="w-full min-w-[min(100%,450px)] overflow-hidden max-w-[calc(100%-80px)] lg:max-w-3xl">
                  <div className="flex items-center gap-2 py-1 text-left text-xs text-muted-foreground">
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-0" />
                    <Brain className="h-3.5 w-3.5 shrink-0" />
                    <span className="font-medium truncate">Thinking</span>
                    <Loader className="h-3.5 w-3.5 shrink-0 text-muted-foreground animate-spin" />
                  </div>
                </div>
              </div>
            )}
          </>
            )
          }
        })()}
        
        {/* Extra padding to avoid floating step indicator overlap */}
        <div className="pb-2"></div>
        
        {/* Invisible element for auto-scroll */}
        <div ref={messagesEndRef} />
        </div>
        
        {/* Explicit spacer block for cross-browser compatibility to ensure scrollable space instead of padding-bottom */}
        <div 
          style={{ 
            height: isEmpty ? 0 : `${bottomPadding}px`,
            minHeight: isEmpty ? 0 : `${bottomPadding}px`
          }} 
          className="w-full shrink-0 pointer-events-none opacity-0" 
          aria-hidden="true" 
        >
          &nbsp;
        </div>
        </div>
      </div>

      {/* Center the empty composer in the viewport, accounting for the header and suggestions below it. */}
      <div 
        className={cn(
          "absolute right-0 left-0 bottom-0 z-20 pointer-events-none flex flex-col items-center transition-colors duration-300 ease-in-out chat-input-container !bg-transparent",
          // Half of the header inset (135px) minus half of the carousel + gap (48px) requires 87px of bottom padding.
          isEmpty ? "top-[calc(var(--topbar-height,64px)+71px)] justify-center pb-[calc(var(--topbar-height,64px)+23px)]" : "top-auto justify-end pb-[15px]"
        )}
        style={{
          width: '100%',
          maxWidth: '100%'
        }}
      >
        {/* Background that only appears when not empty, at the bottom */}
        <div 
          className={cn(
            "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background/90 to-transparent transition-opacity duration-500 pointer-events-none",
            isEmpty ? "opacity-0 h-32" : "opacity-100",
            (isStepIndicatorExpanded || isBacklogIndicatorExpanded) ? "h-64" : "h-32"
          )}
        />
        <div 
          ref={bottomContainerRef}
          className={cn(
            "w-full max-w-[800px] px-4 pointer-events-auto relative z-10 !bg-transparent !p-0 mx-auto transition-colors duration-300",
            isEmpty ? "flex flex-col gap-3" : "flex flex-col w-full gap-2"
          )}
        >
        {showJumpToLatest && !isEmpty && (
          <div className="flex w-full shrink-0 justify-center">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="shadow-md gap-1.5 rounded-full border border-border/80 bg-background/95 backdrop-blur-sm"
              onClick={jumpToLatestLogs}
              aria-label="Jump to latest log"
            >
              <ChevronDown size={16} className="opacity-80" aria-hidden />
              Latest
            </Button>
          </div>
        )}
        {/* Floating Backlog Indicator - Expandable */}
        {showFloatingBacklog && requirementBacklog && (
          <div className="w-full relative pointer-events-auto">
            <BacklogIndicator
              backlog={requirementBacklog}
              expanded={isBacklogIndicatorExpanded}
              onToggleExpanded={() => setIsBacklogIndicatorExpanded(!isBacklogIndicatorExpanded)}
              onEditItem={openEditBacklogModal}
              requirementStatus={latestRequirementStatus?.stage}
            />
          </div>
        )}
        {/* Floating Step Indicator - Expandable */}
        {showFloatingPlanAppendix && (
          <div className="w-full relative pointer-events-auto">
            <StepIndicator
              steps={steps}
              instancePlans={instancePlans}
              currentStep={getCurrentStep()}
              allCompleted={allStepsCompleted}
              expanded={isStepIndicatorExpanded}
              onToggleExpanded={() => setIsStepIndicatorExpanded(!isStepIndicatorExpanded)}
              onTogglePause={(planId: string) => {
                pausePlan(planId)
              }}
              onToggleResume={(planId: string) => {
                resumePlan(planId)
              }}
              onCancelPlan={(planId: string) => {
                cancelPlan(planId)
              }}
              onEditPlan={openEditPlanModal}
              onEditStep={openEditModal}
              onDeleteStep={deleteStep}
              onToggleStepStatus={toggleStepStatus}
              canEditOrDeleteStep={canEditOrDeleteStep}
              assets={assets}
              onDeleteAsset={deleteAsset}
              isBrowserVisible={isBrowserVisible}
            />
          </div>
        )}
        <CommandQueueBar
          items={pendingWork}
          onRemove={removePending}
          onEdit={(item) => {
            setEditPendingId(item.id)
            setEditPendingMessage(item.message)
            setIsEditPendingModalOpen(true)
          }}
          onSendNow={sendNow}
          sendingId={sendingId}
        />
        {showPinnedRunningBubble && runningUserLog && (
          <div className="w-full relative pointer-events-auto">
            <div className="mx-auto max-w-[800px] rounded-2xl border border-border/80 bg-background/95 px-4 py-3 shadow-sm">
              <p className="text-sm text-foreground line-clamp-2 break-words">{runningUserLog.message}</p>
              <UserWorkflowMeta
                log={runningUserLog}
                onCancel={cancelWorkflow}
                isCancelling={isCancelling}
              />
            </div>
          </div>
        )}
        <MessageInput
          skillSelection={skillSelection}
          onSkillSelectionChange={setSkillSelection}
          message={message}
          selectedActivity={selectedActivity}
          selectedContext={selectedContext}
          onMessageChange={setMessage}
          handleMessageChange={handleMessageChange}
          onActivityChange={setSelectedActivity}
          onContextChange={setSelectedContext}
          onSubmit={handleSendMessage}
          disabled={isStartingRobot}
          placeholder={activeRobotInstance ? (runningUserLog ? "Queued until the current command finishes..." : "How can I help you today?") : (isStartingRobot ? "Starting agent..." : "How can I help you today?")}
          textareaRef={textareaRef}
          imageParameters={imageParameters}
          videoParameters={videoParameters}
          audioParameters={audioParameters}
          onImageParameterChange={handleImageParameterChange}
          onVideoParameterChange={handleVideoParameterChange}
          onAudioParameterChange={handleAudioParameterChange}
          activeRobotInstance={activeRobotInstance}
          isBrowserVisible={isBrowserVisible}
          placeholderSuggestions={isEmpty ? EMPTY_STATE_TYPEWRITER_PROMPTS : undefined}
          isEmptyState={isEmpty}
        />
        {/* Prompt suggestion carousel - shown below the input when chat is empty */}
        {isEmpty && (
          <div className="w-full animate-in fade-in duration-500 delay-300 mx-auto max-w-[800px] overflow-hidden">
            <EmptyStatePrompts
              onSelectPrompt={(prompt) => {
                setMessage(prompt)
                setTimeout(() => textareaRef.current?.focus(), 0)
              }}
            />
          </div>
        )}
        </div>
      </div>

      <MessageEditDialogs {...model} />
    </div>
  )
}
