import { toast } from "sonner"
import { type SiteFormValues } from "./form-schema"
import { type Site } from "../../context/SiteContext"
import { secureTokensService } from "../../services/secure-tokens-service"

import { type SaveOptions, saveSiteWithSettings, shouldPreventRefresh } from "./save-settings-shared"

// Partial save handler for Channels section
export const handleSaveChannels = async (data: SiteFormValues, options: SaveOptions) => {
  const { currentSite, refreshSites, setIsSaving } = options

  if (!currentSite) return false

  try {
    setIsSaving(true)

    const { channels, tracking } = data
    const siteTracking = {
      ...currentSite.tracking,
      track_visitors: Boolean(tracking?.track_visitors),
      track_actions: Boolean(tracking?.track_actions),
      record_screen: Boolean(tracking?.record_screen),
      enable_chat: Boolean(tracking?.enable_chat),
      chat_accent_color: tracking?.chat_accent_color || "#e0ff17",
      allow_anonymous_messages: Boolean(tracking?.allow_anonymous_messages),
      chat_position: tracking?.chat_position || "bottom-right",
      welcome_message: tracking?.welcome_message || "Welcome to our website! How can we assist you today?",
      chat_title: tracking?.chat_title || "Chat with us",
      privacy: {
        ...currentSite.tracking?.privacy,
        cookie_consent: Boolean(tracking?.show_cookie_consent)
      }
    }

    // Handle secure token storage if new values are provided
    if (currentSite.id && channels?.email?.password && 
        channels.email.password.trim() !== '' && 
        channels.email.password !== 'STORED_SECURELY') {
      try {
        const emailIdentifier = channels.email.email || 'default'
        await secureTokensService.storeToken(
          currentSite.id,
          'email',
          channels.email.password,
          emailIdentifier
        )
        channels.email.password = ""
      } catch (tokenError) {
        console.error("Error storing email credentials:", tokenError)
      }
    }

    const settingsUpdate: any = {
      site_id: currentSite.id,
      channels: {
        email: {
          enabled: channels?.email?.enabled ?? currentSite.settings?.channels?.email?.enabled ?? false,
          email: channels?.email?.email ?? currentSite.settings?.channels?.email?.email ?? "",
          password: channels?.email?.password === 'STORED_SECURELY' || channels?.email?.password === 'PASSWORD_PRESENT' 
            ? "PASSWORD_PRESENT" // ggignore
            : (channels?.email?.password ?? currentSite.settings?.channels?.email?.password ?? ""),
          aliases: channels?.email?.aliases ?? currentSite.settings?.channels?.email?.aliases ?? "",
          incomingServer: channels?.email?.incomingServer ?? currentSite.settings?.channels?.email?.incomingServer ?? "",
          incomingPort: channels?.email?.incomingPort ?? currentSite.settings?.channels?.email?.incomingPort ?? "",
          outgoingServer: channels?.email?.outgoingServer ?? currentSite.settings?.channels?.email?.outgoingServer ?? "",
          outgoingPort: channels?.email?.outgoingPort ?? currentSite.settings?.channels?.email?.outgoingPort ?? "",
          status: (channels?.email?.status ?? currentSite.settings?.channels?.email?.status ?? "not_configured") as "not_configured" | "password_required" | "pending_sync" | "synced"
        },
        whatsapp: {
          enabled: channels?.whatsapp?.enabled ?? currentSite.settings?.channels?.whatsapp?.enabled ?? false,
          setupType: channels?.whatsapp?.setupType ?? currentSite.settings?.channels?.whatsapp?.setupType ?? undefined,
          country: channels?.whatsapp?.country ?? currentSite.settings?.channels?.whatsapp?.country ?? undefined,
          region: channels?.whatsapp?.region ?? currentSite.settings?.channels?.whatsapp?.region ?? undefined,
          account_sid: channels?.whatsapp?.account_sid ?? currentSite.settings?.channels?.whatsapp?.account_sid ?? undefined,
          existingNumber: channels?.whatsapp?.existingNumber ?? currentSite.settings?.channels?.whatsapp?.existingNumber ?? undefined,
          setupRequested: channels?.whatsapp?.setupRequested ?? currentSite.settings?.channels?.whatsapp?.setupRequested ?? false,
          status: (channels?.whatsapp?.status ?? currentSite.settings?.channels?.whatsapp?.status ?? "not_configured") as "not_configured" | "pending" | "active"
        },
        agent_email: {
          domain: channels?.agent_email?.domain ?? currentSite.settings?.channels?.agent_email?.domain ?? undefined,
          customDomain: channels?.agent_email?.customDomain ?? currentSite.settings?.channels?.agent_email?.customDomain ?? undefined,
          username: channels?.agent_email?.username ?? currentSite.settings?.channels?.agent_email?.username ?? currentSite.settings?.channels?.agent_email?.data?.username ?? undefined,
          displayName: channels?.agent_email?.displayName ?? currentSite.settings?.channels?.agent_email?.displayName ?? currentSite.settings?.channels?.agent_email?.data?.displayName ?? undefined,
          setupRequested: channels?.agent_email?.setupRequested ?? currentSite.settings?.channels?.agent_email?.setupRequested ?? false,
          status: (channels?.agent_email?.status ?? currentSite.settings?.channels?.agent_email?.status ?? "not_configured") as "not_configured" | "pending" | "active" | "waiting_for_verification",
          // Preserve metadata fields directly in agent_email (matching API structure)
          domain_id: currentSite.settings?.channels?.agent_email?.domain_id ?? currentSite.settings?.channels?.agent_email?.data?.domain_id,
          inbox_id: currentSite.settings?.channels?.agent_email?.inbox_id ?? currentSite.settings?.channels?.agent_email?.data?.inbox_id,
          id: currentSite.settings?.channels?.agent_email?.id ?? currentSite.settings?.channels?.agent_email?.data?.id,
          dns_records: currentSite.settings?.channels?.agent_email?.dns_records ?? currentSite.settings?.channels?.agent_email?.data?.dns_records,
          domain_status: currentSite.settings?.channels?.agent_email?.domain_status ?? currentSite.settings?.channels?.agent_email?.data?.domain_status,
          error_message: currentSite.settings?.channels?.agent_email?.error_message ?? currentSite.settings?.channels?.agent_email?.data?.error_message,
          created_at: currentSite.settings?.channels?.agent_email?.created_at,
          // Also keep data for backward compatibility
          data: {
            domain: channels?.agent_email?.domain === "custom" ? channels?.agent_email?.customDomain : channels?.agent_email?.domain ?? currentSite.settings?.channels?.agent_email?.data?.domain,
            username: channels?.agent_email?.username ?? currentSite.settings?.channels?.agent_email?.username ?? currentSite.settings?.channels?.agent_email?.data?.username,
            displayName: channels?.agent_email?.displayName ?? currentSite.settings?.channels?.agent_email?.displayName ?? currentSite.settings?.channels?.agent_email?.data?.displayName,
            domain_id: currentSite.settings?.channels?.agent_email?.domain_id ?? currentSite.settings?.channels?.agent_email?.data?.domain_id,
            inbox_id: currentSite.settings?.channels?.agent_email?.inbox_id ?? currentSite.settings?.channels?.agent_email?.data?.inbox_id,
            id: currentSite.settings?.channels?.agent_email?.id ?? currentSite.settings?.channels?.agent_email?.data?.id,
            dns_records: currentSite.settings?.channels?.agent_email?.dns_records ?? currentSite.settings?.channels?.agent_email?.data?.dns_records,
            domain_status: currentSite.settings?.channels?.agent_email?.domain_status ?? currentSite.settings?.channels?.agent_email?.data?.domain_status,
            error_message: currentSite.settings?.channels?.agent_email?.error_message ?? currentSite.settings?.channels?.agent_email?.data?.error_message
          }
        },
        agent_whatsapp: {
          country: channels?.agent_whatsapp?.country ?? currentSite.settings?.channels?.agent_whatsapp?.country ?? undefined,
          region: channels?.agent_whatsapp?.region ?? currentSite.settings?.channels?.agent_whatsapp?.region ?? undefined,
          setupRequested: channels?.agent_whatsapp?.setupRequested ?? currentSite.settings?.channels?.agent_whatsapp?.setupRequested ?? false,
          status: (channels?.agent_whatsapp?.status ?? currentSite.settings?.channels?.agent_whatsapp?.status ?? "not_configured") as "not_configured" | "pending" | "active"
        },
        connections: channels?.connections ?? currentSite.settings?.channels?.connections ?? [],
        website: {
          enabled: (tracking?.track_visitors || tracking?.track_actions || tracking?.record_screen || tracking?.enable_chat) ?? channels?.website?.enabled ?? currentSite.settings?.channels?.website?.enabled ?? false,
          track_visitors: tracking?.track_visitors ?? channels?.website?.track_visitors ?? currentSite.settings?.channels?.website?.track_visitors ?? false,
          track_actions: tracking?.track_actions ?? channels?.website?.track_actions ?? currentSite.settings?.channels?.website?.track_actions ?? false,
          record_screen: tracking?.record_screen ?? channels?.website?.record_screen ?? currentSite.settings?.channels?.website?.record_screen ?? false,
          show_cookie_consent: tracking?.show_cookie_consent ?? channels?.website?.show_cookie_consent ?? currentSite.settings?.channels?.website?.show_cookie_consent ?? false,
          enable_chat: tracking?.enable_chat ?? channels?.website?.enable_chat ?? currentSite.settings?.channels?.website?.enable_chat ?? false,
          chat_accent_color: tracking?.chat_accent_color ?? channels?.website?.chat_accent_color ?? currentSite.settings?.channels?.website?.chat_accent_color ?? "#e0ff17",
          allow_anonymous_messages: tracking?.allow_anonymous_messages ?? channels?.website?.allow_anonymous_messages ?? currentSite.settings?.channels?.website?.allow_anonymous_messages ?? false,
          chat_position: tracking?.chat_position ?? channels?.website?.chat_position ?? currentSite.settings?.channels?.website?.chat_position ?? "bottom-right",
          welcome_message: tracking?.welcome_message ?? channels?.website?.welcome_message ?? currentSite.settings?.channels?.website?.welcome_message ?? "Welcome to our website! How can we assist you today?",
          chat_title: tracking?.chat_title ?? channels?.website?.chat_title ?? currentSite.settings?.channels?.website?.chat_title ?? "Chat with us",
          analytics_provider: tracking?.analytics_provider ?? channels?.website?.analytics_provider ?? currentSite.settings?.channels?.website?.analytics_provider ?? "",
          analytics_id: tracking?.analytics_id ?? channels?.website?.analytics_id ?? currentSite.settings?.channels?.website?.analytics_id ?? "",
          tracking_code: tracking?.tracking_code ?? channels?.website?.tracking_code ?? currentSite.settings?.channels?.website?.tracking_code ?? ""
        }
      }
    }

    // Preserve existing settings ID if it exists
    if (currentSite.settings?.id) {
      settingsUpdate.id = currentSite.settings.id
    }

    await saveSiteWithSettings({
      ...currentSite,
      tracking: siteTracking
    } as Site, settingsUpdate, options)

    if (!shouldPreventRefresh()) {
      await refreshSites()
    }

    toast.success("Channels saved successfully")
    return true
  } catch (error) {
    console.error("Error saving channels:", error)
    if (error instanceof Error) {
      toast.error(`Error: ${error.message}`)
    } else {
      toast.error("Error saving channels")
    }
    return false
  } finally {
    setIsSaving(false)
  }
}

