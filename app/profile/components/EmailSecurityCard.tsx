"use client"

import { useLocalization } from "@/app/context/LocalizationContext"

import React, { useState } from "react"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardDescription,
  SectionCardContent,
  SectionCardFooter,
} from "@/app/components/ui/section-card"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Shield, MessageSquare, AlertCircle } from "@/app/components/ui/icons"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { ChangeEmailModal } from "./ChangeEmailModal"
import { EmailChangeStatus } from "@/lib/services/email-change.service"
import Link from "next/link"

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
  const { t } = useLocalization()
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <>
      <SectionCard>
        <SectionCardHeader>
          <SectionCardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t("account.email.title")}
          </SectionCardTitle>
        </SectionCardHeader>
        <SectionCardContent className="space-y-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">{t("checkout.emailAddress")}</label>
              <div className="relative">
                <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  className="pl-12 h-12 text-base transition-colors duration-200" 
                  aria-label={t("checkout.emailAddress")}
                  value={emailChangeStatus.currentEmail || email}
                  disabled 
                />
              </div>
              <p className="text-xs mt-2 text-muted-foreground">
                {t("account.email.addressHelp")}
              </p>
            </div>

            {emailChangeStatus.isPending && emailChangeStatus.pendingEmail && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                      {t("account.email.pending")}
                    </p>
                    <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                      {t("account.email.sentTo")} <strong>{emailChangeStatus.pendingEmail}</strong>{t("account.email.pendingInstructions")}
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-2">
                      {t("account.email.currentActive", { email: emailChangeStatus.currentEmail || email })}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </SectionCardContent>
        <ActionFooter>
          <Button
            asChild
            variant="outline"
            disabled={isUpdating}
          >
            <Link href="/security">
              {t("account.email.changePassword")}
            </Link>
          </Button>
          <Button
            onClick={() => setIsModalOpen(true)}
            variant="outline"
            disabled={isUpdating}
          >
            {t("account.email.change")}
          </Button>
        </ActionFooter>
      </SectionCard>

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

