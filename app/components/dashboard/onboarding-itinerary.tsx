"use client"

import { useCallback, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Button } from "@/app/components/ui/button"
import { Progress } from "@/app/components/ui/progress"
import { Badge } from "@/app/components/ui/badge"
import { Skeleton } from "@/app/components/ui/skeleton"
import {
  CheckCircle2, ExternalLink, Users, UploadCloud, Settings, Calendar,
  Code, Globe, Tag, Target, Clock, Palette, Bot, FileText, Sparkles,
  ArrowRight, HelpCircle, Send, User, ChevronDown, ChevronUp, Star, CreditCard, Mail
} from "@/app/components/ui/icons"
import { useOnboardingValidation, type OnboardingTaskId } from "./hooks/use-onboarding-validation"
import { OnboardingModeSelector, type OnboardingMode } from "./onboarding-mode-selector"

interface OnboardingTask {
  id: OnboardingTaskId
  title: string
  description: string
  ctaLabel: string
  onCta: () => void
  estimatedTime: string
  icon: React.ReactNode
  priority: "high" | "medium" | "low"
  modes: OnboardingMode[]
}

interface OnboardingSection {
  title: string
  description: string
  tasks: OnboardingTask[]
}

function parseMinutes(t: string) {
  const m = t.match(/(\d+)\s*min/)
  return m ? parseInt(m[1], 10) : 0
}

function formatTime(minutes: number) {
  if (minutes === 0) return "0 min"
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

const SECTION_MODE_MAP: Record<string, OnboardingMode> = {
  "Inbound Setup": "inbound",
  "Outbound Setup": "outbound",
  "AI Tasks Setup": "ai_tasks",
}

interface OnboardingItineraryProps {
  userName?: string
}

const SECTION_TITLE_KEYS: Record<string, string> = {
  "Inbound Setup": "inbound",
  "Outbound Setup": "outbound",
  "AI Tasks Setup": "aiTasks",
  "General Setup": "general",
}

export function OnboardingItinerary({ userName }: OnboardingItineraryProps) {
  const { t } = useLocalization()
  const router = useRouter()
  const { tasks: onboardingTasks, isLoading, isValidating, toggleTask, markAllDone } = useOnboardingValidation()

  const [selectedMode, setSelectedMode] = useState<OnboardingMode | null>(null)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    "Inbound Setup": false,
    "Outbound Setup": false,
    "AI Tasks Setup": false,
    "General Setup": false,
  })

  const allSections: OnboardingSection[] = useMemo(() => [
    {
      title: "Inbound Setup",
      description: "Capture leads from your website and communication channels",
      tasks: [
        {
          id: "create_campaign",
          title: "Launch your first campaign",
          description: "Create an automated sequence to nurture and convert your inbound leads.",
          ctaLabel: "Create Campaign",
          estimatedTime: "12 min",
          priority: "high",
          icon: <Target className="h-4 w-4 text-gray-700 dark:text-gray-300" />,
          onCta: () => router.push("/campaigns"),
          modes: ["inbound"],
        },
        {
          id: "install_tracking_script",
          title: "Install widget & tracking script",
          description: "Add our tracking code and chat widget to your website to start capturing visitor data.",
          ctaLabel: "Get Script",
          estimatedTime: "5 min",
          priority: "high",
          icon: <Code className="h-4 w-4 text-gray-700 dark:text-gray-300" />,
          onCta: () => router.push("/settings?tab=channels"),
          modes: ["inbound"],
        },
        {
          id: "configure_channels",
          title: "Configure WhatsApp & channels",
          description: "Set up WhatsApp and Email to automatically engage with your inbound leads.",
          ctaLabel: "Setup Channels",
          estimatedTime: "8 min",
          priority: "high",
          icon: <Settings className="h-4 w-4 text-gray-700 dark:text-gray-300" />,
          onCta: () => router.push("/settings?tab=channels"),
          modes: ["inbound"],
        },
      ],
    },
    {
      title: "Outbound Setup",
      description: "Reach out to prospects with targeted campaigns",
      tasks: [
        {
          id: "fine_tune_segments",
          title: "Create audience segments",
          description: "Define targeting rules and attributes to group your prospects for outbound campaigns.",
          ctaLabel: "Create Segments",
          estimatedTime: "10 min",
          priority: "high",
          icon: <Tag className="h-4 w-4 text-gray-700 dark:text-gray-300" />,
          onCta: () => router.push("/segments"),
          modes: ["outbound"],
        },
        {
          id: "import_leads",
          title: "Create people lists",
          description: "Import your contact database or build lists of prospects to target with outbound campaigns.",
          ctaLabel: "Import People",
          estimatedTime: "7 min",
          priority: "high",
          icon: <UploadCloud className="h-4 w-4 text-gray-700 dark:text-gray-300" />,
          onCta: () => router.push("/people"),
          modes: ["outbound"],
        },
        {
          id: "setup_billing",
          title: "Configure email provider",
          description: "Set up your email sending provider and billing to run outbound email campaigns.",
          ctaLabel: "Setup Email",
          estimatedTime: "8 min",
          priority: "high",
          icon: <Mail className="h-4 w-4 text-gray-700 dark:text-gray-300" />,
          onCta: () => router.push("/settings?tab=channels"),
          modes: ["outbound"],
        },
      ],
    },
    {
      title: "AI Tasks Setup",
      description: "Automate workflows with AI agents (Makinas)",
      tasks: [
        {
          id: "configure_agents",
          title: "Configure AI agents",
          description: "Train your Makina AI agents with custom prompts and test their responses.",
          ctaLabel: "Setup Agents",
          estimatedTime: "15 min",
          priority: "high",
          icon: <Bot className="h-4 w-4 text-gray-700 dark:text-gray-300" />,
          onCta: () => router.push("/agents"),
          modes: ["ai_tasks"],
        },
        {
          id: "create_coordination_task",
          title: "Create coordination tasks",
          description: "Schedule AI-driven tasks and workflows to automate team coordination.",
          ctaLabel: "Add Task",
          estimatedTime: "6 min",
          priority: "medium",
          icon: <Calendar className="h-4 w-4 text-gray-700 dark:text-gray-300" />,
          onCta: () => router.push("/requirements"),
          modes: ["ai_tasks"],
        },
        {
          id: "publish_and_feedback",
          title: "Publish & give feedback to agents",
          description: "Publish content and rate agent performance to continuously improve AI responses.",
          ctaLabel: "Manage Content",
          estimatedTime: "15 min",
          priority: "medium",
          icon: <Star className="h-4 w-4 text-gray-700 dark:text-gray-300" />,
          onCta: () => router.push("/content"),
          modes: ["ai_tasks"],
        },
      ],
    },
    {
      title: "General Setup",
      description: "Core configuration required for all modes",
      tasks: [
        {
          id: "setup_branding",
          title: "Configure brand identity",
          description: "Set your brand colors, tone, and voice to ensure consistent experiences.",
          ctaLabel: "Setup Brand",
          estimatedTime: "10 min",
          priority: "medium",
          icon: <Palette className="h-4 w-4 text-gray-700 dark:text-gray-300" />,
          onCta: () => router.push("/context"),
          modes: ["inbound", "outbound", "ai_tasks"],
        },
        {
          id: "set_business_hours",
          title: "Set business hours",
          description: "Define when your team is available for automations and SLA tracking.",
          ctaLabel: "Set Hours",
          estimatedTime: "3 min",
          priority: "medium",
          icon: <Clock className="h-4 w-4 text-gray-700 dark:text-gray-300" />,
          onCta: () => router.push("/context"),
          modes: ["inbound", "outbound", "ai_tasks"],
        },
        {
          id: "pay_first_campaign",
          title: "Setup billing & credits",
          description: "Add payment method or credits to ensure uninterrupted service.",
          ctaLabel: "Setup Billing",
          estimatedTime: "4 min",
          priority: "high",
          icon: <CreditCard className="h-4 w-4 text-gray-700 dark:text-gray-300" />,
          onCta: () => router.push("/billing"),
          modes: ["inbound", "outbound", "ai_tasks"],
        },
        {
          id: "validate_geographic_restrictions",
          title: "Validate geographic restrictions",
          description: "Review and confirm your business operates within legal geographic boundaries.",
          ctaLabel: "Review Settings",
          estimatedTime: "8 min",
          priority: "medium",
          icon: <Globe className="h-4 w-4 text-gray-700 dark:text-gray-300" />,
          onCta: () => router.push("/context"),
          modes: ["inbound", "outbound", "ai_tasks"],
        },
        {
          id: "invite_team",
          title: "Invite team members",
          description: "Collaborate with your teammates and assign roles for better coordination.",
          ctaLabel: "Send Invites",
          estimatedTime: "5 min",
          priority: "medium",
          icon: <Users className="h-4 w-4 text-gray-700 dark:text-gray-300" />,
          onCta: () => router.push("/settings?tab=team"),
          modes: ["inbound", "outbound", "ai_tasks"],
        },
        {
          id: "setup_content",
          title: "Add content library",
          description: "Upload documents, scripts, and resources to power your automations.",
          ctaLabel: "Add Content",
          estimatedTime: "8 min",
          priority: "medium",
          icon: <FileText className="h-4 w-4 text-gray-700 dark:text-gray-300" />,
          onCta: () => router.push("/content"),
          modes: ["inbound", "outbound", "ai_tasks"],
        },
        {
          id: "complete_requirement",
          title: "Complete a requirement",
          description: "Fulfill your first client requirement to test the complete workflow.",
          ctaLabel: "View Requirements",
          estimatedTime: "20 min",
          priority: "high",
          icon: <CheckCircle2 className="h-4 w-4 text-gray-700 dark:text-gray-300" />,
          onCta: () => router.push("/requirements"),
          modes: ["inbound", "outbound", "ai_tasks"],
        },
        {
          id: "personalize_customer_journey",
          title: "Personalize customer journey",
          description: "Define metrics, actions, and tactics for each stage of your customer journey.",
          ctaLabel: "Configure Journey",
          estimatedTime: "18 min",
          priority: "high",
          icon: <Sparkles className="h-4 w-4 text-gray-700 dark:text-gray-300" />,
          onCta: () => router.push("/context"),
          modes: ["inbound", "outbound", "ai_tasks"],
        },
        {
          id: "assign_attribution_link",
          title: "Assign attribution link",
          description: "Track visitor sources by linking sessions to specific segments or campaigns.",
          ctaLabel: "Manage Attribution",
          estimatedTime: "8 min",
          priority: "medium",
          icon: <ExternalLink className="h-4 w-4 text-gray-700 dark:text-gray-300" />,
          onCta: () => router.push("/dashboard?tab=traffic"),
          modes: ["inbound", "outbound", "ai_tasks"],
        },
      ],
    },
  ], [router])

  // Sections visible for the current mode selection
  const visibleSections = useMemo(() => {
    if (!selectedMode) return allSections
    return allSections.filter((s) => s.title === "General Setup" || SECTION_MODE_MAP[s.title] === selectedMode)
  }, [selectedMode, allSections])

  // All tasks across all sections (for overall totals when no mode selected)
  const allFlatTasks = useMemo(() => allSections.flatMap((s) => s.tasks), [allSections])

  // Tasks scoped to the active mode (mode-specific + general), or all tasks when no mode
  const scopedTasks = useMemo(() => {
    if (!selectedMode) return allFlatTasks
    return visibleSections.flatMap((s) => s.tasks)
  }, [selectedMode, visibleSections, allFlatTasks])

  const totalTime = useMemo(() => scopedTasks.reduce((a, t) => a + parseMinutes(t.estimatedTime), 0), [scopedTasks])
  const completedTime = useMemo(() => scopedTasks.reduce((a, t) => a + (onboardingTasks[t.id] ? parseMinutes(t.estimatedTime) : 0), 0), [scopedTasks, onboardingTasks])
  const completedCount = useMemo(() => scopedTasks.filter((t) => onboardingTasks[t.id]).length, [scopedTasks, onboardingTasks])
  const total = scopedTasks.length
  const percent = totalTime > 0 ? Math.round((completedTime / totalTime) * 100) : 0
  const remaining = totalTime - completedTime

  // Per-mode progress for the selector cards (always based on mode-specific tasks only)
  const completedByMode = useMemo(() => {
    const modes: OnboardingMode[] = ["inbound", "outbound", "ai_tasks"]
    return modes.reduce((acc, mode) => {
      const modeTasks = allSections
        .filter((s) => SECTION_MODE_MAP[s.title] === mode)
        .flatMap((s) => s.tasks)
      acc[mode] = modeTasks.filter((t) => onboardingTasks[t.id]).length
      return acc
    }, {} as Partial<Record<OnboardingMode, number>>)
  }, [allSections, onboardingTasks])

  const totalByMode = useMemo(() => {
    const modes: OnboardingMode[] = ["inbound", "outbound", "ai_tasks"]
    return modes.reduce((acc, mode) => {
      acc[mode] = allSections
        .filter((s) => SECTION_MODE_MAP[s.title] === mode)
        .flatMap((s) => s.tasks).length
      return acc
    }, {} as Partial<Record<OnboardingMode, number>>)
  }, [allSections])

  // Mode-aware labels for the KPI widgets
  const modeLabel: Record<OnboardingMode, string> = {
    inbound: t('dashboard.onboarding.mode.inbound') || 'Inbound',
    outbound: t('dashboard.onboarding.mode.outbound') || 'Outbound',
    ai_tasks: t('dashboard.onboarding.mode.aiTasks') || 'AI Tasks',
  }
  const activeModeLabel = selectedMode ? modeLabel[selectedMode] : null

  const getStatus = useCallback(() => {
    if (percent === 100) return { label: t('dashboard.onboarding.status.readyToLaunch') || 'Ready to Launch', emoji: '🚀' }
    if (percent >= 80) return { label: t('dashboard.onboarding.status.almostThere') || 'Almost There', emoji: '🎯' }
    if (percent >= 60) return { label: t('dashboard.onboarding.status.makingProgress') || 'Making Progress', emoji: '⚡' }
    if (percent >= 40) return { label: t('dashboard.onboarding.status.gettingStarted') || 'Getting Started', emoji: '🔥' }
    if (completedCount > 0) return { label: t('dashboard.onboarding.status.justStarted') || 'Just Started', emoji: '🌱' }
    return { label: t('dashboard.onboarding.status.readyToBegin') || 'Ready to Begin', emoji: '✨' }
  }, [percent, completedCount, t])

  const status = getStatus()
  const nextPending = scopedTasks.find((t) => !onboardingTasks[t.id])

  const sendInstructions = useCallback((section: OnboardingSection) => {
    const subject = `Task Assignment: ${section.title}`
    const body = `Hi,\n\nPlease help complete these onboarding tasks:\n\n${section.title}\n${section.description}\n\nTasks:\n${section.tasks.map((t) => `• ${t.title} (${t.estimatedTime})`).join("\n")}\n\nThanks!`
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank")
  }, [])

  const getPriorityColor = (p: string) => {
    if (p === "high") return "destructive"
    if (p === "medium") return "indigo"
    return "secondary"
  }

  if (isLoading || isValidating) {
    return <OnboardingSkeleton />
  }

  return (
    <div className="space-y-6 w-full pb-8">

      {/* Hero card — contains mode selector + KPIs + CTA */}
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/50 dark:via-indigo-950/50 dark:to-purple-950/50">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-gradient-to-br from-blue-400/10 to-purple-400/10 rounded-full font-inter blur-3xl pointer-events-none" />
        <CardContent className="relative p-6 space-y-6">

          {/* Header — greeting */}
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              {(t('dashboard.onboarding.hero.greeting') || 'Hi, {name}! 👋').replace('{name}', userName || 'there')}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {activeModeLabel
                ? (t('dashboard.onboarding.hero.subtitleMode') || 'Complete the {mode} setup steps to start capturing results.').replace('{mode}', activeModeLabel)
                : (t('dashboard.onboarding.hero.subtitleAll') || "Let's get your growth engine set up and ready to capture leads!")}
            </p>
          </div>

          {/* Mode selector cards embedded */}
          <OnboardingModeSelector
            selected={selectedMode}
            onSelect={(m) => setSelectedMode(selectedMode === m ? null : m)}
            completedByMode={completedByMode}
            totalByMode={totalByMode}
          />

          {/* KPIs — always visible */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <div className="bg-white/70 dark:bg-gray-900/50 rounded-xl px-4 py-3 border border-white/60 dark:border-gray-700/50">
              <p className="text-xs text-muted-foreground mb-1">{t('dashboard.onboarding.kpi.tasks') || 'Tasks'}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{completedCount}/{total}</p>
              <p className="text-xs text-muted-foreground">{activeModeLabel ? (t('dashboard.onboarding.kpi.stepsMode') || '{mode} steps').replace('{mode}', activeModeLabel) : (t('dashboard.onboarding.kpi.stepsAll') || 'All steps')}</p>
            </div>
            <div className="bg-white/70 dark:bg-gray-900/50 rounded-xl px-4 py-3 border border-white/60 dark:border-gray-700/50">
              <p className="text-xs text-muted-foreground mb-1">{t('dashboard.onboarding.kpi.progress') || 'Progress'}</p>
              <div className="flex items-center gap-2">
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{percent}%</p>
                <Progress value={percent} className="flex-1 h-1.5" />
              </div>
              <p className="text-xs text-muted-foreground">{activeModeLabel ? (t('dashboard.onboarding.kpi.setupMode') || '{mode} setup').replace('{mode}', activeModeLabel) : (t('dashboard.onboarding.kpi.setupOverall') || 'Overall setup')}</p>
            </div>
            <div className="bg-white/70 dark:bg-gray-900/50 rounded-xl px-4 py-3 border border-white/60 dark:border-gray-700/50">
              <p className="text-xs text-muted-foreground mb-1">{t('dashboard.onboarding.kpi.timeLeft') || 'Time left'}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{formatTime(remaining)}</p>
              <p className="text-xs text-muted-foreground">{(t('dashboard.onboarding.kpi.of') || 'of')} {formatTime(totalTime)}</p>
            </div>
            <div className="bg-white/70 dark:bg-gray-900/50 rounded-xl px-4 py-3 border border-white/60 dark:border-gray-700/50">
              <p className="text-xs text-muted-foreground mb-1">{t('dashboard.onboarding.kpi.status') || 'Status'}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{status.emoji} {status.label}</p>
              <p className="text-xs text-muted-foreground truncate">
                {nextPending && percent < 100 ? `${t('dashboard.onboarding.kpi.next') || 'Next'}: ${t(`dashboard.onboarding.task.${nextPending.id}.title`) || nextPending.title}` : (t('dashboard.onboarding.kpi.allDone') || 'All done!')}
              </p>
            </div>
          </div>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {percent < 100 && (
              <Button
                onClick={() => markAllDone(scopedTasks.map((t) => t.id))}
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 shadow-lg shadow-blue-500/25 hover:shadow-xl transition-all duration-200"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {activeModeLabel ? (t('dashboard.onboarding.cta.completeMode') || 'Complete {mode} Setup').replace('{mode}', activeModeLabel) : (t('dashboard.onboarding.cta.completeAll') || 'Complete Onboarding')}
              </Button>
            )}
            <Button
              variant="outline"
              size="lg"
              className="hover:shadow-lg transition-all duration-200 bg-white/60 dark:bg-gray-900/40"
              onClick={() => window.open("https://www.calendly.com/sergio-prado", "_blank")}
            >
              <User className="h-4 w-4 mr-2" />
              {t('dashboard.onboarding.cta.getAssistance') || 'Get Human Assistance'}
            </Button>
          </div>

        </CardContent>
      </Card>

      {/* Task Sections */}
      {visibleSections.map((section) => {
        const sectionDone = section.tasks.filter((t) => onboardingTasks[t.id]).length
        const sectionPct = Math.round((sectionDone / section.tasks.length) * 100)
        const isExpanded = expandedSections[section.title] ?? false
        const nextTask = section.tasks.find((t) => !onboardingTasks[t.id])

        return (
          <Card key={section.title}>
            <CardHeader
              className="cursor-pointer select-none"
              onClick={() => setExpandedSections((p) => ({ ...p, [section.title]: !p[section.title] }))}
            >
              <div className="flex items-center justify-between gap-3">
                {/* Left: toggle + title + badges */}
                <div className="flex items-center gap-3 min-w-0">
                  {isExpanded
                    ? <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  }
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{SECTION_TITLE_KEYS[section.title] ? (t(`dashboard.onboarding.section.${SECTION_TITLE_KEYS[section.title]}`) || section.title) : section.title}</span>
                      <Badge variant="outline" className="text-xs">{sectionDone}/{section.tasks.length}</Badge>
                      {sectionPct === 100 && (
                        <Badge variant="default" className="bg-green-100 text-green-800 text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />{t('dashboard.onboarding.badge.complete') || 'Complete'}
                        </Badge>
                      )}
                    </div>
                    {!isExpanded && nextTask && sectionPct < 100 && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        Next: {nextTask.title}
                      </p>
                    )}
                    {!isExpanded && sectionPct === 100 && (
                      <p className="text-xs text-muted-foreground mt-0.5">{section.description}</p>
                    )}
                  </div>
                </div>

                {/* Right: next task CTA */}
                {nextTask && sectionPct < 100 && (
                  <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={nextTask.onCta}
                    >
                      {t(`dashboard.onboarding.task.${nextTask.id}.cta`) || nextTask.ctaLabel}
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            {isExpanded && (
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {section.tasks.map((task) => {
                    const isDone = !!onboardingTasks[task.id]
                    return (
                      <Card
                        key={task.id}
                        className={`transition-all ${isDone ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800/50" : "hover:shadow-md"}`}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className={`h-10 w-10 p-2 rounded-lg flex items-center justify-center ${isDone ? "bg-green-100 dark:bg-green-900/50" : "bg-gray-50 border border-gray-200 dark:bg-gray-800 dark:border-gray-700"}`}>
                                {isDone ? <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" /> : task.icon}
                              </div>
                              <div className="flex-1">
                                <CardTitle className="text-sm font-medium leading-tight truncate">{t(`dashboard.onboarding.task.${task.id}.title`) || task.title}</CardTitle>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant={getPriorityColor(task.priority)} className="text-xs">{task.priority}</Badge>
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />{task.estimatedTime}
                                  </span>
                                </div>
                              </div>
                            </div>
                            {isDone && (
                              <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1" />{t('dashboard.onboarding.done') || 'Done'}
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <p className="text-sm text-muted-foreground mb-4 truncate">{t(`dashboard.onboarding.task.${task.id}.desc`) || task.description}</p>
                          <div className="flex items-center gap-2">
                            <Button size="sm" onClick={task.onCta} variant="outline" className="hover:scale-105 hover:shadow-lg transition-all duration-200">
                              {t(`dashboard.onboarding.task.${task.id}.cta`) || task.ctaLabel}
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (typeof window !== "undefined" && (window as any).MarketFit?.openChatWithTask) {
                                  (window as any).MarketFit.openChatWithTask({
                                    welcomeMessage: `Hi! I see you need help with "${task.title}". I'm here to guide you through this step.`,
                                    task: `Help me with: ${task.title} - ${task.description}`,
                                    clearExistingMessages: false,
                                    newConversation: false,
                                  })
                                }
                              }}
                              className="hover:scale-105 transition-all duration-200"
                            >
                              <HelpCircle className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleTask(task.id, !isDone)}
                              className="hover:scale-105 transition-all duration-200"
                            >
                              {isDone ? (t('dashboard.onboarding.undo') || 'Undo') : (t('dashboard.onboarding.markDone') || 'Mark done')}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}

function OnboardingSkeleton() {
  return (
    <div className="space-y-6 w-full pb-8">
      {/* Mode selector skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-4 w-80" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border-2 border-gray-200 dark:border-gray-800 p-5 flex flex-col items-start w-full">
              <div className="flex items-center justify-between w-full mb-2 pr-2">
                <div className="flex items-center gap-3.5">
                  <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
                  <Skeleton className="h-5 w-24" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
              <div className="mb-4 w-full pl-[54px] pr-2">
                <Skeleton className="h-4 w-full max-w-[200px]" />
              </div>
              <div className="space-y-2.5 mb-2 w-full pl-[54px]">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="flex items-center gap-2.5">
                    <Skeleton className="h-3.5 w-3.5 rounded-full flex-shrink-0" />
                    <Skeleton className="h-3.5 w-full max-w-[180px]" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* KPI skeletons */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="h-[116px]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pt-3 pb-0">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-4 rounded" />
            </CardHeader>
            <CardContent className="pt-2 pb-3">
              <Skeleton className="h-7 w-24 mb-2" />
              <Skeleton className="h-3 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Section skeletons */}
      {[1, 2].map((i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-72 mt-1" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[1, 2, 3].map((j) => (
                <Card key={j}>
                  <CardHeader className="pb-3">
                    <div className="flex gap-3">
                      <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Skeleton className="h-3 w-full mb-4" />
                    <div className="flex gap-2">
                      <Skeleton className="h-8 w-24" />
                      <Skeleton className="h-8 w-8" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default OnboardingItinerary
