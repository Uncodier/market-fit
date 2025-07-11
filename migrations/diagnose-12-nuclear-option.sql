-- Script 12: Opción nuclear - eliminar y recrear completamente la política
-- Approach: Crear una función STABLE para auth checks

-- Paso 1: Eliminar política existente
DROP POLICY IF EXISTS "visitors_unified" ON public.visitors;

-- Paso 2: Crear función helper optimizada 
CREATE OR REPLACE FUNCTION auth_user_id() 
RETURNS uuid 
LANGUAGE sql 
STABLE 
AS $$
  SELECT auth.uid()
$$;

-- Paso 3: Crear función helper para service role
CREATE OR REPLACE FUNCTION is_service_role() 
RETURNS boolean 
LANGUAGE sql 
STABLE 
AS $$
  SELECT current_setting('role', true) = 'service_role' OR 
         (auth.jwt() ->> 'role') = 'service_role'
$$;

-- Paso 4: Crear política usando las funciones helper
CREATE POLICY "visitors_unified" ON public.visitors
FOR ALL 
USING (
  -- Usar funciones helper que son STABLE
  is_service_role() OR
  (
    auth_user_id() IS NOT NULL AND (
      -- Through segment membership
      (
        visitors.segment_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 
          FROM public.segments s 
          JOIN public.site_members sm ON sm.site_id = s.site_id 
          WHERE s.id = visitors.segment_id 
          AND sm.user_id = auth_user_id()
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
          AND sm.user_id = auth_user_id()
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
        AND sm.user_id = auth_user_id()
        AND sm.status = 'active'
      )
    )
  )
);

-- Paso 5: Verificar que NO usa auth functions directamente
DO $$
DECLARE
    policy_text TEXT;
    has_direct_auth BOOLEAN;
BEGIN
    SELECT qual INTO policy_text
    FROM pg_policies 
    WHERE tablename = 'visitors' 
    AND schemaname = 'public' 
    AND policyname = 'visitors_unified';
    
    -- Verificar si usa auth functions directamente
    has_direct_auth := policy_text LIKE '%auth.uid()%' OR 
                      policy_text LIKE '%auth.jwt()%' OR 
                      policy_text LIKE '%current_setting(%';
    
    IF has_direct_auth THEN
        RAISE NOTICE '❌ ISSUE: Policy still uses direct auth functions';
    ELSE
        RAISE NOTICE '✅ SUCCESS: Policy uses helper functions only';
    END IF;
    
    RAISE NOTICE 'Policy content: %', policy_text;
END $$; 