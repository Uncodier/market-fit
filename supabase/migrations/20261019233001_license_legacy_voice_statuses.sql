BEGIN;
SET LOCAL lock_timeout = '5s';

-- Forward correction of the installed, protected resource functions. Preserve
-- their complete identity/order/manual-disconnect logic and existing ACLs.
-- Fail loudly on incompatible bodies rather than partially installing a guard.
DO $migration$
DECLARE original text; corrected text;
BEGIN
  original := pg_get_functiondef('public.enforce_settings_license()'::regprocedure);
  IF strpos(original,$old$IF item->>'status' NOT IN ('connected','license_suspended') THEN$old$)=0
    OR strpos(original,$old$active := item->>'status' = 'connected' OR$old$)=0 THEN
    RAISE EXCEPTION 'Unexpected settings license guard; reconcile prerequisites before applying voice status correction';
  END IF;
  corrected := replace(original,
    $old$IF item->>'status' NOT IN ('connected','license_suspended') THEN$old$,
    $new$IF NOT (item->>'status' IN ('connected','license_suspended') OR
      (item->>'type'='voice' AND item->>'status' IN ('active','synced'))) THEN$new$);
  corrected := replace(corrected,
    $old$active := item->>'status' = 'connected' OR$old$,
    $new$active := (item->>'status' = 'connected' OR
      (item->>'type'='voice' AND item->>'status' IN ('active','synced'))) OR$new$);
  EXECUTE corrected;

  original := pg_get_functiondef('public.get_site_licensed_resources(uuid)'::regprocedure);
  IF strpos(original,$old$ELSE item->>'status'='connected' END OR$old$)=0
    OR strpos(original,$old$CASE WHEN keep THEN 'connected' ELSE 'license_suspended' END$old$)=0 THEN
    RAISE EXCEPTION 'Unexpected licensed resource projection; reconcile prerequisites before applying voice status correction';
  END IF;
  corrected := replace(original,
    $old$ELSE item->>'status'='connected' END OR$old$,
    $new$ELSE (item->>'status'='connected' OR
      (item->>'type'='voice' AND item->>'status' IN ('active','synced'))) END OR$new$);
  corrected := replace(corrected,
    $old$CASE WHEN keep THEN 'connected' ELSE 'license_suspended' END$old$,
    $new$CASE WHEN NOT keep THEN 'license_suspended'
      WHEN item->>'type'='voice' AND item->>'status' IN ('active','synced') THEN item->>'status'
      WHEN item->>'type'='voice' AND item->'_license'->>'previousStatus' IN ('active','synced')
        THEN item->'_license'->>'previousStatus'
      ELSE 'connected' END$new$);
  EXECUTE corrected;
END;
$migration$;

-- No browser may invoke the service execution projection or trigger directly.
REVOKE ALL ON FUNCTION public.enforce_settings_license() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_site_licensed_resources(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_site_licensed_resources(uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;