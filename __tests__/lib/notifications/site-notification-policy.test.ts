import {
  shouldDeliverSiteNotification,
  isSiteChannelEnabled,
} from "@/lib/notifications/site-notification-policy"

const sitePrefs = {
  email_enabled: true,
  push_enabled: true,
  categories: {
    lead_management: true,
    system_alerts: false,
  },
}

describe("site-notification-policy", () => {
  it("prioritizes the global master switch to disable all sites", () => {
    expect(
      isSiteChannelEnabled({
        sitePreferences: { ...sitePrefs, email_enabled: true },
        profileNotifications: { email: false },
        role: "owner",
        channel: "email",
      })
    ).toBe(false)
  })

  it("uses site email_enabled when the master switch is true or null", () => {
    expect(
      isSiteChannelEnabled({
        sitePreferences: { ...sitePrefs, email_enabled: false },
        profileNotifications: { email: true },
        role: "owner",
        channel: "email",
      })
    ).toBe(false)
    
    expect(
      isSiteChannelEnabled({
        sitePreferences: { ...sitePrefs, email_enabled: true },
        profileNotifications: { email: true },
        role: "owner",
        channel: "email",
      })
    ).toBe(true)
  })

  it("falls back to profile email when there is no site record", () => {
    expect(
      isSiteChannelEnabled({
        sitePreferences: null,
        profileNotifications: { email: false },
        role: "owner",
        channel: "email",
      })
    ).toBe(false)

    expect(
      isSiteChannelEnabled({
        sitePreferences: null,
        profileNotifications: { email: true },
        role: "collaborator",
        channel: "email",
      })
    ).toBe(true)
  })

  it("defaults owners and admins to enabled when no profile flags exist", () => {
    expect(
      isSiteChannelEnabled({
        sitePreferences: null,
        profileNotifications: null,
        role: "owner",
        channel: "email",
      })
    ).toBe(true)

    expect(
      isSiteChannelEnabled({
        sitePreferences: null,
        profileNotifications: null,
        role: "collaborator",
        channel: "email",
      })
    ).toBe(false)
  })

  it("skips delivery when the user opted out of a matching category", () => {
    expect(
      shouldDeliverSiteNotification({
        sitePreferences: sitePrefs,
        channel: "email",
        notificationCategories: ["system_alerts"],
      })
    ).toBe(false)
  })

  it("delivers when the matching category is enabled", () => {
    expect(
      shouldDeliverSiteNotification({
        sitePreferences: sitePrefs,
        channel: "email",
        notificationCategories: ["lead_management"],
      })
    ).toBe(true)
  })

  it("treats missing category keys as enabled", () => {
    expect(
      shouldDeliverSiteNotification({
        sitePreferences: sitePrefs,
        channel: "email",
        notificationCategories: ["tasks_reminders"],
      })
    ).toBe(true)
  })

  it("respects push independently from email", () => {
    expect(
      shouldDeliverSiteNotification({
        sitePreferences: { ...sitePrefs, email_enabled: false, push_enabled: true },
        channel: "push",
        notificationCategories: ["lead_management"],
      })
    ).toBe(true)

    expect(
      shouldDeliverSiteNotification({
        sitePreferences: { ...sitePrefs, email_enabled: true, push_enabled: false },
        channel: "push",
        notificationCategories: ["lead_management"],
      })
    ).toBe(false)
  })
})
