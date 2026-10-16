# Content Creator account-specific destinations

Publish nodes select individual connected accounts rather than platform-wide
switches. WhatsApp numbers, email accounts, social accounts, SMS, Telegram and
Voice connections have independent switches labeled with their account name,
address, number or stable ID. Mail and Newsletter remain separate delivery modes
for each email account. Conversational Voice Agent Call remains exclusive of
other audience delivery modes, while social publishing can remain selected.

## Persisted and API contract

Selections remain in `instance_nodes.settings.publish_destinations`; no schema
migration is required. Each explicit selection is one of:

- `<mode>:connection:<URI-encoded connection ID>` for audience delivery;
- `<platform>:social:<URI-encoded account ID>` for social publishing;
- `blog` for the existing site blog destination.

The publish routing helper translates these into:

- `connection_id` with `channel` for a single selected delivery connection;
- `delivery_routes` for multiple selected connections, including multiple
  connections of the same channel. Each route contains `channel`,
  `connection_id`, and applicable `audience_email_mode` or `voice_mode`;
- `social_accounts` containing the exact social account IDs, with
  `social_account_targets: [{ id, network }]` for typed selections. These targets
  require an exact ID and matching network; they never fall back to a username
  or platform selector when an account is removed.

Both `publish` and `sendBulkMessages` tool overrides carry the delivery selection.
Mixed-channel test sends carry separate `test_recipients.email` and
`test_recipients.phone`; a single recipient is never reused across incompatible
channel types.
The authenticated web assistant proxy rebinds those overrides from the persisted
node, removing stale routing overrides and client-provided sender addresses.
The orchestration API must validate all selected connections against the
site-scoped inventory and preserve them through queues and provider delivery.
A missing, inactive, foreign or wrong-channel connection must fail rather than
falling back to another account.

## Existing saved nodes

A legacy platform-only selection is displayed as the concrete account only when
there is exactly one matching option. Ambiguous legacy selections show a warning
and require the user to choose specific accounts. Editing the selection stores
the exact IDs. Removed/disconnected account selections remain visible as
unavailable and can be deselected; they are not silently reassigned.

## Validation and rollout

Focused Jest coverage verifies independent selection, account IDs, multiple
same-channel routes, email delivery modes, persisted-node precedence, malformed
IDs, audience requirements and test-recipient fields. Actual external delivery
requires a separately authorized disposable environment; offline tests do not
send email, WhatsApp messages, social posts or paid voice calls.

Provider regressions also cover explicit Twilio sender selection with a Messaging
Service, exact template preparation, failed Zavu replay responses, email HTML and
signatures, AgentMail callback correlation, and tracked Voice Agent Call tests.

Release the web application, orchestration API and approved-message workflow
worker together. Queued messages retain the selected `connection_id`; the worker
uses the exact-delivery endpoint rather than the legacy default-provider path.
This change does not deploy these repositories or alter production configuration.