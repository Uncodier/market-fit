"use client"

import React, { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/app/components/ui/card"
import { Button } from "@/app/components/ui/button"
import { Badge } from "@/app/components/ui/badge"
import { ChevronLeft, MessageSquare, Mail, Phone, User } from "@/app/components/ui/icons"
import { format } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { Skeleton } from "@/app/components/ui/skeleton"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"
import { useSite } from "@/app/context/SiteContext"
import { toast } from "sonner"

// Types for conversations
interface Conversation {
  id: string
  type: 'email' | 'call' | 'chat'
  subject: string
  message: string
  date: string
  status: 'sent' | 'received' | 'scheduled'
  leadId?: string
  leadName?: string
  siteId?: string
  createdAt?: string
  updatedAt?: string
}

// Status styles for conversations
const STATUS_STYLES = {
  sent: "bg-green-50 text-green-700 hover:bg-green-50 border-green-200",
  received: "bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200",
  scheduled: "bg-yellow-50 text-yellow-700 hover:bg-yellow-50 border-yellow-200",
}

// Type icons for conversations
const TYPE_ICONS = {
  email: <Mail className="h-5 w-5" />,
  call: <Phone className="h-5 w-5" />,
  chat: <MessageSquare className="h-5 w-5" />,
}

export default function ChatDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { currentSite } = useSite()
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!params.id) return
    
    const fetchConversation = async () => {
      setLoading(true)
      // This is where you would actually fetch the conversation from your API
      // For now, we'll just simulate it with a timeout and mock data
      
      try {
        // Check if the ID starts with "chat-" which indicates it's a mock conversation
        if ((params.id as string).startsWith('chat-')) {
          await new Promise(resolve => setTimeout(resolve, 800))
          
          // Extract lead ID and sequence from conversation ID
          const parts = (params.id as string).split('-')
          const leadIdPrefix = parts[1]
          const sequence = parseInt(parts[2])
          
          // Generate mock conversation based on sequence
          let mockConversation: Conversation = {
            id: params.id as string,
            type: sequence % 2 === 0 ? 'email' : 'call',
            subject: sequence === 1 ? 'Introduction to Market Fit' : 
                     sequence === 2 ? 'RE: Introduction to Market Fit' : 
                     sequence === 3 ? 'Initial discovery call' :
                     sequence === 4 ? 'Follow-up and price quote' : 'Product Demo',
            message: sequence === 1 ? 'Hello! I wanted to introduce you to our product. Market Fit is a powerful platform designed to help businesses understand their position in the market, analyze customer feedback, and optimize their product offerings based on real data. Our unique methodology combines sentiment analysis, competitor benchmarking, and customer journey mapping to provide you with actionable insights.\n\nI would be happy to schedule a quick call to discuss how Market Fit can specifically help your business grow and adapt to changing market conditions. Please let me know if you have any availability next week for a brief demonstration.\n\nLooking forward to connecting with you!' :
                    sequence === 2 ? 'Thank you for reaching out. I\'m interested in learning more about Market Fit and how it could help our business. We\'ve been looking for a solution to better understand our market position and customer feedback.\n\nI would be available for a call next Tuesday at 2:00 PM. Would that work for you?\n\nBest regards,' :
                    sequence === 3 ? 'Discussed product features and pricing. Customer showed interest in the sentiment analysis and competitor benchmarking features. They mentioned they currently use a manual process for collecting customer feedback but are looking to automate and get more actionable insights.\n\nThey have a team of 5 marketing professionals who would be using the platform. Their main pain points are:\n1. Difficulty collating feedback from multiple channels\n2. Lack of quantifiable metrics for market position\n3. Time-consuming manual analysis\n\nNext step: Send follow-up email with pricing options for their team size and schedule a product demo for next week.' :
                    sequence === 4 ? 'Based on our conversation yesterday, I\'ve prepared a quote for your team of 5 users. We have two options that might work well for your needs:\n\n1. Professional Plan: $99/user/month (billed annually) or $129/user/month (billed monthly)\n2. Enterprise Plan: $199/user/month (billed annually) or $249/user/month (billed monthly)\n\nThe Enterprise Plan includes advanced features like custom integrations, priority support, and dedicated onboarding that might be valuable given your current challenges with data collection from multiple channels.\n\nI\'ve also scheduled our product demo for next Wednesday at 10:00 AM as discussed. You\'ll receive a calendar invitation shortly.\n\nPlease let me know if you have any questions about the pricing or if you need any additional information before our demo.\n\nLooking forward to our next conversation!' :
                    'Scheduled demo for next week on Wednesday at 10:00 AM. Will cover all main features with special focus on the sentiment analysis engine and multi-channel data collection. Customer requested to include their IT manager in the demo to discuss potential integration with their existing CRM system.',
            date: new Date(Date.now() - (5 - sequence) * 24 * 60 * 60 * 1000).toISOString(),
            status: sequence % 2 === 0 ? 'received' : 'sent',
            leadId: `lead-${leadIdPrefix}`,
            leadName: 'Client Name',
            siteId: currentSite?.id,
            createdAt: new Date(Date.now() - (5 - sequence) * 24 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date(Date.now() - (5 - sequence) * 24 * 60 * 60 * 1000).toISOString()
          }
          
          setConversation(mockConversation)
        } else {
          // Real data fetch would go here
          const supabase = createClient()
          
          const { data, error } = await supabase
            .from('conversations')
            .select('*')
            .eq('id', params.id)
            .single()
          
          if (error) {
            console.error("Error fetching conversation:", error)
            toast.error("Conversation not found")
            router.push("/leads")
            return
          }
          
          setConversation({
            id: data.id,
            type: data.type || 'email',
            subject: data.subject || 'No Subject',
            message: data.message || '',
            date: data.date,
            status: data.status || 'sent',
            leadId: data.lead_id,
            leadName: data.lead_name,
            siteId: data.site_id,
            createdAt: data.created_at,
            updatedAt: data.updated_at
          })
        }
      } catch (error) {
        console.error("Error loading conversation:", error)
        toast.error("Failed to load conversation")
      } finally {
        setLoading(false)
      }
    }
    
    fetchConversation()
  }, [params.id, currentSite?.id, router])
  
  const handleGoBack = () => {
    // Extract lead ID from conversation.leadId
    if (conversation?.leadId) {
      router.push(`/leads/${conversation.leadId}`)
    } else {
      router.push("/leads")
    }
  }
  
  // Function to format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown date'
    try {
      const date = new Date(dateString)
      return format(date, 'MMMM d, yyyy h:mm a')
    } catch (error) {
      return dateString
    }
  }
  
  if (loading) {
    return (
      <div className="flex-1 p-16 space-y-8">
        <StickyHeader>
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-1"
              onClick={handleGoBack}
            >
              <ChevronLeft className="h-4 w-4" />
              <Skeleton className="h-4 w-24" />
            </Button>
          </div>
        </StickyHeader>
        
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-3/4 mb-4" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div>
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24 mt-1" />
                </div>
              </div>
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </CardContent>
        </Card>
      </div>
    )
  }
  
  if (!conversation) {
    return (
      <div className="flex-1 p-16">
        <StickyHeader>
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-1"
              onClick={handleGoBack}
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Leads
            </Button>
          </div>
        </StickyHeader>
        
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold">Conversation not found</h2>
            <p className="text-muted-foreground mb-4">The conversation you're looking for doesn't exist or has been deleted.</p>
            <Button onClick={handleGoBack}>Return to Leads</Button>
          </CardContent>
        </Card>
      </div>
    )
  }
  
  return (
    <div className="flex-1 p-0">
      <StickyHeader>
        <div className="px-16 flex items-center">
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-1"
            onClick={handleGoBack}
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Lead
          </Button>
        </div>
      </StickyHeader>
      
      <div className="px-16 py-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold mb-4">{conversation.subject}</CardTitle>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src="" />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {conversation.status === 'sent' ? 'ME' : 'CL'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{conversation.status === 'sent' ? 'You' : conversation.leadName || 'Client'}</p>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <div className="flex items-center mr-4">
                      {format(new Date(conversation.date), 'MMM d, yyyy • h:mm a')}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 mr-4">
                  {TYPE_ICONS[conversation.type]}
                  <span className="capitalize text-sm">{conversation.type}</span>
                </div>
                <Badge className={`${STATUS_STYLES[conversation.status]}`}>
                  {conversation.status}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              {conversation.message.split('\n\n').map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </CardContent>
          <CardFooter className="border-t flex justify-between py-4">
            <div className="text-sm text-muted-foreground">
              ID: {conversation.id}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleGoBack}>
                Back
              </Button>
              <Button onClick={() => router.push(`/chats/${conversation.id}/edit`)}>
                Edit
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
} 