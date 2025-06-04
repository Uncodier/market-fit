"use client"

import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Textarea } from "@/app/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/app/components/ui/radio-group"
import { Badge } from "@/app/components/ui/badge"
import { User, DollarSign, Target, FileText } from "@/app/components/ui/icons"
import { AttributionData } from "@/app/leads/types"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

interface AttributionModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  leadName: string
  onConfirm: (attribution: AttributionData) => Promise<void>
  onCancel: () => void
}

export function AttributionModal({
  isOpen,
  onOpenChange,
  leadName,
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
      toast.error("Error setting attribution")
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
            <Target className="h-5 w-5 text-green-600" />
            Lead Conversion Attribution
          </DialogTitle>
          <DialogDescription>
            <strong>{leadName}</strong> is being converted to a customer. 
            Please provide attribution details to help improve our lead qualification process.
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

          {/* Final Amount */}
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

          {/* Market Fit Influence */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              Attribution Source
            </Label>
            <RadioGroup
              value={formData.is_market_fit_influenced}
              onValueChange={(value: string) => setFormData(prev => ({ ...prev, is_market_fit_influenced: value }))}
              className="space-y-3"
            >
              <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="true" id="market-fit" className="mt-0.5" />
                <Label htmlFor="market-fit" className="cursor-pointer flex-1">
                  <div className="space-y-1">
                    <span className="font-medium text-sm">Market Fit activities</span>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      This lead was converted thanks to our marketing campaigns, content, or sales activities
                    </p>
                  </div>
                </Label>
              </div>
              <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="false" id="external" className="mt-0.5" />
                <Label htmlFor="external" className="cursor-pointer flex-1">
                  <div className="space-y-1">
                    <span className="font-medium text-sm">External/Direct</span>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      This lead converted independently or through external channels
                    </p>
                  </div>
                </Label>
              </div>
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
              placeholder="Add any additional context about this conversion..."
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
            />
          </div>

          {/* Information Box */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Why this matters:</strong> This attribution data helps us understand which lead 
              generation strategies work best, allowing us to focus on similar prospects and improve 
              our qualification process.
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
          >
            {isLoading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                Converting...
              </>
            ) : (
              <>
                <Target className="h-4 w-4" />
                Convert Lead
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 