-- Script 4: Aplicar la solución específica recomendada por Supabase
-- Reemplazar auth functions directas con SELECT wrapping

DROP POLICY IF EXISTS "visitors_unified" ON public.visitors;

CREATE POLICY "visitors_unified" ON public.visitors
FOR ALL 
USING (
  -- Usar SELECT para cada auth function según documentación Supabase
  (SELECT current_setting('role', true)) = 'service_role' OR
  (SELECT (auth.jwt() ->> 'role')) = 'service_role' OR
  
  -- User access conditions
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

-- Verificar que la política fue aplicada correctamente
SELECT 'Policy updated successfully' as status; 