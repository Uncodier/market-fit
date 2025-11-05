"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Shield, MessageSquare, AlertCircle } from "@/app/components/ui/icons"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { ChangeEmailModal } from "./ChangeEmailModal"
import { EmailChangeStatus } from "@/lib/services/email-change.service"

interface EmailSecurityCardProps {
  email: string
  emailChangeStatus: EmailChangeStatus
  onRequestEmailChange: (newEmail: string, password: string) => Promise<boolean>
  isUpdating?: boolean
}

export function EmailSecurityCard({
  email,
  emailChangeStatus,
  onRequestEmailChange,
  isUpdating = false
}: EmailSecurityCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <>
      <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Email & Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 px-8 pb-8">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Email Address</label>
              <div className="relative">
                <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  className="pl-12 h-12 text-base transition-colors duration-200" 
                  value={emailChangeStatus.currentEmail || email}
                  disabled 
                />
              </div>
              <p className="text-xs mt-2 text-muted-foreground">
                Your email address is used for account verification and notifications.
              </p>
            </div>

            {emailChangeStatus.isPending && emailChangeStatus.pendingEmail && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                      Email Change Pending
                    </p>
                    <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                      A verification email has been sent to <strong>{emailChangeStatus.pendingEmail}</strong>. 
                      Please check your inbox and click the confirmation link to complete the change.
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-2">
                      Your current email ({emailChangeStatus.currentEmail || email}) will remain active until you confirm the new one.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
        <ActionFooter>
          <Button
            onClick={() => setIsModalOpen(true)}
            variant="outline"
            disabled={isUpdating}
          >
            Change Email
          </Button>
        </ActionFooter>
      </Card>

      <ChangeEmailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentEmail={emailChangeStatus.currentEmail || email}
        onRequestEmailChange={onRequestEmailChange}
        isUpdating={isUpdating}
      />
    </>
  )
}

