-- ============================================================================
-- SCRIPT DE DIAGNÓSTICO: PERMISOS RLS PARA TABLA COMMANDS
-- ============================================================================
-- Este script diagnostica por qué solo el site_owner puede ver los comandos
-- y proporciona la solución para permitir acceso a todos los miembros del sitio.

-- ============================================================================
-- PASO 1: VERIFICAR ESTADO ACTUAL DE RLS
-- ============================================================================

SELECT 
    '1. RLS STATUS' as step,
    'commands' as table_name,
    CASE WHEN relrowsecurity THEN 'ENABLED ✅' ELSE 'DISABLED ❌' END as rls_status,
    'Row Level Security debe estar habilitado' as description
FROM pg_class 
WHERE relname = 'commands' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- ============================================================================
-- PASO 2: LISTAR TODAS LAS POLÍTICAS ACTUALES PARA COMMANDS
-- ============================================================================

SELECT 
    '2. CURRENT POLICIES' as step,
    policyname as policy_name,
    cmd as operation,
    permissive as type,
    CASE 
        WHEN LENGTH(qual) > 100 THEN LEFT(qual, 100) || '...'
        ELSE qual 
    END as using_condition,
    CASE 
        WHEN with_check IS NOT NULL THEN 
            CASE 
                WHEN LENGTH(with_check) > 100 THEN LEFT(with_check, 100) || '...'
                ELSE with_check 
            END
        ELSE 'No with_check condition'
    END as with_check_condition
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'commands'
ORDER BY policyname;

-- ============================================================================
-- PASO 3: VERIFICAR ESTRUCTURA DE LA TABLA COMMANDS
-- ============================================================================

SELECT 
    '3. TABLE STRUCTURE' as step,
    column_name,
    data_type,
    is_nullable,
    CASE 
        WHEN column_default IS NOT NULL THEN column_default
        ELSE 'No default'
    END as default_value,
    CASE 
        WHEN column_name = 'user_id' THEN 'Identificador del usuario que creó el comando'
        WHEN column_name = 'site_id' THEN 'Identificador del sitio al que pertenece el comando'
        WHEN column_name = 'agent_id' THEN 'Identificador del agente que ejecutó el comando'
        ELSE 'Otra columna'
    END as description
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'commands'
AND column_name IN ('id', 'user_id', 'site_id', 'agent_id', 'task', 'status')
ORDER BY ordinal_position;

-- ============================================================================
-- PASO 4: VERIFICAR RELACIONES SITE_MEMBERS
-- ============================================================================

SELECT 
    '4. SITE ACCESS CHECK' as step,
    'Current User: ' || COALESCE((SELECT auth.uid()::text), 'NOT AUTHENTICATED') as current_user,
    'Available for testing site access' as description;

-- ============================================================================
-- PASO 5: FUNCIÓN PARA TESTEAR ACCESO ACTUAL
-- ============================================================================

-- Crear función temporal para testear acceso
CREATE OR REPLACE FUNCTION public.test_commands_access()
RETURNS TABLE(
    step text,
    test_name text,
    result text,
    details text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    commands_count integer;
    user_commands_count integer;
    site_commands_count integer;
    current_user_id uuid;
BEGIN
    -- Obtener el usuario actual
    SELECT auth.uid() INTO current_user_id;
    
    IF current_user_id IS NULL THEN
        RETURN QUERY SELECT 
            '5. ACCESS TEST'::text, 
            'Authentication'::text, 
            'FAILED ❌'::text, 
            'Usuario no autenticado'::text;
        RETURN;
    END IF;
    
    -- Test 1: Contar todos los comandos (debería fallar si RLS está mal configurado)
    BEGIN
        SELECT COUNT(*) INTO commands_count FROM public.commands;
        RETURN QUERY SELECT 
            '5. ACCESS TEST'::text, 
            'Total Commands Count'::text, 
            'SUCCESS ✅'::text, 
            'Can count commands: ' || commands_count::text;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 
            '5. ACCESS TEST'::text, 
            'Total Commands Count'::text, 
            'FAILED ❌'::text, 
            'Cannot access commands table: ' || SQLERRM;
    END;
    
    -- Test 2: Contar comandos del usuario actual
    BEGIN
        SELECT COUNT(*) INTO user_commands_count 
        FROM public.commands 
        WHERE user_id = current_user_id;
        
        RETURN QUERY SELECT 
            '5. ACCESS TEST'::text, 
            'User Commands Count'::text, 
            'SUCCESS ✅'::text, 
            'User commands: ' || user_commands_count::text;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 
            '5. ACCESS TEST'::text, 
            'User Commands Count'::text, 
            'FAILED ❌'::text, 
            'Cannot access user commands: ' || SQLERRM;
    END;
    
    -- Test 3: Contar comandos de sitios accesibles
    BEGIN
        SELECT COUNT(*) INTO site_commands_count 
        FROM public.commands c
        WHERE EXISTS (
            SELECT 1 FROM public.sites s 
            WHERE s.id = c.site_id 
            AND (
                s.user_id = current_user_id OR
                EXISTS (
                    SELECT 1 FROM public.site_members sm 
                    WHERE sm.site_id = s.id 
                    AND sm.user_id = current_user_id
                    AND sm.status = 'active'
                )
            )
        );
        
        RETURN QUERY SELECT 
            '5. ACCESS TEST'::text, 
            'Site Commands Count'::text, 
            'SUCCESS ✅'::text, 
            'Accessible site commands: ' || site_commands_count::text;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 
            '5. ACCESS TEST'::text, 
            'Site Commands Count'::text, 
            'FAILED ❌'::text, 
            'Cannot access site commands: ' || SQLERRM;
    END;
    
    RETURN;
END;
$$;

-- Ejecutar el test de acceso
SELECT * FROM public.test_commands_access();

-- ============================================================================
-- PASO 6: PROBLEMA IDENTIFICADO Y SOLUCIÓN
-- ============================================================================

SELECT 
    '6. DIAGNOSIS' as step,
    'PROBLEM IDENTIFIED' as issue,
    'Commands table likely has restrictive RLS policy' as description,
    'Only user_id owner can see commands, but should allow site members' as details
UNION ALL
SELECT 
    '6. DIAGNOSIS' as step,
    'EXPECTED BEHAVIOR' as issue,
    'All site members should see commands for their sites' as description,
    'Commands should be accessible to site owners and site members' as details;

-- ============================================================================
-- PASO 7: GENERAR SCRIPT DE SOLUCIÓN
-- ============================================================================

SELECT 
    '7. SOLUTION SCRIPT' as step,
    'Execute the following SQL to fix the issue:' as instruction,
    '' as separator,
    '' as details
UNION ALL
SELECT 
    '7. SOLUTION SCRIPT' as step,
    '-- DROP ALL CONFLICTING POLICIES' as instruction,
    'DROP POLICY IF EXISTS "commands_unified" ON public.commands;' as separator,
    'DROP POLICY IF EXISTS "commands_optimized_policy" ON public.commands;' as details
UNION ALL
SELECT 
    '7. SOLUTION SCRIPT' as step,
    'DROP POLICY IF EXISTS "commands_optimized" ON public.commands;' as instruction,
    'DROP POLICY IF EXISTS "Users can insert their own commands" ON public.commands;' as separator,
    'DROP POLICY IF EXISTS "Users can update their own commands" ON public.commands;' as details
UNION ALL
SELECT 
    '7. SOLUTION SCRIPT' as step,
    'DROP POLICY IF EXISTS "Users can view their own commands" ON public.commands;' as instruction,
    '' as separator,
    '-- CREATE NEW OPTIMIZED POLICY' as details
UNION ALL
SELECT 
    '7. SOLUTION SCRIPT' as step,
    'CREATE POLICY "commands_site_access_policy" ON public.commands' as instruction,
    'FOR ALL TO authenticated' as separator,
    'USING (' as details
UNION ALL
SELECT 
    '7. SOLUTION SCRIPT' as step,
    '  -- Allow users to access commands from their sites' as instruction,
    '  EXISTS (' as separator,
    '    SELECT 1 FROM public.sites s' as details
UNION ALL
SELECT 
    '7. SOLUTION SCRIPT' as step,
    '    WHERE s.id = commands.site_id AND (' as instruction,
    '      s.user_id = (SELECT auth.uid()) OR' as separator,
    '      EXISTS (' as details
UNION ALL
SELECT 
    '7. SOLUTION SCRIPT' as step,
    '        SELECT 1 FROM public.site_members sm' as instruction,
    '        WHERE sm.site_id = s.id' as separator,
    '        AND sm.user_id = (SELECT auth.uid())' as details
UNION ALL
SELECT 
    '7. SOLUTION SCRIPT' as step,
    '        AND sm.status = ''active''' as instruction,
    '      )' as separator,
    '    )' as details
UNION ALL
SELECT 
    '7. SOLUTION SCRIPT' as step,
    '  )' as instruction,
    '  -- OR allow users to access their own commands' as separator,
    '  OR commands.user_id = (SELECT auth.uid())' as details
UNION ALL
SELECT 
    '7. SOLUTION SCRIPT' as step,
    ');' as instruction,
    '' as separator,
    '-- ENABLE RLS AND GRANT PERMISSIONS' as details
UNION ALL
SELECT 
    '7. SOLUTION SCRIPT' as step,
    'ALTER TABLE public.commands ENABLE ROW LEVEL SECURITY;' as instruction,
    'GRANT SELECT, INSERT, UPDATE, DELETE ON public.commands TO authenticated;' as separator,
    '' as details;

-- ============================================================================
-- PASO 8: INSTRUCCIONES DE VERIFICACIÓN
-- ============================================================================

SELECT 
    '8. VERIFICATION' as step,
    'After applying the fix, run these commands:' as instruction,
    '1. SELECT COUNT(*) FROM public.commands;' as test_1,
    '2. SELECT * FROM public.test_commands_access();' as test_2
UNION ALL
SELECT 
    '8. VERIFICATION' as step,
    '3. Check that site members can see commands' as instruction,
    '4. Verify that commands are properly scoped to sites' as test_1,
    '5. Test creating new commands from the UI' as test_2;

-- Limpiar función temporal
DROP FUNCTION IF EXISTS public.test_commands_access();

SELECT 
    '9. CLEANUP' as step,
    'Diagnostic completed successfully!' as message,
    'Run the solution script above to fix the RLS permissions' as action,
    'Test with multiple users to verify the fix works' as verification; 