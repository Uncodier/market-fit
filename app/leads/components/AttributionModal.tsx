"use client"

import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Textarea } from "@/app/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/app/components/ui/radio-group"
import { Badge } from "@/app/components/ui/badge"
import { User, DollarSign, Target, FileText, AlertTriangle, XCircle } from "@/app/components/ui/icons"
import { AttributionData } from "@/app/leads/types"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

interface AttributionModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  leadName: string
  statusType: "converted" | "lost"
  onConfirm: (attribution: AttributionData) => Promise<void>
  onCancel: () => void
}

export function AttributionModal({
  isOpen,
  onOpenChange,
  leadName,
  statusType,
  onConfirm,
  onCancel
}: AttributionModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null)
  const [formData, setFormData] = useState({
    final_amount: "",
    is_market_fit_influenced: "true",
    notes: ""
  })

  // Configuration based on status type
  const config = statusType === "converted" 
    ? {
        title: "Lead Conversion Attribution",
        icon: <Target className="h-5 w-5 text-green-600" />,
        description: (
          <>
            <strong>{leadName}</strong> is being converted to a customer. 
            Please provide attribution details to help improve our lead qualification process.
          </>
        ),
        buttonText: "Convert Lead",
        buttonIcon: <Target className="h-4 w-4" />,
        showFinalAmount: true,
        influenceLabel: "Attribution Source",
        influenceOptions: [
          {
            value: "true",
            label: "Market Fit activities",
            description: "This lead was converted thanks to our marketing campaigns, content, or sales activities"
          },
          {
            value: "false", 
            label: "External/Direct",
            description: "This lead converted independently or through external channels"
          }
        ],
        notesPlaceholder: "Add any additional context about this conversion...",
        infoText: "This attribution data helps us understand which lead generation strategies work best, allowing us to focus on similar prospects and improve our qualification process."
      }
    : {
        title: "Lead Loss Attribution",
        icon: <XCircle className="h-5 w-5 text-red-600" />,
        description: (
          <>
            <strong>{leadName}</strong> is being marked as lost. 
            Please provide the reason to help improve our lead qualification process.
          </>
        ),
        buttonText: "Mark as Lost",
        buttonIcon: <XCircle className="h-4 w-4" />,
        showFinalAmount: false,
        influenceLabel: "Loss Reason",
        influenceOptions: [
          {
            value: "true",
            label: "Internal/Process Issue", 
            description: "Lost due to our pricing, product limitations, poor follow-up, or internal issues"
          },
          {
            value: "false",
            label: "External/Not a Fit",
            description: "Lost due to budget constraints, timing, competitor, or simply not a good fit"
          }
        ],
        notesPlaceholder: "Describe why this lead was lost and what could be improved...",
        infoText: "Understanding why leads are lost helps us identify patterns, improve our qualification process, and focus on better prospects."
      }

  useEffect(() => {
    if (isOpen) {
      loadCurrentUser()
    }
  }, [isOpen])

  const loadCurrentUser = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Get user profile data
        const { data: profile } = await supabase
          .from('users')
          .select('name, email')
          .eq('id', user.id)
          .single()
        
        setCurrentUser({
          id: user.id,
          name: profile?.name || profile?.email || user.email || 'Unknown User'
        })
      }
    } catch (error) {
      console.error('Error loading current user:', error)
      setCurrentUser({
        id: 'unknown',
        name: 'Unknown User'
      })
    }
  }

  const handleSubmit = async () => {
    if (!currentUser) {
      toast.error("User information not available")
      return
    }

    setIsLoading(true)
    try {
      const attribution: AttributionData = {
        user_id: currentUser.id,
        user_name: currentUser.name,
        date: new Date().toISOString(),
        final_amount: formData.final_amount ? parseFloat(formData.final_amount) : undefined,
        is_market_fit_influenced: formData.is_market_fit_influenced === "true",
        notes: formData.notes.trim() || undefined
      }

      await onConfirm(attribution)
      onOpenChange(false)
      
      // Reset form
      setFormData({
        final_amount: "",
        is_market_fit_influenced: "true",
        notes: ""
      })
    } catch (error) {
      console.error('Error confirming attribution:', error)
      toast.error(`Error ${statusType === "converted" ? "converting" : "marking as lost"} lead`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    onCancel()
    onOpenChange(false)
    
    // Reset form
    setFormData({
      final_amount: "",
      is_market_fit_influenced: "true",
      notes: ""
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {config.icon}
            {config.title}
          </DialogTitle>
          <DialogDescription>
            {config.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* User Information */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="bg-primary/10 rounded-md flex items-center justify-center w-10 h-10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Attributed by</p>
              <p className="text-sm text-muted-foreground">
                {currentUser?.name || 'Loading...'}
              </p>
            </div>
            <Badge variant="outline" className="ml-auto">
              {new Date().toLocaleDateString()}
            </Badge>
          </div>

          {/* Final Amount - Only for conversions */}
          {config.showFinalAmount && (
            <div className="space-y-2">
              <Label htmlFor="final_amount" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                Final Amount (optional)
              </Label>
              <Input
                id="final_amount"
                type="number"
                step="0.01"
                placeholder="Enter the final deal amount"
                value={formData.final_amount}
                onChange={(e) => setFormData(prev => ({ ...prev, final_amount: e.target.value }))}
              />
            </div>
          )}

          {/* Attribution Source / Loss Reason */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              {statusType === "converted" ? (
                <Target className="h-4 w-4 text-muted-foreground" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              )}
              {config.influenceLabel}
            </Label>
            <RadioGroup
              value={formData.is_market_fit_influenced}
              onValueChange={(value: string) => setFormData(prev => ({ ...prev, is_market_fit_influenced: value }))}
              className="space-y-3"
            >
              {config.influenceOptions.map((option, index) => (
                <div key={option.value} className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value={option.value} id={`option-${index}`} className="mt-0.5" />
                  <Label htmlFor={`option-${index}`} className="cursor-pointer flex-1">
                    <div className="space-y-1">
                      <span className="font-medium text-sm">{option.label}</span>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {option.description}
                      </p>
                    </div>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Additional Notes (optional)
            </Label>
            <Textarea
              id="notes"
              placeholder={config.notesPlaceholder}
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
            />
          </div>

          {/* Information Box */}
          <div className={`p-3 border rounded-lg ${
            statusType === "converted" 
              ? "bg-blue-50 border-blue-200" 
              : "bg-amber-50 border-amber-200"
          }`}>
            <p className={`text-sm ${
              statusType === "converted" 
                ? "text-blue-800" 
                : "text-amber-800"
            }`}>
              <strong>Why this matters:</strong> {config.infoText}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="gap-2"
            variant={statusType === "converted" ? "default" : "destructive"}
          >
            {isLoading ? (
              <>
                <div className="h-4 w-4 animate-pulse bg-white/20 rounded" />
                {statusType === "converted" ? "Converting..." : "Marking as Lost..."}
              </>
            ) : (
              <>
                {config.buttonIcon}
                {config.buttonText}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 