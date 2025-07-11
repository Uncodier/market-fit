-- Script 7: Solución final - enfoque más específico para SELECT wrapping
DROP POLICY IF EXISTS "visitors_unified" ON public.visitors;

CREATE POLICY "visitors_unified" ON public.visitors
FOR ALL 
USING (
  -- Cada función auth DEBE estar envuelta en SELECT individual
  (SELECT current_setting('role', true)) = 'service_role' OR
  (SELECT (auth.jwt() ->> 'role')) = 'service_role' OR
  
  -- User access conditions - cada auth.uid() en SELECT
  (
    (SELECT auth.uid()) IS NOT NULL AND (
      -- Through segment membership
      (
        visitors.segment_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 
          FROM public.segments s 
          JOIN public.site_members sm ON sm.site_id = s.site_id 
          WHERE s.id = visitors.segment_id 
          AND sm.user_id = (SELECT auth.uid())
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
          AND sm.user_id = (SELECT auth.uid())
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
        AND sm.user_id = (SELECT auth.uid())
        AND sm.status = 'active'
      )
    )
  )
);

-- Verificar aplicación
DO $$
DECLARE
    policy_text TEXT;
    auth_uid_count INTEGER;
    wrapped_auth_uid_count INTEGER;
BEGIN
    -- Obtener texto de política
    SELECT qual INTO policy_text
    FROM pg_policies 
    WHERE tablename = 'visitors' 
    AND schemaname = 'public' 
    AND policyname = 'visitors_unified';
    
    -- Contar auth.uid() total y envueltos
    SELECT (length(policy_text) - length(replace(policy_text, 'auth.uid()', ''))) / length('auth.uid()') INTO auth_uid_count;
    SELECT (length(policy_text) - length(replace(policy_text, '(SELECT auth.uid())', ''))) / length('(SELECT auth.uid())') INTO wrapped_auth_uid_count;
    
    RAISE NOTICE 'Total auth.uid() calls: %', auth_uid_count;
    RAISE NOTICE 'Wrapped auth.uid() calls: %', wrapped_auth_uid_count;
    
    IF auth_uid_count = wrapped_auth_uid_count THEN
        RAISE NOTICE '✅ SUCCESS: All auth.uid() calls properly wrapped!';
    ELSE
        RAISE NOTICE '❌ ISSUE: % auth.uid() calls still not wrapped', (auth_uid_count - wrapped_auth_uid_count);
    END IF;
END $$; 