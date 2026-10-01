# Agent channel phone numbers

Settings > Agent Channels displays the assigned phone number in each connected
WhatsApp, Voice, or SMS account summary. The channel heading and connection status
are unchanged. Existing persisted phone metadata is preferred.

When a connected WhatsApp account has no stored number,
`app/components/settings/use-zavu-sender-phone-numbers.ts` reads the linked sender
through the authenticated external API:

```text
GET /api/integrations/zavu/senders/{senderId}?siteId={siteId}
{ "success": true, "data": {
  "id": "sender-example", "whatsapp": { "displayPhoneNumber": "+14155550100" }
} }
```

The API must authenticate the user, authorize site access, and verify that the
sender belongs to an active WhatsApp connection in that site's settings before
requesting it from Zavu. Return only the sender ID and WhatsApp display number
(or `null`); never return the raw provider sender or its webhook credentials.

WhatsApp numbers linked through Meta may not appear in the purchased-number
inventory. WhatsApp therefore uses `whatsapp.displayPhoneNumber`, not a sender's
generic Voice/SMS `phoneNumber`, an account ID, or an unrelated inventory entry.
Voice/SMS retain the existing site-scoped inventory lookup and exact, unambiguous
matching. Lookup keys include both channel type and sender ID.

The lookup is read-only: it does not save settings, finalize invitations, or
modify a channel. It is bounded by a timeout, does not poll on failure, and ignores
late responses after a site or connection change. Missing numbers and failed
requests preserve the existing account label and connection status.

## Rollout and validation

Deploy the companion sender GET implementation from the API repository before
the web change. The previous API exposed only DELETE at this sender route;
deploying only the web change cannot resolve missing WhatsApp numbers.
No database migration or new environment variable is needed.

Focused offline checks:

```bash
npm test -- --runInBand __tests__/components/settings/SupportChannelsSection.test.tsx __tests__/components/settings/use-zavu-sender-phone-numbers.test.tsx __tests__/components/settings/zavu-phone-number-utils.test.ts __tests__/app/tests/workflows/workflow-channel-message.test.tsx __tests__/lib/workflow-connection-label.test.ts
npm run typecheck
```

Provider reference: [Get sender](https://docs.zavu.dev/api-reference/get-sender).