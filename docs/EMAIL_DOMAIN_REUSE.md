# Shared email-domain setup

Settings > Agent Channels supports separate email addresses on the same Zavu domain.
New email channels offer domains already configured on email connections in the
active site, plus **Add a new domain or subdomain**. Suggestions are deduplicated
by exact normalized hostname and prioritize previously verified domains. Domains
with conflicting provider identities are not suggested.

Choosing a domain calls the existing external API endpoint
`POST /api/integrations/zavu/email-domains` with the domain name, site ID, channel
ID, and optional channel name. The browser does not supply a reusable provider
domain ID or a verification result. The backend independently authorizes the site
manager, finds a matching persisted email domain in that site, and refreshes its
state from Zavu before associating it with the new channel.

- A fresh `verified` result skips DNS configuration and opens the address form.
- A pending domain keeps the DNS instructions and verification action without
  registering that domain again.
- A new exact hostname follows the normal domain-registration flow.
- `example.com` and `agents.example.com` are separate domains. Parent verification
  never implies subdomain verification.
- Creating the new address does not copy another address's sender, activation,
  receiving setting, or manual-disable state. Existing addresses remain unchanged.

DNS records are configured once per exact domain, while sender creation,
activation, and receiving remain per address. MX is domain-wide: adding a Zavu MX
alongside Google Workspace or Microsoft 365 is not recipient-specific routing.
Use a dedicated subdomain or explicitly design coexistence before changing MX.
This change does not automatically edit DNS or enable catch-all.
Send-only activation does not require inbound MX. Receiving remains disabled until
the exact domain's inbound MX is verified and receiving is enabled for that address.

Email mutations are persisted by the API. The UI then refreshes canonical
connections with a user-scoped RLS read, without saving a stale browser copy over
server-owned webhook metadata. Unsaved unrelated drafts are preserved, and email
cards use stable site/connection keys so field-array reconciliation does not
restart setup or discard an address draft.

## Implementation

- `app/components/settings/EmailDomainSelector.tsx` owns selection and the request.
- `app/components/settings/email-domain-options.ts` builds site-scoped suggestions.
- `app/components/settings/EmailAddressSetup.tsx` renders the independent address.
- `app/components/settings/EmailChannelSetup.tsx` continues provider verification,
  sender creation, receiving, and activation.
- Companion API implementation:
  `/Users/prado/Desktop/Proyectos/Uncodie/Code/API/src/app/api/integrations/zavu/email-domains/route.ts`.

Deploy the companion API change before the web UX. The old backend attempts to
register every requested domain and does not implement reuse. No schema migration
is required. No provider, DNS, or production changes are performed by these edits.

## Verification

```sh
npm test -- --runInBand __tests__/components/settings/email-domain-reuse.test.tsx __tests__/components/settings/email-domain-options.test.ts __tests__/components/settings/channel-setup-steps.test.ts __tests__/components/settings/EmailChannelSetup.test.tsx __tests__/components/settings/EmailChannelSetupViews.test.tsx
npm run typecheck
```

These are local regression tests with mocked provider calls, not proof of email
delivery. Live acceptance requires an approved disposable site and domain: create
two addresses under one domain, verify both inbound destinations and outbound
reply identity, then confirm a separate subdomain still requires its own setup.

Provider contract: [Zavu email setup](https://docs.zavu.dev/guides/email/setup).