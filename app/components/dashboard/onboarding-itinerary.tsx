"use client"

import { useCallback, useMemo, useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Button } from "@/app/components/ui/button"
import { Progress } from "@/app/components/ui/progress"
import { Badge } from "@/app/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip"
import { Skeleton } from "@/app/components/ui/skeleton"
import { CheckCircle2, ExternalLink, Users, UploadCloud, Settings, Calendar, Code, Globe, Tag, Target, Clock, Palette, Bot, FileText, Sparkles, ArrowRight, HelpCircle, Send, User, ChevronDown, ChevronUp, Star, CreditCard } from "@/app/components/ui/icons"
import { useProfile } from "@/app/hooks/use-profile"
import { useSite } from "@/app/context/SiteContext"
import { getCampaigns } from "@/app/campaigns/actions/campaigns/read"
import { getSegments } from "@/app/segments/actions"
import { createClient } from "@/lib/supabase/client"

type OnboardingTaskId =
  | "configure_channels"
  | "install_tracking_script"
  | "set_business_hours"
  | "setup_branding"
  | "setup_billing"
  | "validate_geographic_restrictions"
  | "fine_tune_segments"
  | "create_campaign"
  | "setup_content"
  | "configure_agents"
  | "complete_requirement"
  | "publish_and_feedback"
  | "personalize_customer_journey"
  | "assign_attribution_link"
  | "import_leads"
  | "pay_first_campaign"
  | "invite_team"
  | "create_coordination_task"

interface OnboardingTask {
  id: OnboardingTaskId
  title: string
  description: string
  ctaLabel: string
  onCta: () => void
  estimatedTime: string
  icon: React.ReactNode
  priority: "high" | "medium" | "low"
}

interface OnboardingSection {
  title: string
  description: string
  requiredRoles: string[]
  tasks: OnboardingTask[]
}

export function OnboardingItinerary() {
  const router = useRouter()
  const { settings = {}, updateSettings } = useProfile()
  const { currentSite } = useSite()

  // Loading state for ongoing validations (starts false, only shows during re-validations)
  const [isValidating, setIsValidating] = useState(false)
  // Flag to force full validation on site change
  const [forceFullValidation, setForceFullValidation] = useState(true)
  // Flag to skip validation when changes come from manual actions
  const [skipNextValidation, setSkipNextValidation] = useState(false)
  // Flag to prevent multiple simultaneous validations
  const [isValidationRunning, setIsValidationRunning] = useState(false)



  // Direct onboarding data state (independent of SiteContext complexity)
  const [onboardingTasks, setOnboardingTasks] = useState<Record<OnboardingTaskId, boolean>>({} as Record<OnboardingTaskId, boolean>)
  const [isLoadingOnboarding, setIsLoadingOnboarding] = useState(true)

  // Simple direct query for onboarding data
  const loadOnboardingData = useCallback(async () => {
    if (!currentSite?.id) {
      setOnboardingTasks({} as Record<OnboardingTaskId, boolean>)
      setIsLoadingOnboarding(false)
      return
    }

    try {
      setIsLoadingOnboarding(true)
      const supabase = createClient()
      
      const { data: settings, error } = await supabase
        .from('settings')
        .select('onboarding')
        .eq('site_id', currentSite.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading onboarding data:', error)
        setOnboardingTasks({} as Record<OnboardingTaskId, boolean>)
      } else {
        const tasks = settings?.onboarding || {}
        console.log('🔍 DIRECT QUERY: Loaded onboarding tasks:', JSON.stringify(tasks, null, 2))
        console.log('🔍 DIRECT QUERY: Tasks count:', Object.keys(tasks).length)
        setOnboardingTasks(tasks as Record<OnboardingTaskId, boolean>)
      }
    } catch (error) {
      console.error('Error in loadOnboardingData:', error)
      setOnboardingTasks({} as Record<OnboardingTaskId, boolean>)
    } finally {
      setIsLoadingOnboarding(false)
    }
  }, [currentSite?.id])

  // Load onboarding data when site changes
  useEffect(() => {
    loadOnboardingData()
  }, [loadOnboardingData])

  // Use direct state for UI
  const validOnboardingState = useMemo(() => ({
    completed: false,
    tasks: onboardingTasks
  }), [onboardingTasks])

  // State to manage expanded/collapsed sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    "Essential Setup": true,
    "Activation & Content": true,
    "Scale & Optimize": true
  })

  // Debug log for expanded sections (removed to prevent spam)

  // Debounce ref for settings updates
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  // Ref to capture latest updateSettings and settings to avoid stale closures
  const updateSettingsRef = useRef(updateSettings)
  const settingsRef = useRef(settings)
  
  // Update refs when values change
  useEffect(() => {
    updateSettingsRef.current = updateSettings
    settingsRef.current = settings
  }, [updateSettings, settings])
  
  // Force reload when site changes
  useEffect(() => {
    if (currentSite?.id) {
      console.log('🔄 Site changed, resetting onboarding state for new site:', currentSite.id)
      
      // Clear any existing timeout to stop previous site validations
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
        updateTimeoutRef.current = null
      }
      
      // Reset loading states
      setIsValidating(false)
      
      // Force full validation for the new site (ignore cache)
      setForceFullValidation(true)
      
      // Reset expanded sections when switching sites
      setExpandedSections({
        "Essential Setup": true,
        "Activation & Content": true,
        "Scale & Optimize": true
      })
    }
  }, [currentSite?.id])



  // Auto-validate tasks based on actual account configuration
  useEffect(() => {
    console.log('🚀 USE EFFECT TRIGGERED: currentSite?.id =', currentSite?.id)
    
    if (!currentSite?.id) {
      console.log('❌ NO SITE ID: Exiting useEffect')
      return
    }

    // Prevent multiple simultaneous validations
    if (isValidationRunning) {
      console.log('⏭️ SKIPPING VALIDATION: Another validation already running')
      return
    }

    // Skip validation if it was triggered by manual actions
    if (skipNextValidation) {
      console.log('⏭️ SKIPPING VALIDATION: Manual task update detected, avoiding overwrite')
      setSkipNextValidation(false)
      return
    }
    
    console.log('🔍 VALIDATION PROCEEDING: Starting new validation')

    // Allow validations even if settings is empty (for new sites)
    console.log('🔍 Site settings state:', currentSite.settings ? 'loaded' : 'empty/new site')

    // Clear any existing timeout
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current)
    }

    // Debounce the validation to avoid multiple rapid calls
    updateTimeoutRef.current = setTimeout(async () => {
      console.log('🚀 TIMEOUT EXECUTED: Starting onboarding validation for site:', currentSite.id)
      setIsValidationRunning(true)  // Prevent concurrent validations
      setIsValidating(true)
      const validateTasks = async () => {
        console.log('🚀 VALIDATE TASKS FUNCTION: Starting execution')
        const supabase = createClient()
        
        // Get fresh onboarding data directly from database for validation
        let freshOnboardingData: Record<OnboardingTaskId, boolean> = {} as Record<OnboardingTaskId, boolean>
        try {
          const { data: settings, error } = await supabase
            .from('settings')
            .select('onboarding')
            .eq('site_id', currentSite.id)
            .single()
          
          if (!error || error.code === 'PGRST116') {
            freshOnboardingData = (settings?.onboarding || {}) as Record<OnboardingTaskId, boolean>
            console.log('🔍 VALIDATION: Fresh onboarding data from DB:', freshOnboardingData)
          }
        } catch (error) {
          console.error('🔍 VALIDATION: Error fetching fresh data, using empty:', error)
        }
        
        // Start with existing completed tasks from fresh DB data
        const validatedTasks: Record<OnboardingTaskId, boolean> = { 
          ...freshOnboardingData  // Use fresh data from database
        }
        let hasChanges = false
        
        console.log('🔍 VALIDATION: Starting validation with', Object.keys(validatedTasks).filter(k => validatedTasks[k as OnboardingTaskId]).length, 'initial tasks')
        console.log('🔍 VALIDATION: validatedTasks object:', validatedTasks)
        console.log('🔍 VALIDATION: Object.keys(validatedTasks).length:', Object.keys(validatedTasks).length)

      try {
        // Helper function to check if a task should skip expensive validation
        const shouldSkipValidation = (taskId: OnboardingTaskId): boolean => {
          return validatedTasks[taskId] === true && !forceFullValidation
        }

        // Unified task validation function
        const validateTask = async (
          taskId: OnboardingTaskId,
          validationFn: () => Promise<boolean> | boolean,
          skipExpensive: boolean = false
        ): Promise<void> => {
          console.log(`🔍 VALIDATE TASK: Starting validation for ${taskId}`)
          try {
            // Check if already completed and should skip validation
            if (skipExpensive && shouldSkipValidation(taskId)) {
              return
            }

            // Check if already manually completed (preserve manual completion)
            if (validatedTasks[taskId] === true) {
              return
            }

            // Run the validation
            const autoValidationResult = await validationFn()
            
            // Check onboarding settings as fallback
            const settingsOnboarding = (currentSite.settings as any)?.onboarding || {}
            const fallbackValue = settingsOnboarding[taskId] === true && !forceFullValidation
            
            const shouldComplete = autoValidationResult || fallbackValue
            
            if (shouldComplete) {
              validatedTasks[taskId] = true
              hasChanges = true
            }
            // IMPORTANT: We don't set to false here, we preserve existing state
          } catch (error) {
            console.error(`❌ VALIDATE ${taskId}: Error during validation:`, error)
          }
        }

        // Validate tracking script installation
        await validateTask('install_tracking_script', async () => {
          const hasTrackingCode = currentSite.tracking?.tracking_code
          let hasVisitorSessions = false
          
          try {
            const response = await fetch(`/api/onboarding/check-sessions?siteId=${currentSite.id}`)
            if (response.ok) {
              const data = await response.json()
              hasVisitorSessions = data.hasSessions
            }
          } catch (error) {
            console.error('Error checking sessions:', error)
          }
          
          return !!(hasTrackingCode || hasVisitorSessions)
        }, true) // skipExpensive = true

        // Validate channels configuration
        await validateTask('configure_channels', () => {
          const channels = currentSite.settings?.channels
          const emailConfigured = channels?.email?.enabled && channels.email.status === 'synced'
          const whatsappConfigured = channels?.whatsapp?.enabled && channels.whatsapp.status === 'active'
          return !!(emailConfigured || whatsappConfigured)
        })

        // Validate business hours setup
        await validateTask('set_business_hours', () => {
          const businessHours = currentSite.settings?.business_hours
          return !!(businessHours && Array.isArray(businessHours) && businessHours.length > 0)
        })

        // Validate branding configuration
        await validateTask('setup_branding', () => {
          const branding = currentSite.settings?.branding
          return !!(branding?.primary_color && branding?.brand_essence)
        })

        // Validate billing setup
        await validateTask('setup_billing', async () => {
          try {
            const response = await fetch(`/api/onboarding/check-billing?siteId=${currentSite.id}`)
            if (response.ok) {
              const data = await response.json()

              return data.hasBillingSetup
            } else {
              console.error('Failed to check billing setup:', response.status)
              return false
            }
          } catch (error) {
            console.error('Error checking billing setup:', error)
            return false
          }
        }, true) // skipExpensive = true

        // Validate first campaign payment
        await validateTask('pay_first_campaign', async () => {
          try {
            const response = await fetch(`/api/onboarding/check-credits?siteId=${currentSite.id}`)
            if (response.ok) {
              const data = await response.json()

              return data.hasCredits
            } else {
              console.error('Failed to check credits for first campaign:', response.status)
              return false
            }
          } catch (error) {
            console.error('Error checking credits for first campaign:', error)
            return false
          }
        }, true) // skipExpensive = true

        // Validate agents configuration
        await validateTask('configure_agents', async () => {
          const { data: agents } = await supabase
            .from('agents')
            .select('id')
            .eq('site_id', currentSite.id)
            .limit(1)

          return !!agents?.length
        }, true) // skipExpensive = true

        // Validate campaigns exist
        await validateTask('create_campaign', async () => {
          const campaignsResult = await getCampaigns(currentSite.id)
          return !!campaignsResult.data?.length
        })

        // Validate segments exist
        await validateTask('fine_tune_segments', async () => {
          const segmentsResult = await getSegments(currentSite.id)
          return !!segmentsResult.segments?.length
        })

        // Validate team members invited
        await validateTask('invite_team', () => {
          return !!currentSite.settings?.team_members?.length
        })

        // Validate content library has files
        await validateTask('setup_content', async () => {
          try {
            const response = await fetch(`/api/onboarding/check-files?siteId=${currentSite.id}`)
            if (response.ok) {
              const data = await response.json()
              return data.hasFiles
            }
          } catch (error) {
            console.error('Error checking files:', error)
          }
          return false
        }, true) // skipExpensive = true

        // Validate requirements are completed
        await validateTask('complete_requirement', async () => {
          try {

            const { data: requirements, error } = await supabase
              .from('requirements')
              .select('id, completion_status')
              .eq('site_id', currentSite.id)
              .eq('completion_status', 'completed')
              .limit(1)



            const hasCompletedRequirements = !error && requirements && requirements.length > 0
            if (!error && (!requirements || requirements.length === 0)) {
              console.log('No completed requirements found')
            }
            return hasCompletedRequirements
          } catch (error) {
            console.error('Error checking requirements:', error)
            return false
          }
        }, true) // skipExpensive = true

        // Validate published content with performance feedback
        await validateTask('publish_and_feedback', async () => {
          try {

            const { data: publishedContent, error } = await supabase
              .from('content')
              .select('id, status, performance_rating')
              .eq('site_id', currentSite.id)
              .eq('status', 'published')
              .gte('performance_rating', 1) // At least 1 star
              .limit(1)



            const hasPublishedContentWithFeedback = !error && publishedContent && publishedContent.length > 0
            if (!error && (!publishedContent || publishedContent.length === 0)) {
              console.log('No published content with feedback found')
            }
            return hasPublishedContentWithFeedback
          } catch (error) {
            console.error('Error checking published content with feedback:', error)
            return false
          }
        }, true) // skipExpensive = true

        // Validate sessions have attribution
        await validateTask('assign_attribution_link', async () => {
          try {

            
            const response = await fetch(`/api/onboarding/check-attribution?siteId=${currentSite.id}`)
            if (response.ok) {
              const data = await response.json()

              return data.hasAttribution
            } else {
              console.error('Failed to check attribution links:', response.status)
              return false
            }
          } catch (error) {
            console.error('Error checking sessions with attribution:', error)
            return false
          }
        }, true) // skipExpensive = true

        // Validate customer journey personalization
        await validateTask('personalize_customer_journey', () => {
          const customerJourney = currentSite.settings?.customer_journey
          let hasCustomerJourneyData = false
          
          if (customerJourney) {
            const stages = ['awareness', 'consideration', 'decision', 'purchase', 'retention', 'referral']
            const fields = ['metrics', 'actions', 'tactics']
            
            hasCustomerJourneyData = stages.some(stage => {
              const stageData = customerJourney[stage as keyof typeof customerJourney]
              if (!stageData) return false
              
              return fields.some(field => {
                const fieldData = stageData[field as keyof typeof stageData]
                return Array.isArray(fieldData) && fieldData.length > 0
              })
            })
            

          }
          
          return hasCustomerJourneyData
        })

        // Only update SITE settings (not profile) to ensure proper site isolation
        if (hasChanges || Object.keys(validatedTasks).length > 0) {
          try {
            const completedCount = Object.keys(validatedTasks).filter(k => validatedTasks[k as OnboardingTaskId]).length
            console.log(`🔍 VALIDATION: Saving ${completedCount} completed tasks to SITE settings only`)
            
            // Update site settings with the new onboarding state (preserve existing settings)
            const supabase = createClient()
            
            // First get existing settings to preserve other fields
            const { data: existingSettings } = await supabase
              .from('settings')
              .select('*')
              .eq('site_id', currentSite.id)
              .single()
            
            // Merge with existing settings to preserve all fields
            const updatedSettings = {
              ...existingSettings,
              site_id: currentSite.id,
              onboarding: validatedTasks  // Use only validated tasks for this site
            }
            
            await supabase
              .from('settings')
              .upsert(updatedSettings, { 
                onConflict: 'site_id',
                ignoreDuplicates: false 
              })
              
            console.log('Auto-validation: Updated site settings onboarding (site-isolated)')
            
            // Reload onboarding data to reflect updated settings in UI
            await loadOnboardingData()
            console.log('Auto-validation: Reloaded onboarding data to update UI')
          } catch (error) {
            console.log('Auto-validation: Error updating site settings:', error)
          }
        }
      } catch (error) {
        console.error('Error validating onboarding tasks:', error)
      } finally {
        // Mark validation as complete
        setIsValidating(false)
        setIsValidationRunning(false)  // Allow new validations
        // Reset force validation flag after first validation completes
        setForceFullValidation(false)
      }
    }

      validateTasks()
    }, 1000) // 1 second debounce

    // Cleanup function
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
    }
  }, [currentSite?.id])  // Only depend on site ID to prevent infinite loop

  const sections: OnboardingSection[] = useMemo(() => [
    {
      title: "Essential Setup",
      description: "Core configuration to start capturing and engaging leads",
      requiredRoles: ["Developer", "Admin"],
      tasks: [
        {
          id: "install_tracking_script",
          title: "Install tracking script",
          description: "Add our tracking code to your website to start capturing visitor data and behavior.",
          ctaLabel: "Get Script",
          estimatedTime: "5 min",
          priority: "high",
          icon: <Code className="h-4 w-4 text-gray-700 dark:text-gray-300" />,
          onCta: () => router.push("/settings?tab=channels"),
        },
        {
          id: "configure_channels",
          title: "Connect communication channels",
          description: "Set up Email or WhatsApp to automatically engage with your leads.",
          ctaLabel: "Setup Channels",
          estimatedTime: "8 min",
          priority: "high",
          icon: <Settings className="h-4 w-4 text-gray-700 dark:text-gray-300" />,
          onCta: () => router.push("/settings?tab=channels"),
        },
        {
          id: "setup_branding",
          title: "Configure brand identity",
          description: "Set your brand colors, tone, and voice to ensure consistent experiences.",
          ctaLabel: "Setup Brand",
          estimatedTime: "10 min",
          priority: "medium",
          icon: <Palette className="h-4 w-4 text-gray-700 dark:text-gray-300" />,
          onCta: () => router.push("/context"),
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
        },
        {
          id: "setup_billing",
          title: "Setup billing & credits",
          description: "Add payment method or credits to ensure uninterrupted service.",
          ctaLabel: "Setup Billing",
          estimatedTime: "4 min",
          priority: "high",
          icon: <CreditCard className="h-4 w-4 text-gray-700 dark:text-gray-300" />,
          onCta: () => router.push("/billing"),
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
        },
      ],
    },
    {
      title: "Activation & Content",
      description: "Create campaigns and content to start meaningful conversations",
      requiredRoles: ["Marketing Manager", "Content Creator"],
      tasks: [
        {
          id: "configure_agents",
          title: "Configure AI agents",
          description: "Train your AI assistants with custom prompts and test their responses.",
          ctaLabel: "Setup Agents",
          estimatedTime: "15 min",
          priority: "high",
          icon: <Bot className="h-4 w-4 text-gray-700 dark:text-gray-300" />,
          onCta: () => router.push("/agents"),
        },
        {
          id: "create_campaign",
          title: "Launch your first campaign",
          description: "Create an automated sequence to nurture and convert your leads.",
          ctaLabel: "Create Campaign",
          estimatedTime: "12 min",
          priority: "high",
          icon: <Target className="h-4 w-4 text-gray-700 dark:text-gray-300" />,
          onCta: () => router.push("/campaigns"),
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
        },
        {
          id: "publish_and_feedback",
          title: "Publish and give feedback to agents",
          description: "Publish content and rate agent performance to improve AI responses.",
          ctaLabel: "Manage Content",
          estimatedTime: "15 min",
          priority: "medium",
          icon: <Star className="h-4 w-4 text-gray-700 dark:text-gray-300" />,
          onCta: () => router.push("/content"),
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
        },
      ],
    },
    {
      title: "Scale & Optimize",
      description: "Advanced features for growth and team collaboration",
      requiredRoles: ["Operations Manager", "Team Lead"],
      tasks: [
        {
          id: "fine_tune_segments",
          title: "Optimize audience segments",
          description: "Refine your targeting rules and attributes for better campaign performance.",
          ctaLabel: "Edit Segments",
          estimatedTime: "10 min",
          priority: "low",
          icon: <Tag className="h-4 w-4 text-gray-700 dark:text-gray-300" />,
          onCta: () => router.push("/segments"),
        },
        {
          id: "assign_attribution_link",
          title: "Assign segment or campaign attribution link",
          description: "Track visitor sources by linking sessions to specific segments or campaigns.",
          ctaLabel: "Manage Attribution",
          estimatedTime: "8 min",
          priority: "medium",
          icon: <ExternalLink className="h-4 w-4 text-gray-700 dark:text-gray-300" />,
          onCta: () => router.push("/dashboard?tab=traffic"),
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
        },
        {
          id: "import_leads",
          title: "Import existing leads",
          description: "Upload your current contact database to start engaging immediately.",
          ctaLabel: "Import CSV",
          estimatedTime: "7 min",
          priority: "low",
          icon: <UploadCloud className="h-4 w-4 text-gray-700 dark:text-gray-300" />,
          onCta: () => router.push("/leads"),
        },
        {
          id: "pay_first_campaign",
          title: "Pay your first campaign",
          description: "Add credits to your billing account to enable campaign launches and marketing automation.",
          ctaLabel: "Add Credits",
          estimatedTime: "5 min",
          priority: "medium",
          icon: <CreditCard className="h-4 w-4 text-gray-700 dark:text-gray-300" />,
          onCta: () => router.push("/billing"),
        },
        {
          id: "create_coordination_task",
          title: "Plan team coordination",
          description: "Schedule kickoffs and sync meetings to align your team's efforts.",
          ctaLabel: "Add Task",
          estimatedTime: "6 min",
          priority: "low",
          icon: <Calendar className="h-4 w-4 text-gray-700 dark:text-gray-300" />,
          onCta: () => router.push("/requirements"),
        },
      ],
    },
  ], [router])

  // Auto-collapse completed sections
  useEffect(() => {
    if (!validOnboardingState.tasks) {

      return
    }



    setExpandedSections(prev => {
      const newState = { ...prev }
      let hasChanges = false
      
      // Check each section and collapse if completed
      const sectionNames = ["Essential Setup", "Activation & Content", "Scale & Optimize"]
      
      sectionNames.forEach(sectionName => {
        // Find section tasks to check completion
        const section = sections.find(s => s.title === sectionName)
        if (section) {
          const completedTasks = section.tasks.filter(task => validOnboardingState.tasks?.[task.id]).length
          const totalTasks = section.tasks.length
          const isCompleted = completedTasks === totalTasks
          const hasAtLeastOne = completedTasks > 0
          

          
          // Special logic for "Activation & Content" - collapse only if has at least one task AND all are completed
          if (sectionName === "Activation & Content") {
            if (isCompleted && hasAtLeastOne && prev[sectionName]) {

              newState[sectionName] = false
              hasChanges = true
            }
          } else {
            // For other sections, collapse when fully completed
            if (isCompleted && totalTasks > 0 && prev[sectionName]) {

              newState[sectionName] = false
              hasChanges = true
            }
          }
        }
      })
      
      if (hasChanges) {

      }
      
      return newState
    })
  }, [validOnboardingState.tasks, sections])  // Use direct property to ensure stable reference

  // Helper function to parse estimated time to minutes
  const parseTimeToMinutes = useCallback((timeStr: string): number => {
    const match = timeStr.match(/(\d+)\s*min/)
    return match ? parseInt(match[1], 10) : 0
  }, [])

  const flatTasks = useMemo(() => sections.flatMap(s => s.tasks), [sections])
  
  // Calculate time-based progress
  const totalTimeMinutes = useMemo(() => {
    return flatTasks.reduce((acc, task) => acc + parseTimeToMinutes(task.estimatedTime), 0)
  }, [flatTasks, parseTimeToMinutes])

  const completedTimeMinutes = useMemo(() => {
    const t = validOnboardingState.tasks || {}
    return flatTasks.reduce((acc, task) => {
      const isCompleted = (t as any)[task.id]
      return acc + (isCompleted ? parseTimeToMinutes(task.estimatedTime) : 0)
    }, 0)
  }, [flatTasks, validOnboardingState.tasks, parseTimeToMinutes])

  const remainingTimeMinutes = totalTimeMinutes - completedTimeMinutes
  
  // Helper function to format time
  const formatTime = useCallback((minutes: number): string => {
    if (minutes === 0) return "0 min"
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const remainingMins = minutes % 60
    if (remainingMins === 0) return `${hours}h`
    return `${hours}h ${remainingMins}m`
  }, [])
  
  // Keep task count for display
  const total = flatTasks.length
  const completedCount = useMemo(() => {
    const t = validOnboardingState.tasks || {}
    return flatTasks.reduce((acc, task) => acc + ((t as any)[task.id] ? 1 : 0), 0)
  }, [flatTasks, validOnboardingState.tasks])

  const criticalTasks = flatTasks.filter(t => t.priority === "high")
  const criticalCompleted = criticalTasks.filter(t => (validOnboardingState.tasks as any)?.[t.id]).length

  // Time-based progress percentage
  const percent = Math.round((completedTimeMinutes / totalTimeMinutes) * 100)

  // Define status based on progress and completed tasks
  const getOnboardingStatus = useCallback(() => {
    if (percent === 100) {
      return { label: "Ready to Launch", emoji: "🚀", variant: "default" as const, color: "text-green-600" }
    } else if (percent >= 80) {
      return { label: "Almost There", emoji: "🎯", variant: "default" as const, color: "text-blue-600" }
    } else if (percent >= 60) {
      return { label: "Making Progress", emoji: "⚡", variant: "outline" as const, color: "text-yellow-600" }
    } else if (percent >= 40) {
      return { label: "Getting Started", emoji: "🔥", variant: "outline" as const, color: "text-orange-600" }
    } else if (percent >= 20) {
      return { label: "First Steps", emoji: "👟", variant: "outline" as const, color: "text-indigo-600" }
    } else if (completedCount > 0) {
      return { label: "Just Started", emoji: "🌱", variant: "outline" as const, color: "text-emerald-600" }
    } else {
      return { label: "Ready to Begin", emoji: "✨", variant: "outline" as const, color: "text-gray-600" }
    }
  }, [percent, completedCount])

  const currentStatus = getOnboardingStatus()

  // Get next pending task
  const getNextPendingTask = useCallback(() => {
    const allTasks = sections.flatMap(section => section.tasks)
    const nextTask = allTasks.find(task => !validOnboardingState.tasks?.[task.id])
    return nextTask
  }, [sections, validOnboardingState.tasks])

  const nextPendingTask = getNextPendingTask()

  const toggleTask = useCallback(async (taskId: OnboardingTaskId, done: boolean) => {
    console.log(`🔧 MANUAL TOGGLE: ${taskId} = ${done}`)
    
    // Skip next automatic validation to prevent overwriting manual changes
    setSkipNextValidation(true)

    // Only update SITE settings (not profile) to ensure proper site isolation
    if (currentSite?.id) {
      try {
        const supabase = createClient()
        
        // First get existing settings to preserve other fields
        const { data: existingSettings } = await supabase
          .from('settings')
          .select('*')
          .eq('site_id', currentSite.id)
          .single()
        
        const siteSettingsOnboarding = existingSettings?.onboarding || {}
        const updatedSiteOnboarding = { 
          ...siteSettingsOnboarding, 
          [taskId]: done  // Update this specific task
        }
        
        // Merge with existing settings to preserve all fields
        const updatedSettings = {
          ...existingSettings,
          site_id: currentSite.id,
          onboarding: updatedSiteOnboarding
        }
        
        await supabase
          .from('settings')
          .upsert(updatedSettings, { 
            onConflict: 'site_id',
            ignoreDuplicates: false 
          })
          
        console.log(`🔧 MANUAL TOGGLE: Site settings updated for ${taskId}`)
        
        // Reload onboarding data to reflect updated settings in UI
        await loadOnboardingData()
        console.log(`🔧 MANUAL TOGGLE: Reloaded onboarding data for ${taskId}`)
      } catch (siteError) {
        console.error('🔧 MANUAL TOGGLE: Error updating site settings:', siteError)
      }
    }
  }, [currentSite?.id, loadOnboardingData])

  const markAllDone = useCallback(async () => {
    const allTasks: Record<OnboardingTaskId, boolean> = flatTasks.reduce((acc, t) => {
      acc[t.id] = true
      return acc
    }, {} as Record<OnboardingTaskId, boolean>)
    
    // Skip next automatic validation to prevent overwriting manual changes
    setSkipNextValidation(true)

    // Only update SITE settings (not profile) to ensure proper site isolation
    if (currentSite?.id) {
      try {
        const supabase = createClient()
        
        // First get existing settings to preserve other fields
        const { data: existingSettings } = await supabase
          .from('settings')
          .select('*')
          .eq('site_id', currentSite.id)
          .single()
        
        // Merge with existing settings to preserve all fields
        const updatedSettings = {
          ...existingSettings,
          site_id: currentSite.id,
          onboarding: allTasks  // Set all tasks as completed
        }
        
        await supabase
          .from('settings')
          .upsert(updatedSettings, { 
            onConflict: 'site_id',
            ignoreDuplicates: false 
          })
          
        console.log('Mark all done: Updated site settings with all tasks completed')
        
        // Reload onboarding data to reflect updated settings in UI
        await loadOnboardingData()
        console.log('Mark all done: Reloaded onboarding data to update UI')
      } catch (siteError) {
        console.log('Mark all done: Error updating site settings, but continuing:', siteError)
      }
    }
  }, [flatTasks, currentSite?.id, loadOnboardingData])



  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case "high": return "destructive"
      case "medium": return "indigo"
      case "low": return "secondary"
      default: return "secondary"
    }
  }

  const sendInstructions = useCallback((section: OnboardingSection) => {
    const subject = `Task Assignment: ${section.title}`
    const body = `Hi,

Please help complete these onboarding tasks:

${section.title}
${section.description}

Required roles: ${section.requiredRoles.join(', ')}

Tasks:
${section.tasks.map(task => `• ${task.title} (${task.estimatedTime})`).join('\n')}

Thanks!`

    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.open(mailtoLink, '_blank')
  }, [])

  // Show loading skeletons while loading onboarding data or re-validating
  if (isLoadingOnboarding || isValidating) {
    return (
      <div className="space-y-6 w-full pb-8">
        {/* Progress Overview Skeletons - Matching BaseKpiWidget style */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {['Tasks', 'Progress', 'Time Remaining', 'Status'].map((title, i) => (
            <Card key={i} className="h-[116.5px]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pt-3 pb-0">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <div className="relative w-4 h-4 overflow-hidden rounded">
                  <div className="h-full w-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
                </div>
              </CardHeader>
              <CardContent className="pt-2 pb-3">
                <div className="flex flex-col animate-pulse">
                  <div className="h-8 flex items-center pt-1">
                    <div className="h-7 w-24 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse" />
                  </div>
                  <div className="h-[18px] flex items-center mt-1">
                    <div className="h-4 w-20 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Start Skeleton */}
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-6 w-24" />
            </CardTitle>
            <Skeleton className="h-4 w-80" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded" />
                    <div className="flex-1">
                      <Skeleton className="h-3 w-20 mb-1" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="h-3 w-3 rounded" />
                  </div>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Onboarding Sections Skeletons */}
        {[1, 2, 3].map((sectionIndex) => (
          <Card key={sectionIndex}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-3">
                    {/* Collapse/expand button skeleton */}
                    <div className="h-6 w-6 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                    {/* Section title skeleton */}
                    <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                    {/* Progress badge skeleton */}
                    <div className="h-5 w-12 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-full" />
                    {/* Complete badge skeleton (only for first section to show variation) */}
                    {sectionIndex === 1 && (
                      <div className="h-5 w-20 bg-green-200 dark:bg-green-800 animate-pulse rounded-full" />
                    )}
                  </CardTitle>
                  {/* Description skeleton */}
                  <div className="h-4 w-96 bg-gray-200 dark:bg-gray-700 animate-pulse rounded mt-1" />
                </div>
                <div className="flex items-center gap-2">
                  {/* Required roles badges skeleton */}
                  <div className="flex items-center gap-1">
                    <div className="h-6 w-16 bg-blue-100 dark:bg-blue-900 animate-pulse rounded-md" />
                    <div className="h-6 w-12 bg-blue-100 dark:bg-blue-900 animate-pulse rounded-md" />
                  </div>
                  {/* Delegate button skeleton */}
                  <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-md" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Grid layout matching real design */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((taskIndex) => (
                  <Card key={taskIndex} className="transition-all">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {/* Task icon skeleton */}
                          <div className="h-10 w-10 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 animate-pulse rounded-lg flex-shrink-0" />
                          <div className="flex-1">
                            {/* Task title skeleton */}
                            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded mb-2" />
                            <div className="flex items-center gap-2">
                              {/* Priority badge skeleton */}
                              <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-full" />
                              {/* Time badge skeleton */}
                              <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                            </div>
                          </div>
                        </div>
                        {/* Task action button skeleton */}
                        <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-md flex-shrink-0" />
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {/* Task description skeleton */}
                      <div className="space-y-2">
                        <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                        <div className="h-3 w-3/4 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
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

  return (
    <div className="space-y-6 w-full pb-8">
      {/* Progress Overview - Following dashboard widget pattern */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pt-3 pb-0">
            <CardTitle className="text-sm font-medium">Tasks</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent className="pt-2 pb-3">
            <div className="text-2xl font-bold pt-1 h-8 flex items-center">{completedCount}/{total}</div>
            <p className="text-xs text-muted-foreground mt-1 h-[18px] flex items-center">
              Steps completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pt-3 pb-0">
            <CardTitle className="text-sm font-medium">Progress</CardTitle>
            <Sparkles className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent className="pt-2 pb-3">
            <div className="flex items-center gap-3 pt-1 h-8">
              <div className="text-2xl font-bold">{percent}%</div>
              <Progress value={percent} className="flex-1 h-2" />
            </div>
            <p className="text-xs text-muted-foreground mt-1 h-[18px] flex items-center">
              Based on estimated time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pt-3 pb-0">
            <CardTitle className="text-sm font-medium">Time Remaining</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent className="pt-2 pb-3">
            <div className="text-2xl font-bold pt-1 h-8 flex items-center">{formatTime(remainingTimeMinutes)}</div>
            <p className="text-xs text-muted-foreground mt-1 h-[18px] flex items-center">
              {formatTime(totalTimeMinutes)} total setup time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pt-3 pb-0">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <div className="h-4 w-4 text-xl flex items-center justify-center">
              {currentStatus.emoji}
            </div>
          </CardHeader>
          <CardContent className="pt-2 pb-3">
            <div className="text-2xl font-bold pt-1 h-8 flex items-center">
              {currentStatus.label}
            </div>
            <p className="text-xs text-muted-foreground mt-1 h-[18px] flex items-center truncate">
              {nextPendingTask && percent < 100 
                ? `Next: ${nextPendingTask.title}`
                : percent === 100 
                  ? "All tasks completed!" 
                  : "Getting started..."
              }
            </p>
          </CardContent>
        </Card>
      </div>



      {/* Quick Actions for Critical Tasks */}
      {criticalCompleted < criticalTasks.length && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-300">
              <Sparkles className="h-5 w-5" />
              Quick Start
            </CardTitle>
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Complete these critical tasks first to start capturing leads
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {criticalTasks.filter(t => !validOnboardingState.tasks?.[t.id]).map((task) => (
                <Button
                  key={task.id}
                  size="sm"
                  onClick={task.onCta}
                  variant="outline"
                  className="justify-start h-auto p-3 border-amber-200 hover:bg-amber-50 hover:scale-105 hover:shadow-lg hover:shadow-amber-500/25 transition-all duration-200"
                >
                  <div className="flex items-center gap-2 w-full">
                    {task.icon}
                    <div className="text-left flex-1">
                      <div className="font-medium text-xs">{task.title}</div>
                      <div className="text-xs opacity-90">{task.estimatedTime}</div>
                    </div>
                    <ArrowRight className="h-3 w-3 flex-shrink-0" />
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Onboarding Sections */}
      {sections.map((section) => {
        const sectionCompletedCount = section.tasks.filter(t => validOnboardingState.tasks?.[t.id]).length
        const sectionPercent = Math.round((sectionCompletedCount / section.tasks.length) * 100)
        const isExpanded = expandedSections[section.title]
        


        return (
          <Card key={section.title}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        console.log(`Toggling section "${section.title}" from ${isExpanded} to ${!isExpanded}`)
                        setExpandedSections(prev => ({
                          ...prev,
                          [section.title]: !prev[section.title]
                        }))
                      }}
                      className="p-1 h-6 w-6 hover:bg-gray-100 rounded"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                    {section.title}
                    <Badge variant="outline" className="text-xs">
                      {sectionCompletedCount}/{section.tasks.length}
                    </Badge>
                    {sectionPercent === 100 && (
                      <Badge variant="default" className="bg-green-100 text-green-800 text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Complete
                      </Badge>
                    )}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{section.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    {section.requiredRoles.map((role) => (
                      <Badge
                        key={role}
                        variant="outline"
                        className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 border-blue-200"
                      >
                        {role}
                      </Badge>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => sendInstructions(section)}
                    className="text-xs"
                  >
                    <Send className="h-3 w-3 mr-1" />
                    Delegate
                  </Button>
                </div>
              </div>
            </CardHeader>
            {isExpanded && (
              <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {section.tasks.map((task) => {
                  const isDone = !!validOnboardingState.tasks?.[task.id]
                  
                  return (
                    <Card 
                      key={task.id} 
                      className={`transition-all ${
                        isDone 
                          ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800/50" 
                          : "hover:shadow-md"
                      }`}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`h-10 w-10 p-2 rounded-lg flex items-center justify-center ${
                              isDone ? "bg-green-100 dark:bg-green-900/50" : "bg-gray-50 border border-gray-200 dark:bg-gray-800 dark:border-gray-700"
                            }`}>
                              {isDone ? <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" /> : task.icon}
                            </div>
                            <div className="flex-1">
                              <CardTitle className="text-sm font-medium leading-tight truncate">
                                {task.title}
                              </CardTitle>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge 
                                  variant={getPriorityBadgeColor(task.priority)}
                                  className="text-xs"
                                >
                                  {task.priority}
                                </Badge>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {task.estimatedTime}
                                </span>
                              </div>
                            </div>
                          </div>
                          {isDone && (
                            <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Done
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-sm text-muted-foreground mb-4 truncate">{task.description}</p>
                        <div className="flex items-center gap-2">
                          <Button 
                            size="sm" 
                            onClick={task.onCta}
                            variant="outline"
                            className="hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 active:scale-95"
                          >
                            {task.ctaLabel}
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (typeof window !== 'undefined' && (window as any).MarketFit?.openChatWithTask) {
                                (window as any).MarketFit.openChatWithTask({
                                  welcomeMessage: `Hi! I see you need help with "${task.title}". I'm here to guide you through this step.`,
                                  task: `Help me with: ${task.title} - ${task.description}`,
                                  clearExistingMessages: false,
                                  newConversation: false
                                })
                              }
                            }}
                            className="hover:scale-105 transition-all duration-200 active:scale-95"
                          >
                            <HelpCircle className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleTask(task.id, !isDone)}
                            className="hover:scale-105 transition-all duration-200 active:scale-95"
                          >
                            {isDone ? "Undo" : "Mark done"}
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

      {/* Completion Card */}
      {!validOnboardingState?.completed && (
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/50 dark:via-indigo-950/50 dark:to-purple-950/50">
          <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl"></div>
          <CardContent className="relative p-8 text-center space-y-6">
            <div className="mx-auto h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <CheckCircle2 className="h-8 w-8 text-white" />
            </div>
            <div className="space-y-3">
              <h3 className="font-bold text-xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Ready to launch? 🚀
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 max-w-sm mx-auto leading-relaxed">
                You've set up the foundation! Complete your onboarding to unlock the full potential of Market Fit
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button 
                onClick={markAllDone} 
                size="lg" 
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transform hover:scale-105 transition-all duration-200 active:scale-95"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Complete Onboarding
              </Button>
              <Button 
                variant="outline"
                size="lg" 
                className="hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 active:scale-95"
                onClick={() => window.open('https://www.calendly.com/sergio-prado', '_blank')}
              >
                <User className="h-4 w-4 mr-2" />
                Get Human Assistance
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default OnboardingItinerary