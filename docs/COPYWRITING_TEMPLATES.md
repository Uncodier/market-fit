# Copywriting templates and test sends

Open a saved copy item and select **WhatsApp template** or **Newsletter template**.
The editor starts with a copy of the text. Saving a draft and sending a test are
independent actions; neither changes the source item or publishes to an audience.

- Newsletter drafts appear in Content. The subject becomes the draft title and
  the body is saved as newsletter text.
- WhatsApp drafts appear in Copywriting, identified by the `whatsapp-template`
  tag. Saving does not register a provider template or imply Meta approval.
  A test uses the normal WhatsApp delivery path, including any applicable
  conversation-window and approved-template requirements.

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