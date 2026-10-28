import { validateAccountLink, type AccountLifecyclePolicy } from './account-lifecycle-policy';

type Message = { id?: unknown; date?: unknown; header?: Record<string, unknown>; body?: { html?: unknown; text?: unknown };
  To?: Array<{ Address?: unknown }>; HTML?: unknown; Text?: unknown };
const transports = new Map<string, 'inbucket' | 'mailpit'>();

export function accountMessageLink(message: Message, kind: 'signup' | 'recovery', policy: AccountLifecyclePolicy): string | null {
  const recipients = message.header?.To || message.To?.map(recipient => recipient.Address);
  if (!Array.isArray(recipients) || !recipients.every(value => typeof value === 'string') ||
    recipients.length !== 1 || ![policy.email, `<${policy.email}>`].includes(recipients[0])) {
    throw new Error('QA email recipient does not match the exact run-owned identity');
  }
  const body = [message.body?.html, message.body?.text, message.HTML, message.Text].filter(value => typeof value === 'string').join('\n');
  const urls = [...new Set((body.match(/https?:\/\/[^\s"'<>]+/g) || []).map(value => value.replace(/&amp;/g, '&')))];
  const links = urls.filter(value => {
    try { const url = new URL(value); return url.searchParams.get('type') === kind ||
      (kind === 'signup' && url.searchParams.get('type') === 'email'); } catch { return false; }
  });
  if (!links.length) return null;
  if (links.length !== 1) throw new Error('Ambiguous QA email action links');
  return validateAccountLink(links[0], kind, policy);
}

async function readMailboxJson(url: string, allowNotFound = false): Promise<unknown> {
  try {
    const response = await fetch(url, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (allowNotFound && response.status === 404) return null;
    if (!response.ok) throw new Error();
    const body = await response.text();
    if (body.length > 512_000) throw new Error();
    return JSON.parse(body);
  } catch { throw new Error('QA local mailbox read failed; no messages or tokens are logged'); }
}

export async function mailboxSnapshot(policy: AccountLifecyclePolicy): Promise<Set<string>> {
  const inbucketUrl = `${policy.mailbox}/api/v1/mailbox/${encodeURIComponent(policy.runId)}`;
  let messages = transports.get(policy.mailbox) === 'mailpit' ? null : await readMailboxJson(inbucketUrl, true);
  if (messages === null) {
    const query = new URL('/api/v1/search', policy.mailbox);
    query.search = new URLSearchParams({ query: `to:${policy.email}`, limit: '200' }).toString();
    const result = await readMailboxJson(query.href) as { messages?: Array<{ ID?: unknown; To?: Array<{ Address?: unknown }> }>; messages_count?: unknown };
    if (!result || !Array.isArray(result.messages) || result.messages_count !== result.messages.length ||
      result.messages.some(item => item.To?.length !== 1 || item.To[0].Address !== policy.email)) {
      throw new Error('Unexpected or unscoped QA Mailpit response');
    }
    messages = result.messages.map(item => ({ id: item.ID }));
    transports.set(policy.mailbox, 'mailpit');
  } else transports.set(policy.mailbox, 'inbucket');
  if (!Array.isArray(messages) || messages.some(value => typeof value?.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(value.id))) {
    throw new Error('Unexpected QA mailbox response');
  }
  return new Set(messages.map(value => value.id as string));
}

/** Poll only this run's mailbox, excluding every message present before submission. */
export async function waitForAccountEmail(policy: AccountLifecyclePolicy, kind: 'signup' | 'recovery', before: Set<string>): Promise<string> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const ids = await mailboxSnapshot(policy);
    for (const id of ids) {
      if (before.has(id)) continue;
      const endpoint = transports.get(policy.mailbox) === 'mailpit' ? `/api/v1/message/${encodeURIComponent(id)}`
        : `/api/v1/mailbox/${encodeURIComponent(policy.runId)}/${encodeURIComponent(id)}`;
      const message = await readMailboxJson(`${policy.mailbox}${endpoint}`);
      if (!message || typeof message !== 'object') throw new Error('Unexpected QA email response');
      const link = accountMessageLink(message as Message, kind, policy);
      if (link) return link;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Real QA confirmation/recovery email was not received within 60 seconds');
}