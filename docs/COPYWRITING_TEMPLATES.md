# Copywriting templates and test sends

Open a saved copy item in detail or edit mode. Select **Create WhatsApp template**
to start from the current text or **Update WhatsApp template** to edit the linked
draft. An existing WhatsApp draft can also be edited directly. The detail modal
also offers **Newsletter template**. Template actions require a saved source;
opening and closing an action does not discard unsaved changes in the main editor.

- Newsletter drafts appear in Content. The subject becomes the draft title and
  the body is saved as newsletter text.
- WhatsApp drafts appear in Copywriting, identified by the `whatsapp-template`
  tag. New drafts are linked to the source via a source tag; older drafts without
  a link can be edited directly. Saving does not register a provider template or imply Meta approval.
  A test uses the normal WhatsApp delivery path, including any applicable
  conversation-window and approved-template requirements.

Use **Test template** and pick email or WhatsApp. Email starts with the current
copy and an editable subject. WhatsApp uses the saved linked draft if one exists
or the current copy otherwise. Enter test values for placeholders such as
`{{name}}` or `{{1}}`, and review the rendered subject and body before sending.
Unresolved placeholders block sending. Test values do not change the saved draft.
For a test, select one existing workspace contact who expects the message.
The email subject or WhatsApp body is marked `[TEST]`. Tests use the existing
Chat intervention dispatcher (not a campaign, audience, or agent execution).
It resolves the actual recipient and sender server-side and returns a Chat
conversation for delivery tracking. Initial acceptance is not proof of delivery.
If the dispatch result is unknown, check Chats before attempting another test.
Test admission requires Copywriting, Leads, and Chats access, and a working
server-side rate limiter. Sending also requires an eligible contact, a support
agent, and the workspace channel and delivery workers to be configured.

Offline tests exercise the save and test workflows and both server dispatch
contracts without contacting a provider. For live acceptance, use an isolated
workspace and two explicitly approved test destinations, then verify the
newsletter in the test inbox and the WhatsApp receipt or approval state in Chats.