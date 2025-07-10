-- Script 10: Implementación EXACTA según documentación Supabase
-- Referencia: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

DROP POLICY IF EXISTS "visitors_unified" ON public.visitors;

CREATE POLICY "visitors_unified" ON public.visitors
FOR ALL 
USING (
  -- Formato EXACTO según documentación: (select auth.function())
  (select current_setting('role', true)) = 'service_role' OR
  (select (auth.jwt() ->> 'role')) = 'service_role' OR
  
  -- User access conditions
  (
    (select auth.uid()) IS NOT NULL AND (
      -- Through segment membership
      (
        visitors.segment_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 
          FROM public.segments s 
          JOIN public.site_members sm ON sm.site_id = s.site_id 
          WHERE s.id = visitors.segment_id 
          AND sm.user_id = (select auth.uid())
          AND sm.status = 'active'
        )
      )
      OR
      -- Through lead membership  
      (
        visitors.lead_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 
          FROM public.leads l 
          JOIN public.site_members sm ON sm.site_id = l.site_id 
          WHERE l.id = visitors.lead_id 
          AND sm.user_id = (select auth.uid())
          AND sm.status = 'active'
        )
      )
      OR
      -- Through visitor sessions
      EXISTS (
        SELECT 1 
        FROM public.visitor_sessions vs 
        JOIN public.site_members sm ON sm.site_id = vs.site_id 
        WHERE vs.visitor_id = visitors.id 
        AND sm.user_id = (select auth.uid())
        AND sm.status = 'active'
      )
    )
  )
);

-- Verificar que sigue EXACTAMENTE la documentación
DO $$
DECLARE
    policy_text TEXT;
    exact_pattern_count INTEGER;
    wrong_pattern_count INTEGER;
BEGIN
    SELECT qual INTO policy_text
    FROM pg_policies 
    WHERE tablename = 'visitors' 
    AND schemaname = 'public' 
    AND policyname = 'visitors_unified';
    
    -- Contar patrones exactos según documentación: (select auth.function())
    SELECT (length(policy_text) - length(replace(policy_text, '(select auth.uid())', ''))) / length('(select auth.uid())') INTO exact_pattern_count;
    
    -- Contar patrones que NO siguen la documentación
    SELECT (length(policy_text) - length(replace(policy_text, 'auth.uid()', ''))) / length('auth.uid()') - exact_pattern_count INTO wrong_pattern_count;
    
    RAISE NOTICE 'Exact documentation patterns: %', exact_pattern_count;
    RAISE NOTICE 'Wrong patterns: %', wrong_pattern_count;
    
    IF wrong_pattern_count = 0 THEN
        RAISE NOTICE '✅ SUCCESS: All patterns follow exact documentation format!';
    ELSE
        RAISE NOTICE '❌ ISSUE: % patterns do not follow documentation format', wrong_pattern_count;
    END IF;
END $$; 