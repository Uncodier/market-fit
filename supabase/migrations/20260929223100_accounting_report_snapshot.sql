BEGIN;

-- STABLE uses the calling statement's MVCC snapshot for every query in this function.
-- A scalar JSON result cannot be truncated by the Data API row limit.
CREATE OR REPLACE FUNCTION public.accounting_report_snapshot(
  p_site_id uuid, p_from timestamptz, p_to_exclusive timestamptz,
  p_currency text, p_include_opening boolean
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE result jsonb;
BEGIN
  IF p_site_id IS NULL OR (auth.role() IS DISTINCT FROM 'service_role'
    AND (auth.uid() IS NULL OR NOT public.user_can(p_site_id,'select'))) THEN
    RAISE EXCEPTION 'Accounting report access denied' USING ERRCODE = '42501';
  END IF;
  IF p_to_exclusive IS NULL OR NOT isfinite(p_to_exclusive) OR p_currency IS NULL
    OR p_currency !~ '^[A-Z]{3}$' OR p_include_opening IS NULL
    OR (p_from IS NOT NULL AND (NOT isfinite(p_from) OR p_from >= p_to_exclusive)) THEN
    RAISE EXCEPTION 'Invalid accounting report parameters' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.journal_entries e WHERE e.site_id=p_site_id
    AND (p_from IS NULL OR e.entry_date >= p_from) AND e.entry_date < p_to_exclusive
    AND (p_include_opening OR e.source_type <> 'opening')
    AND (e.currency IS NULL OR e.currency !~ '^[A-Z]{3}$')) THEN
    RAISE EXCEPTION 'ACCOUNTING_UNKNOWN_CURRENCY' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.journal_entries e LEFT JOIN public.journal_lines l ON l.entry_id=e.id
    WHERE e.site_id=p_site_id AND e.currency=p_currency
      AND (p_from IS NULL OR e.entry_date >= p_from) AND e.entry_date < p_to_exclusive
      AND (p_include_opening OR e.source_type <> 'opening')
    GROUP BY e.id HAVING count(l.id)<2 OR sum(l.debit) IS DISTINCT FROM sum(l.credit)
      OR coalesce(sum(l.debit),0)<=0 OR bool_or(l.debit IS NULL OR l.credit IS NULL
        OR l.debit NOT BETWEEN 0 AND 1000000000000 OR l.credit NOT BETWEEN 0 AND 1000000000000
        OR l.debit<>trunc(l.debit,2) OR l.credit<>trunc(l.credit,2)
        OR NOT ((l.debit>0 AND l.credit=0) OR (l.credit>0 AND l.debit=0)))) THEN
    RAISE EXCEPTION 'ACCOUNTING_INVALID_JOURNAL' USING ERRCODE = 'P0001';
  END IF;
  SELECT coalesce(jsonb_object_agg(account_code, jsonb_build_object('debit', debit, 'credit', credit)), '{}'::jsonb)
    INTO result FROM (
      SELECT l.account_code, sum(l.debit) AS debit, sum(l.credit) AS credit
      FROM public.journal_lines l JOIN public.journal_entries e ON e.id=l.entry_id
      WHERE e.site_id=p_site_id AND e.currency=p_currency
        AND (p_from IS NULL OR e.entry_date>=p_from) AND e.entry_date<p_to_exclusive
        AND (p_include_opening OR e.source_type<>'opening') GROUP BY l.account_code
    ) totals;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.accounting_report_snapshot(uuid,timestamptz,timestamptz,text,boolean)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accounting_report_snapshot(uuid,timestamptz,timestamptz,text,boolean)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;