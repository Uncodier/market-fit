import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { defaultPolicyDocument, policyDocumentSchema, type PolicyDocument } from '../domain';
import { isDemoModeActive } from '@/lib/demo-utils';

const responseSchema = z.object({ revision: z.number().int().nonnegative(), document: policyDocumentSchema.nullable() })
  .refine(value => (value.revision === 0) === (value.document === null), 'Revision and document must agree');
type Snapshot = { revision: number; document: PolicyDocument };

async function responseError(response: Response): Promise<string> {
  if (response.status === 401) return 'Your session expired. Sign in again to manage procurement.';
  if (response.status === 403) return 'Only workspace owners and administrators can manage procurement.';
  if (response.status === 409) return 'This policy changed in another session. Your draft has not been saved. Reload the latest policy and reapply your changes.';
  if (response.status === 503) return 'Procurement storage is unavailable. The required migration may not be installed. No changes have been confirmed.';
  try {
    const data = await response.json();
    if (Array.isArray(data.issues)) return data.issues.map((issue: { path: string | string[]; message: string }) => `${Array.isArray(issue.path) ? issue.path.join('.') : issue.path}: ${issue.message}`).join('; ');
  } catch { /* Use a safe error if a gateway returns non-JSON. */ }
  return 'The policy request failed. No changes have been confirmed. Reload to check the current revision before retrying.';
}

/** Mount under a site key: no prior workspace data is rendered during a switch. */
export function usePolicyDocument(siteId: string) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [draft, setDraft] = useState<PolicyDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [conflict, setConflict] = useState(false);
  const active = useRef(true);
  const request = useRef<AbortController | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true); setError(''); setNotice(''); setSnapshot(null); setDraft(null); setConflict(false);
    try {
      const response = await fetch(`/api/procurement/policy?site_id=${encodeURIComponent(siteId)}`, {
        signal: controller.signal, cache: 'no-store', credentials: 'same-origin',
      });
      if (!response.ok) throw new Error(await responseError(response));
      const parsed = responseSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error('The saved policy response is invalid. Editing is blocked to protect the existing configuration.');
      if (controller.signal.aborted || !active.current) return;
      const document = parsed.data.document === null ? defaultPolicyDocument() : parsed.data.document;
      setSnapshot({ revision: parsed.data.revision, document }); setDraft(document);
    } catch (failure) {
      if (!controller.signal.aborted && active.current) setError(failure instanceof Error ? failure.message : 'Could not load procurement policy.');
    } finally { if (!controller.signal.aborted && active.current) setLoading(false); }
  }, [siteId]);

  useEffect(() => {
    active.current = true;
    const timer = setTimeout(() => { void load(); }, 0);
    return () => { clearTimeout(timer); active.current = false; request.current?.abort(); };
  }, [load]);

  const dirty = draft !== null && snapshot !== null && JSON.stringify(draft) !== JSON.stringify(snapshot.document);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = async () => {
    if (!snapshot || !draft || inFlight.current || conflict || isDemoModeActive()) return;
    const parsed = policyDocumentSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '));
      return;
    }
    inFlight.current = true; setSaving(true); setError(''); setNotice('');
    const controller = new AbortController();
    request.current?.abort(); request.current = controller;
    try {
      const response = await fetch(`/api/procurement/policy?site_id=${encodeURIComponent(siteId)}`, {
        method: 'PUT', credentials: 'same-origin', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expected_revision: snapshot.revision, document: parsed.data }),
      });
      if (!response.ok) {
        if (response.status === 409 && !controller.signal.aborted && active.current) setConflict(true);
        throw new Error(await responseError(response));
      }
      const result = responseSchema.safeParse(await response.json());
      if (!result.success || result.data.document === null || result.data.revision <= snapshot.revision) {
        throw new Error('The save response could not be confirmed. Reload the latest policy before retrying.');
      }
      if (controller.signal.aborted || !active.current) return;
      setSnapshot({ revision: result.data.revision, document: result.data.document });
      setDraft(result.data.document); setNotice(`Policy saved as revision ${result.data.revision}. Configuration only; no live enforcement has started.`);
    } catch (failure) {
      if (!controller.signal.aborted && active.current) setError(failure instanceof Error ? failure.message : 'Could not save procurement policy.');
    } finally {
      inFlight.current = false;
      if (!controller.signal.aborted && active.current) setSaving(false);
    }
  };
  const edit = (document: PolicyDocument) => {
    if (inFlight.current || isDemoModeActive()) return;
    setDraft(document); setNotice('');
  };
  return { draft, edit, revision: snapshot?.revision, loading, saving, error, notice, conflict, dirty, save, reload: load };
}