import { Tabs } from "@/app/components/ui/tabs"

import { Globe, ExternalLink, RotateCw, Monitor, Laptop, Tablet, Smartphone, Download, Archive, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "@/app/components/ui/icons"

import { ResponsiveTabsList } from "@/app/components/ui/responsive-tabs-list"

import { SimpleMessagesView } from "@/app/components/simple-messages-view"

import { BrowserSkeleton } from "@/app/components/skeletons/browser-skeleton"

import dynamic from "next/dynamic"
import { WorkflowPanel } from '@/app/components/workflows/workflow-panel'

import { cn } from "@/lib/utils"
const ZipViewer = dynamic(
  () => import("@/app/components/simple-messages-view/components/ZipViewer").then((m) => m.ZipViewer),
  { ssr: false }
)
const ImprentaPanel = dynamic(
  () => import("@/app/components/agents/imprenta-panel").then((m) => m.ImprentaPanel),
  { ssr: false }
)

import { getScreenMetadata } from "./screen-metadata"
import type { useWorkspaceTabs } from "./use-workspace-tabs"

export function RobotsWorkspace(input: ReturnType<typeof useWorkspaceTabs>) {
  const { isCanvasMode, workspaceTabs, activeWorkspaceTab, handleWorkspaceTabChange, hasBrowserContent, isMobileBrowserVisible, isBrowserVisible, isChatHidden, desktopToolbarRef, hasRequirementPreview, activeBrowserTab, isZipUrl, activeUrlToDisplay, selectedFilePath, iframeRef, displayedIframeUrl, desktopDeviceControlsRef, setViewportSize, viewportSize, allArtifactItems, desktopTabsWidth, desktopWorkspaceTabs, setDesktopTabsPreferredWidth, desktopLayoutToggleRef, setWorkspaceLayout, containerRef, isMobile, scale, isResuming, isInstanceStarting, latestPreviewUrl, latestSourceCodeUrl, artifacts, isActivityRobot, hasMessageBeenSent, isInstanceRunning, requirementPreviewFrameKey, setSelectedFilePath, artifactReloadCounter, theme, rawActiveUrlToDisplay, t, handleIframeLoad, iframeSrc, isPreviewHidden, viewMode, activeRobotInstance, currentSite, siteChangeKey, setHasMessageBeenSent, handleNewInstanceCreated } = input
  return (<>
      <div className={`absolute inset-0 flex flex-col min-h-0 ${isCanvasMode ? 'overflow-visible' : 'overflow-hidden'}`}>
        {!isCanvasMode && workspaceTabs.length > 1 && (
          <div
            className="absolute inset-x-0 z-30 flex items-center px-3 py-1.5 lg:hidden"
            style={{ top: 'calc(var(--topbar-height, 64px) + 71px)' }}
          >
            <Tabs
              value={activeWorkspaceTab}
              onValueChange={handleWorkspaceTabChange}
              className="w-full min-w-0"
            >
              <ResponsiveTabsList
                tabs={workspaceTabs}
                activeTab={activeWorkspaceTab}
                onTabChange={handleWorkspaceTabChange}
                className="w-auto rounded-full border border-border/40 bg-background/35 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/35"
                containerClassName="justify-center"
              />
            </Tabs>
          </div>
        )}

        <div className={`flex-1 flex flex-col min-h-0 ${isCanvasMode ? 'bg-transparent' : 'bg-background'} transition-colors duration-300 ease-in-out ${isCanvasMode ? 'overflow-visible' : 'overflow-hidden'}`}>
          <div className={cn(
            "flex flex-col lg:flex-row flex-1 min-h-0",
            isCanvasMode ? "overflow-visible" : "overflow-hidden lg:pt-0",
            !isCanvasMode && workspaceTabs.length > 1 && "pt-[52px]",
          )}>
            {hasBrowserContent && (
              <div className={cn(
                "w-full iframe-container flex-col shrink-0 min-h-0 overflow-hidden relative",
                isMobileBrowserVisible ? "flex" : "hidden",
                isBrowserVisible ? "lg:flex" : "lg:hidden",
                isChatHidden ? "lg:w-full" : "lg:w-2/3",
              )}>
                <div className="grid grid-rows-[1fr] lg:grid-rows-[auto_1fr] m-0 bg-card absolute inset-x-0 bottom-0 top-[calc(var(--topbar-height,64px)+71px)] overflow-hidden">
                  <div
                    ref={desktopToolbarRef}
                    className="hidden h-11 shrink-0 lg:grid grid-cols-[minmax(33%,1fr)_auto_auto_auto] items-center gap-2 px-3 py-1.5 border-b border-black/5 dark:border-white/5 bg-background"
                  >
                    {hasRequirementPreview && activeBrowserTab.kind !== 'artifact' ? (
                      <div className="flex min-w-0 items-center gap-2 bg-black/5 dark:bg-white/10 border border-transparent rounded-full px-2.5 py-1">
                        {isZipUrl ? (
                          <>
                            <div className="flex items-center gap-1.5 flex-1 min-w-0 text-xs text-muted-foreground">
                              <Archive className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{activeUrlToDisplay.split('/').pop()?.split('?')[0] || 'source-code.zip'}</span>
                              {selectedFilePath && (
                                <>
                                  <span className="text-muted-foreground/30 mx-0.5">/</span>
                                  <span className="truncate text-foreground font-medium">{selectedFilePath}</span>
                                </>
                              )}
                            </div>
                            <button
                              onClick={() => window.open(activeUrlToDisplay, '_blank')}
                              className="shrink-0 h-6 w-6 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                              title="Download Zip"
                            >
                              <Download className="h-3 w-3" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                const frame = iframeRef.current
                                if (frame) frame.src = frame.src
                              }}
                              className="shrink-0 h-6 w-6 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                              title="Refresh"
                            >
                              <RotateCw className="h-3.5 w-3.5" />
                            </button>
                            <Globe className="h-3 w-3 text-muted-foreground shrink-0 ml-1" />
                            <input
                              type="text"
                              readOnly
                              value={displayedIframeUrl}
                              className="flex-1 min-w-0 text-xs text-muted-foreground bg-transparent outline-none cursor-default"
                            />
                            <button
                              onClick={() => window.open(displayedIframeUrl, '_blank')}
                              className="shrink-0 h-6 w-6 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                              title="Open in new tab"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="min-w-0" />
                    )}

                    <div ref={desktopDeviceControlsRef} className="min-w-0">
                      {activeBrowserTab.kind !== 'artifact' && !isZipUrl && hasRequirementPreview && (
                        <div className="flex items-center gap-1 bg-black/5 dark:bg-white/10 border border-transparent rounded-full p-0.5 mx-1">
                          {([
                            ['imac', 'Desktop', Monitor],
                            ['macbook', 'Laptop', Laptop],
                            ['ipad', 'Tablet', Tablet],
                            ['iphone', 'Mobile', Smartphone],
                          ] as const).map(([size, label, Icon]) => (
                            <button
                              key={size}
                              onClick={() => setViewportSize(size)}
                              className={cn(
                                "h-6 w-8 flex items-center justify-center rounded-full transition-colors",
                                viewportSize === size
                                  ? "bg-white dark:bg-white/10 shadow-sm text-foreground"
                                  : "text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground",
                              )}
                              title={label}
                            >
                              <Icon className="h-3.5 w-3.5" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <Tabs
                      value={allArtifactItems.find((item) => item.isActive)?.id ?? 'preview'}
                      onValueChange={handleWorkspaceTabChange}
                      className="w-full min-w-0"
                      style={desktopTabsWidth ? { width: `${desktopTabsWidth}px` } : undefined}
                    >
                      <ResponsiveTabsList
                        tabs={desktopWorkspaceTabs}
                        activeTab={allArtifactItems.find((item) => item.isActive)?.id ?? 'preview'}
                        onTabChange={handleWorkspaceTabChange}
                        className="w-auto rounded-full !h-7 !p-0.5"
                        triggerClassName="!h-6 !px-1 !py-0 text-xs"
                        onPreferredWidthChange={setDesktopTabsPreferredWidth}
                      />
                    </Tabs>

                    <button
                      ref={desktopLayoutToggleRef}
                      onClick={() => setWorkspaceLayout(isChatHidden ? 'split' : 'preview')}
                      className="shrink-0 h-7 w-7 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      title={isChatHidden ? "Show Chat" : "Hide Chat"}
                      aria-label={isChatHidden ? "Show Chat" : "Hide Chat"}
                    >
                      {isChatHidden ? <PanelRightOpen className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
                    </button>
                  </div>

                  <div ref={containerRef} className="relative overflow-hidden bg-muted/10 w-full h-full flex items-start justify-center">
                    <div
                      className="relative transition-all duration-300 shrink-0 flex flex-col"
                      style={isMobile || activeBrowserTab.kind === 'artifact' || isZipUrl ? {
                        width: '100%',
                        height: '100%',
                        backgroundColor: 'var(--background)',
                      } : {
                        width: viewportSize === 'imac' ? '1920px'
                          : viewportSize === 'macbook' ? '1440px'
                            : viewportSize === 'ipad' ? '810px'
                              : '390px',
                        transform: `scale(${scale})`,
                        transformOrigin: 'top center',
                        height: scale < 1 ? `calc(100% / ${scale})` : '100%',
                        boxShadow: '0 0 20px rgba(0,0,0,0.05)',
                        borderLeft: '1px solid var(--border)',
                        borderRight: '1px solid var(--border)',
                        backgroundColor: 'var(--background)',
                      }}
                    >
                      {(isResuming || isInstanceStarting) && !latestPreviewUrl && !latestSourceCodeUrl && artifacts.length === 0 ? (
                        <div className="absolute inset-0 flex flex-col">
                          <BrowserSkeleton />
                        </div>
                      ) : (isActivityRobot && hasMessageBeenSent && !isInstanceRunning && !latestPreviewUrl && !latestSourceCodeUrl && artifacts.length === 0) ? (
                        <div className="absolute inset-0 flex flex-col">
                          <BrowserSkeleton />
                        </div>
                      ) : (!!latestPreviewUrl || !!latestSourceCodeUrl || artifacts.length > 0) ? (
                        <div className="absolute inset-0 bg-background robot-browser-session" style={{ isolation: 'isolate', zIndex: 0 }}>
                          {isZipUrl ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background">
                              <ZipViewer
                                key={`${activeUrlToDisplay}|${requirementPreviewFrameKey}`}
                                url={activeUrlToDisplay}
                                className="w-full h-full"
                                onFileSelect={setSelectedFilePath}
                              />
                            </div>
                          ) : activeBrowserTab.kind === 'artifact' ? (
                            <iframe
                              ref={iframeRef}
                              key={`artifact-${activeBrowserTab.screen}-${artifactReloadCounter}-${theme}`}
                              src={rawActiveUrlToDisplay}
                              className="absolute inset-0 w-full h-full border-0 bg-background contained-iframe"
                              title={getScreenMetadata(activeBrowserTab.screen, t).label}
                              allowFullScreen
                              allow="fullscreen; autoplay; camera; microphone; clipboard-read; clipboard-write"
                              style={{ isolation: 'isolate' }}
                              onLoad={(e) => {
                                handleIframeLoad(e)
                              }}
                            />
                          ) : (
                            <iframe
                              ref={iframeRef}
                              key={`${activeUrlToDisplay}|${requirementPreviewFrameKey}`}
                              src={iframeSrc}
                              className="absolute inset-0 w-full h-full border-0 bg-background contained-iframe"
                              title={latestPreviewUrl ? "Preview" : "Source Code"}
                              allowFullScreen
                              allow="fullscreen; autoplay; camera; microphone; clipboard-read; clipboard-write"
                              // The sandbox attribute remains omitted for iframe compatibility.
                              // sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads allow-top-navigation-by-user-activation allow-popups-to-escape-sandbox allow-presentation"
                              style={{
                                isolation: 'isolate'
                              }}
                              onLoad={(e) => {
                                handleIframeLoad(e)
                              }}
                              onError={(e) => {
                                console.error('Iframe error:', e)
                              }}
                            />
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Mobile shows one section at a time; desktop keeps the split workspace. */}
            <div className={cn(
              "w-full mx-auto min-w-0 messages-area flex-col flex-1 min-h-0",
              isCanvasMode ? "flex overflow-visible" : "overflow-hidden",
              !isCanvasMode && (isMobileBrowserVisible ? "hidden" : "flex"),
              !isCanvasMode && (isChatHidden ? "lg:hidden" : "lg:flex"),
              !isCanvasMode && (hasBrowserContent && !isPreviewHidden ? "lg:w-1/3" : "lg:w-full"),
            )}>
              <div className={`flex flex-col m-0 ${isCanvasMode ? 'bg-transparent overflow-visible' : 'bg-background overflow-hidden'} min-w-0 flex-1 min-h-0 relative`}>
                {hasBrowserContent && !isChatHidden && !isCanvasMode && (
                  <div
                    className="absolute left-0 z-20 hidden h-10 items-center px-3 pointer-events-none lg:flex"
                    style={{ top: 'calc(var(--topbar-height, 64px) + 71px)' }}
                  >
                    <button
                      onClick={() => setWorkspaceLayout(isPreviewHidden ? 'split' : 'chat')}
                      className="pointer-events-auto mt-[7px] h-7 w-7 flex items-center justify-center rounded-full border border-black/5 dark:border-white/5 bg-background/80 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/60 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      title={isPreviewHidden ? "Show Preview" : "Hide Preview"}
                      aria-label={isPreviewHidden ? "Show Preview" : "Hide Preview"}
                    >
                      {isPreviewHidden
                        ? <PanelLeftOpen className="h-4 w-4" />
                        : <PanelLeftClose className="h-4 w-4" />}
                    </button>
                  </div>
                )}
                {viewMode === 'imprenta' ? (
                  <div className="h-full min-h-0 absolute inset-0 flex flex-col">
                    <ImprentaPanel activeInstanceId={activeRobotInstance?.id} />
                  </div>
                ) : viewMode === 'workflow' ? (
                  <div className="h-full min-h-0 absolute inset-0 flex flex-col">
                    <WorkflowPanel activeInstanceId={activeRobotInstance?.id} />
                  </div>
                ) : (
                  <SimpleMessagesView
                    key={`${currentSite?.id}-${siteChangeKey}`}
                    className="h-full absolute inset-0"
                    activeRobotInstance={activeRobotInstance}
                    isBrowserVisible={hasBrowserContent}
                    hasTopHeaderSpace
                    onMessageSent={setHasMessageBeenSent}
                    onNewInstanceCreated={handleNewInstanceCreated}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
  </>)
}
