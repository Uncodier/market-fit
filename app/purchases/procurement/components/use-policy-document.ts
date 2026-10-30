import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { defaultPolicyDocument, policyDocumentSchema, type PolicyDocument } from '../domain';
import { isDemoModeActive, isDemoSiteId } from '@/lib/demo-utils';
import { demoProcurementPolicy } from '@/lib/demo-data/procurement-suppliers';
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n';
import { PolicyFeedbackError, policyFeedback, validationFeedback, type PolicyFeedback } from './policy-presentation';
import { ruleSaveDocument, mergeRuleSave } from './rule-save';

const responseSchema = z.object({ revision: z.number().int().nonnegative(), document: policyDocumentSchema.nullable() })
  .refine(value => (value.revision === 0) === (value.document === null), 'Revision and document must agree');
type Snapshot = { revision: number; document: PolicyDocument };

async function responseError(response: Response): Promise<PolicyFeedback> {
  const keys: Record<number, string> = { 401: 'session', 403: 'permission', 409: 'conflict', 503: 'storage' };
  if (keys[response.status]) return { key: `procurement.policy.feedback.${keys[response.status]}` };
  try {
    const data = await response.json();
    if (Array.isArray(data.issues) && data.issues.every((issue: { path?: unknown; message?: unknown }) =>
      issue && typeof issue.message === 'string' && (typeof issue.path === 'string' || Array.isArray(issue.path)))) return { issues: data.issues };
  } catch { /* Use a safe error if a gateway returns non-JSON. */ }
  return { key: 'procurement.policy.feedback.request' };
}

/** Mount under a site key: no prior workspace data is rendered during a switch. */
export function usePolicyDocument(siteId: string) {
  const i18n = useProcurementI18n();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [draft, setDraft] = useState<PolicyDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingRuleId, setSavingRuleId] = useState<string | null>(null);
  const [error, setError] = useState<PolicyFeedback | null>(null);
  const [conflict, setConflict] = useState(false);
  const active = useRef(true);
  const request = useRef<AbortController | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    request.current?.abort();
    if (isDemoSiteId(siteId)) {
      const document = demoProcurementPolicy();
      setSnapshot({ revision: 4, document }); setDraft(document); setLoading(false); setError(null); setConflict(false); return;
    }
    if (isDemoModeActive()) { setLoading(false); return; }
    const controller = new AbortController();
    request.current = controller;
    setLoading(true); setError(''); setSnapshot(null); setDraft(null); setConflict(false);
    try {
      const response = await fetch(`/api/procurement/policy?site_id=${encodeURIComponent(siteId)}`, {
        signal: controller.signal, cache: 'no-store', credentials: 'same-origin',
      });
      if (!response.ok) throw new PolicyFeedbackError(await responseError(response));
      const parsed = responseSchema.safeParse(await response.json());
      if (!parsed.success) throw new PolicyFeedbackError({ key: 'procurement.policy.feedback.invalidResponse' });
      if (controller.signal.aborted || !active.current) return;
      const document = parsed.data.document === null ? defaultPolicyDocument() : parsed.data.document;
      setSnapshot({ revision: parsed.data.revision, document }); setDraft(document);
    } catch (failure) {
      if (!controller.signal.aborted && active.current) setError(failure instanceof PolicyFeedbackError ? failure.feedback : { key: 'procurement.policy.feedback.load' });
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

  const save = async (ruleId?: string) => {
    if (!snapshot || !draft || inFlight.current || conflict || isDemoSiteId(siteId) || isDemoModeActive()) return;
    const candidate = ruleId ? ruleSaveDocument(snapshot.document, draft, ruleId) : draft;
    if (!candidate) return;
    const parsed = policyDocumentSchema.safeParse(candidate);
    if (!parsed.success) {
      setError(validationFeedback(parsed.error.issues));
      return;
    }
    inFlight.current = true; setSaving(true); setSavingRuleId(ruleId ?? null); setError('');
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
        throw new PolicyFeedbackError(await responseError(response));
      }
      const result = responseSchema.safeParse(await response.json());
      if (!result.success || result.data.document === null || result.data.revision <= snapshot.revision) {
        throw new PolicyFeedbackError({ key: 'procurement.policy.feedback.unconfirmed' });
      }
      if (controller.signal.aborted || !active.current) return;
      setSnapshot({ revision: result.data.revision, document: result.data.document });
      setDraft(ruleId ? mergeRuleSave(draft, result.data.document, ruleId) : result.data.document);
      toast.success(policyFeedback({ key: 'procurement.policy.feedback.saved', params: { number: result.data.revision } }, i18n));
    } catch (failure) {
      if (!controller.signal.aborted && active.current) setError(failure instanceof PolicyFeedbackError ? failure.feedback : { key: 'procurement.policy.feedback.save' });
    } finally {
      inFlight.current = false;
      if (!controller.signal.aborted && active.current) { setSaving(false); setSavingRuleId(null); }
    }
  };
  const edit = (document: PolicyDocument) => {
    if (inFlight.current || isDemoSiteId(siteId) || isDemoModeActive()) return;
    setDraft(document);
  };
  const isRuleDirty = (id: string) => JSON.stringify(draft?.rules.find(rule => rule.id === id)) !== JSON.stringify(snapshot?.document.rules.find(rule => rule.id === id));
  return { draft, edit, revision: snapshot?.revision, loading, saving, savingRuleId, isRuleDirty, error: policyFeedback(error, i18n), conflict, dirty, save, reload: load };
}