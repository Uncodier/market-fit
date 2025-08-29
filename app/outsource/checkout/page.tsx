"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Checkbox } from "@/app/components/ui/checkbox"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import ReactMarkdown from "react-markdown"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/app/components/ui/collapsible"
import { 
  Check,
  CreditCard, 
  Lock,
  Shield,
  Clock,
  ChevronLeft,
  ChevronDown,
  CreditCard as CreditCardIcon
} from "@/app/components/ui/icons"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Badge } from "@/app/components/ui/badge"
import { useSite } from "@/app/context/SiteContext"
import { billingService, BillingData } from "@/app/services/billing-service"
import { useAuth } from "@/app/hooks/use-auth"

// Define requirement types similar to the ones used in requirements page
type RequirementStatusType = 
  | "backlog" 
  | "in_progress" 
  | "on_review" 
  | "done" 
  | "validated" 
  | "canceled";

type CompletionStatusType = "pending" | "completed" | "rejected";

interface TaskDetails {
  id: string
  title: string
  description: string
  instructions: string
  outsourceInstructions?: string
  priority: "high" | "medium" | "low"
  status: RequirementStatusType
  completionStatus: CompletionStatusType
  budget: number | null
  estimatedDelivery?: string
  estimatedHours?: number
}

// Custom Markdown renderer component
const MarkdownRenderer = ({ content }: { content: string }) => {
  if (!content.trim()) return null;
  
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-medium prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
};

// Checkout Skeleton component for loading state
const CheckoutSkeleton = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background/40 to-background">
      <div className="container max-w-6xl px-4 py-8 mx-auto">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-12">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-28" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left Column - Task Details Skeleton */}
          <div>
            <Skeleton className="h-8 w-40 mb-4" />
            <Skeleton className="h-12 w-32 mb-8" />
            
            <div className="mb-6 flex items-start gap-4">
              <Skeleton className="w-12 h-12 rounded-md flex-shrink-0" />
              <div className="w-full">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full mb-6" />
                <Skeleton className="h-4 w-full mb-2" />
                
                {/* Task Instructions Skeleton */}
                <div className="bg-muted/30 rounded-lg mb-3 overflow-hidden border border-border/30">
                  <div className="p-4">
                    <div className="flex justify-between items-center mb-2">
                      <Skeleton className="h-5 w-28" />
                      <Skeleton className="h-6 w-24" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  </div>
                </div>
                
                {/* Task Details Skeleton */}
                <div className="bg-muted/30 rounded-lg p-4 mb-3 border border-border/30">
                  <Skeleton className="h-5 w-28 mb-3" />
                  <div className="space-y-3">
                    {Array(3).fill(0).map((_, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <Skeleton className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <Skeleton className="h-4 w-5/6" />
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Estimated Times Skeleton */}
                <div className="flex flex-wrap gap-4 mt-3">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-40" />
                </div>
              </div>
              <Skeleton className="h-6 w-20 shrink-0" />
            </div>
            
            <div className="space-y-3 border-t border-b py-4 mb-6">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
              
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-48" />
              </div>
              
              <div className="flex justify-between pt-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-20" />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-14" />
            </div>
          </div>
          
          {/* Right Column - Payment Form Skeleton */}
          <div>
            <Skeleton className="h-8 w-48 mb-6" />
            
            {/* Saved Payment Skeleton */}
            <div className="mb-6">
              <div className="p-4 border rounded-lg mb-4 flex items-center gap-4">
                <Skeleton className="h-5 w-5 rounded-full" />
                <div className="flex items-center">
                  <Skeleton className="h-6 w-6 mr-2" />
                  <div>
                    <Skeleton className="h-5 w-48 mb-1" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-12 w-full" />
              </div>
              
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-12 w-full" />
                
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </div>
              
              <div className="space-y-2">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-12 w-full" />
              </div>
              
              <div className="space-y-2">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-4 w-40" />
              </div>
              
              <div className="flex items-start space-x-3">
                <Skeleton className="h-5 w-5 mt-1" />
                <div>
                  <Skeleton className="h-5 w-64 mb-1" />
                  <Skeleton className="h-4 w-80" />
                </div>
              </div>
            </div>
              
            <Skeleton className="h-12 w-full mt-6" />
            
            <div className="flex justify-center items-center gap-2 mt-4">
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function OutsourceCheckoutPage() {
  return (
    <Suspense fallback={<CheckoutSkeleton />}>
      <CheckoutContent />
    </Suspense>
  )
}

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const taskId = searchParams.get('taskId')
  const campaignId = searchParams.get('campaignId')
  const { currentSite, updateBilling } = useSite()
  const { user } = useAuth()
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [taskData, setTaskData] = useState<TaskDetails | null>(null)
  const [campaignData, setCampaignData] = useState<any | null>(null)
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false)
  
  // Function to get a truncated preview of markdown instructions
  const getInstructionsPreview = (instructions: string) => {
    // Create a temporary element to parse HTML and extract text
    if (typeof document !== 'undefined') {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = instructions;
      
      // Get visible text content
      const textContent = tempDiv.textContent || tempDiv.innerText || '';
      
      // Limit to 100 characters and add ellipsis if longer
      return textContent.length > 100 
        ? textContent.substring(0, 100) + '...' 
        : textContent;
    } else {
      // For server-side rendering, use regex as fallback
      const stripHtml = (html: string) => {
        return html.replace(/<[^>]*>?/gm, '');
      };
      
      const textContent = stripHtml(instructions).trim();
      return textContent.length > 100 
        ? textContent.substring(0, 100) + '...' 
        : textContent;
    }
  }
  
  // Fallback task data if no taskId is provided or fetch fails
  const fallbackTask: TaskDetails = {
    id: "fallback-task",
    title: "UI Redesign for Dashboard",
    description: "Redesign our product dashboard to improve user experience and incorporate new analytics features.",
    instructions: "Please follow the brand guidelines while implementing this redesign.\n\n- Use the approved color palette\n- Maintain accessibility standards\n- Ensure mobile responsiveness",
    outsourceInstructions: "The task requires attention to responsive design principles and accessibility standards.",
    priority: "high",
    status: "backlog",
    completionStatus: "pending",
    budget: 199.00,
    estimatedHours: 18,
    estimatedDelivery: "3-5 days"
  }
  
  // Define task details that will be displayed in the bullet list
  const getTaskDetails = (task: TaskDetails) => {
    const details = [
      "Complete implementation of the requirement",
      "Documentation of the changes made",
      "Testing report"
    ]
    
    // Add outsource instructions if available
    if (task.outsourceInstructions) {
      const instructionLines = task.outsourceInstructions
        .split('\n')
        .filter(line => line.trim().length > 0)
      
      return [...instructionLines, ...details]
    }
    
    return details
  }

  // Define campaign details that will be displayed in the bullet list
  const getCampaignDetails = (campaign: any) => {
    const details = [
      "Complete implementation of the campaign strategy",
      "Performance metrics and analytics dashboard",
      "Final report with insights and recommendations",
      "Regular status updates"
    ]
    
    // Add outsource instructions if available
    if (campaign?.outsourceInstructions) {
      const instructionLines = campaign.outsourceInstructions
        .split('\n')
        .filter((line: string) => line.trim().length > 0)
      
      return [...instructionLines, ...details]
    }
    
    return details
  }
  
  useEffect(() => {
    // Function to fetch a task if taskId is provided
    const fetchTaskData = async () => {
      if (!taskId) return;
      
      try {
        const supabase = createClient()
        
        const { data, error } = await supabase
          .from('requirements')
          .select('*')
          .eq('id', taskId)
          .single()
          
        if (error) {
          console.error('Error fetching task data:', error)
          setTaskData(fallbackTask)
          return
        }
        
        // Transform the data to match our TaskDetails interface
        const taskDetails: TaskDetails = {
          id: data.id,
          title: data.title,
          description: data.description || "",
          instructions: data.instructions || "",
          outsourceInstructions: data.outsource_instructions || "",
          priority: data.priority,
          status: data.status,
          completionStatus: data.completion_status,
          budget: data.budget || 199.00,
          // Default values for fields that might not exist in the database
          estimatedHours: 18,
          estimatedDelivery: "3-5 days"
        }
        
        setTaskData(taskDetails)
      } catch (error) {
        console.error('Error in fetchTaskData:', error)
        setTaskData(fallbackTask)
      } finally {
        setIsLoading(false)
      }
    }

    // Function to fetch a campaign if campaignId is provided
    const fetchCampaignData = async () => {
      if (!campaignId) return;
      
      try {
        const supabase = createClient()
        
        // Fetch the campaign data
        const { data, error } = await supabase
          .from('campaigns')
          .select('*')
          .eq('id', campaignId)
          .single()
          
        if (error) {
          console.error('Error fetching campaign data:', error)
          setTaskData(fallbackTask) // Use fallback data
          return
        }
        
        setCampaignData(data)
        
        // Also set taskData with equivalent fields for consistent UI
        const taskDetails: TaskDetails = {
          id: data.id,
          title: data.title,
          description: data.description || "",
          instructions: data.description || "",
          outsourceInstructions: data.outsourceInstructions || "",
          priority: data.priority || "high",
          status: data.status || "active",
          completionStatus: data.completionStatus || "pending",
          budget: data.budget?.allocated || 499.00,
          estimatedHours: 40,
          estimatedDelivery: data.dueDate ? `Before ${new Date(data.dueDate).toLocaleDateString()}` : "2-3 weeks"
        }
        
        setTaskData(taskDetails)
      } catch (error) {
        console.error('Error in fetchCampaignData:', error)
        setTaskData(fallbackTask)
      } finally {
        setIsLoading(false)
      }
    }


    
    // Load data 
    const loadData = async () => {
      if (campaignId) {
        await fetchCampaignData()
      } else if (taskId) {
        await fetchTaskData()
      } else {
        // If no task or campaign ID, use fallback
        setTaskData(fallbackTask)
        setIsLoading(false)
      }
    }
    
    loadData()
  }, [taskId, campaignId, currentSite, user])
  
  const handleSubmit = async () => {
    if (!currentSite || !taskData || !user) {
      toast.error("Missing required information")
      return
    }

    // Debug: Log environment variables
    console.log('NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL)
    console.log('Current location:', window.location.origin)

    setIsSubmitting(true)
    try {
      // Create Stripe Checkout session
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_SERVER_URL}/api/integrations/stripe/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskId,
          campaignId,
          amount: taskData.budget || 199.00,
          currency: 'usd',
          productName: taskData.title,
          productDescription: taskData.description,
          productImages: [], // Could add project images here
          siteId: currentSite.id,
          userEmail: user.email,
          // URLs de retorno para el checkout
          successUrl: `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/outsource/confirmation`,
          cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/outsource/checkout?${taskId ? `taskId=${taskId}` : `campaignId=${campaignId}`}&canceled=true`,
        }),
      })

      const { sessionId, url, error } = await response.json()

      if (error) {
        throw new Error(error)
      }

      // Redirect to Stripe Checkout
      if (url) {
        window.location.href = url
      } else {
        throw new Error('No checkout URL received')
      }

    } catch (error: any) {
      console.error('Checkout error:', error)
      toast.error(error.message || "Failed to start checkout. Please try again.")
      setIsSubmitting(false)
    }
  }



  // Determine if we're dealing with a campaign or a task
  const isCampaign = !!campaignId;

  if (isLoading) {
    return <CheckoutSkeleton />
  }

  // If we don't have task data and we're not loading, something went wrong
  if (!taskData && !isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background/40 to-background flex flex-col items-center justify-center p-4">
        <Shield className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Project Not Found</h1>
        <p className="text-muted-foreground text-center mb-6">
          We couldn't find the project you're looking for. Please try again.
        </p>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    )
  }

  // If we have task data (either from API or fallback), render the checkout page
  return (
    <div className="min-h-screen bg-gradient-to-b from-background/40 to-background">
      <div className="container max-w-6xl px-4 py-8 mx-auto">
        {/* Back button and logo header */}
        <div className="flex items-center justify-between mb-12">
          <button 
            onClick={() => router.back()} 
            className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-5 w-5 mr-1" />
            Back
          </button>
          <div className="flex items-center">
            <span className="text-xl font-medium">Uncodie</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left Column - Task/Campaign Details */}
          <div>
            <h1 className="text-2xl font-medium mb-4">Pay Uncodie</h1>
            <h2 className="text-4xl font-bold mb-8">${taskData?.budget?.toFixed(2) || "199.00"}</h2>
            
            <div className="mb-6 flex items-start gap-4">
              <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center flex-shrink-0">
                <Shield className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="w-full">
                <h3 className="font-medium">{taskData?.title}</h3>
                <p className="text-sm text-muted-foreground mb-4">{taskData?.description}</p>
                
                {/* Task Instructions Section - Always visible with expand option */}
                {taskData?.instructions && (
                  <div className="bg-muted/30 rounded-lg mb-3 overflow-hidden border border-border/30">
                    <div className="p-4">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-medium">Project Instructions</h4>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setIsInstructionsOpen(!isInstructionsOpen)}
                          className="h-8 px-2 text-muted-foreground hover:text-foreground"
                        >
                          {isInstructionsOpen ? "Show less" : "Show more"}
                          <ChevronDown 
                            className={`ml-1 h-4 w-4 transition-transform duration-200 ${isInstructionsOpen ? 'rotate-180' : ''}`} 
                          />
                        </Button>
                      </div>
                      
                      {/* Always visible preview */}
                      <div className="text-sm">
                        {!isInstructionsOpen ? (
                          <div className="whitespace-pre-line text-muted-foreground">
                            {getInstructionsPreview(taskData.instructions)}
                          </div>
                        ) : (
                          <div 
                            className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-medium prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground"
                            dangerouslySetInnerHTML={{ __html: taskData.instructions }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Task/Campaign Details Section */}
                <div className="bg-muted/30 rounded-lg p-4 mb-3 border border-border/30">
                  <h4 className="font-medium mb-2">{isCampaign ? "Campaign Details" : "Task Details"}</h4>
                  <ul className="space-y-2">
                    {isCampaign 
                      ? getCampaignDetails(campaignData).map((detail, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                            <span>{detail}</span>
                          </li>
                        ))
                      : getTaskDetails(taskData || fallbackTask).map((detail, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                            <span>{detail}</span>
                          </li>
                        ))
                    }
                  </ul>
                </div>
                
                {/* Special Outsourcing Instructions */}
                {taskData?.outsourceInstructions && taskData.outsourceInstructions.trim() !== "" && (
                  <div className="bg-primary/10 rounded-lg p-4 mb-3 border border-primary/20">
                    <h4 className="font-medium mb-2 text-primary">Special Outsourcing Instructions</h4>
                    <div 
                      className="text-sm prose prose-sm max-w-none dark:prose-invert prose-headings:font-medium prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground"
                      dangerouslySetInnerHTML={{ __html: taskData.outsourceInstructions }}
                    />
                  </div>
                )}
                
                {/* Campaign Type & Segments - Only for campaigns */}
                {isCampaign && campaignData && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-3 border border-blue-200 dark:border-blue-900/30">
                    <h4 className="font-medium mb-2 text-blue-700 dark:text-blue-400">Campaign Information</h4>
                    <div className="space-y-3">
                      {campaignData.type && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">Type:</span> 
                          <span>{campaignData.type.charAt(0).toUpperCase() + campaignData.type.slice(1)}</span>
                        </div>
                      )}
                      {campaignData.status && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">Status:</span> 
                          <Badge className={
                            campaignData.status === "active" ? "bg-green-100 text-green-800 border-green-200" :
                            campaignData.status === "pending" ? "bg-yellow-100 text-yellow-800 border-yellow-200" :
                            "bg-blue-100 text-blue-800 border-blue-200"
                          }>
                            {campaignData.status.charAt(0).toUpperCase() + campaignData.status.slice(1)}
                          </Badge>
                        </div>
                      )}
                      {campaignData.priority && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">Priority:</span> 
                          <Badge className={
                            campaignData.priority === "high" ? "bg-red-100 text-red-800 border-red-200" :
                            campaignData.priority === "medium" ? "bg-yellow-100 text-yellow-800 border-yellow-200" :
                            "bg-green-100 text-green-800 border-green-200"
                          }>
                            {campaignData.priority.charAt(0).toUpperCase() + campaignData.priority.slice(1)}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Estimated Times */}
                <div className="flex flex-wrap gap-4 text-sm mt-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>Est. {isCampaign ? "40-60" : taskData?.estimatedHours || 18} hours of work</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>Delivery in {taskData?.estimatedDelivery || (isCampaign ? "2-3 weeks" : "3-5 days")}</span>
                  </div>
                </div>
              </div>
              <div className="ml-auto shrink-0">
                <span className="font-medium">${taskData?.budget?.toFixed(2) || "199.00"}</span>
              </div>
            </div>
            

            

          </div>
          
          {/* Right Column - Secure Checkout */}
          <div>
            <h2 className="text-2xl font-medium mb-6">Secure Checkout</h2>
            
            {/* Stripe Checkout Benefits */}
            <div className="bg-muted/30 rounded-lg p-6 mb-6 border border-border/30">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Powered by Stripe
              </h3>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Industry-leading security and encryption</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Multiple payment methods supported</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>3D Secure authentication included</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>PCI DSS compliant payment processing</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Mobile and desktop optimized</span>
                </li>
              </ul>
            </div>

            {/* User Information */}
            {user && (
              <div className="bg-muted/20 rounded-lg p-4 mb-6 border border-border/20">
                <h4 className="font-medium mb-2">Account Information</h4>
                <div className="text-sm text-muted-foreground">
                  <p>Logged in as: {user.email}</p>
                  <p>You'll receive updates about your project at this email address.</p>
                </div>
              </div>
            )}

            {/* Payment Summary */}
            <div className="bg-primary/5 rounded-lg p-4 mb-6 border border-primary/20">
              <h4 className="font-medium mb-3 text-primary">What happens next?</h4>
              <ol className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">1</span>
                  <span>Secure payment processing via Stripe</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">2</span>
                  <span>Project assigned to our expert team</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">3</span>
                  <span>Regular updates via email and dashboard</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">4</span>
                  <span>Delivery in {taskData?.estimatedDelivery || (isCampaign ? "2-3 weeks" : "3-5 days")}</span>
                </li>
              </ol>
            </div>
              
            <Button 
              className="w-full h-12 text-base"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-background border-t-transparent"></span>
                  Redirecting to Checkout...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Continue to Secure Checkout
                </>
              )}
            </Button>
            
            <div className="flex justify-center items-center gap-2 text-sm text-muted-foreground mt-4">
              <Shield className="h-4 w-4" />
              256-bit SSL encryption | PCI DSS compliant
            </div>
            
            <div className="flex justify-center items-center gap-4 mt-4">
              <img 
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Stripe_Logo%2C_revised_2016.svg/1200px-Stripe_Logo%2C_revised_2016.svg.png"
                alt="Stripe" 
                className="h-6 w-auto opacity-60" 
              />
              <span className="text-xs text-muted-foreground">Trusted by millions worldwide</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 