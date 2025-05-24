-- =====================================================
-- VERIFICAR POLÍTICAS SITE_MEMBERS Y DIAGNOSTICAR 500
-- =====================================================

-- 1. VERIFICAR POLÍTICAS ACTUALES
-- =====================================================

SELECT 
    'POLÍTICAS ACTUALES EN site_members' AS resultado,
    '===================================' AS separador;

SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'site_members' 
ORDER BY policyname;

-- 2. VERIFICAR TABLA SITE_OWNERSHIP
-- =====================================================

SELECT 
    'VERIFICAR SITE_OWNERSHIP' AS resultado,
    '========================' AS separador;

-- Ver algunos registros de site_ownership
SELECT 
    so.site_id,
    so.user_id,
    s.name as site_name,
    s.user_id as original_site_owner
FROM site_ownership so
LEFT JOIN sites s ON so.site_id = s.id
LIMIT 5;

-- 3. PROBAR INSERT MANUAL
-- =====================================================

-- Primero obtener un site_id y user_id válidos para la prueba
DO $$
DECLARE
    test_site_id UUID;
    test_user_id UUID;
    test_email TEXT := 'test-manual@example.com';
BEGIN
    -- Obtener el primer site disponible
    SELECT s.id, s.user_id INTO test_site_id, test_user_id
    FROM sites s 
    LIMIT 1;
    
    IF test_site_id IS NULL THEN
        RAISE NOTICE 'No hay sites disponibles para la prueba';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Probando INSERT con site_id: %, user_id: %', test_site_id, test_user_id;
    
    -- Eliminar registro de prueba si existe
    DELETE FROM site_members 
    WHERE site_id = test_site_id AND email = test_email;
    
    -- Intentar INSERT manual
    BEGIN
        INSERT INTO site_members (
            site_id,
            user_id,
            email,
            role,
            name,
            position,
            added_by,
            status
        ) VALUES (
            test_site_id,
            NULL, -- user_id NULL para pending
            test_email,
            'collaborator',
            'Test User Manual',
            'Test Position',
            test_user_id,
            'pending'
        );
        
        RAISE NOTICE '✅ INSERT manual exitoso';
        
        -- Limpiar después de la prueba
        DELETE FROM site_members 
        WHERE site_id = test_site_id AND email = test_email;
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ INSERT manual falló: %', SQLERRM;
        RAISE NOTICE 'Error code: %', SQLSTATE;
    END;
END $$;

-- 4. VERIFICAR PERMISOS DE AUTH.UID()
-- =====================================================

SELECT 
    'VERIFICAR AUTH.UID() ACTUAL' AS resultado,
    '===========================' AS separador;

-- Mostrar el auth.uid() actual (solo funciona en contexto autenticado)
SELECT 
    auth.uid() as current_user_id,
    CASE 
        WHEN auth.uid() IS NULL THEN 'No autenticado'
        ELSE 'Autenticado'
    END as auth_status;

-- 5. VERIFICAR ACCESO A SITE_OWNERSHIP
-- =====================================================

SELECT 
    'ACCESO A SITE_OWNERSHIP PARA USUARIO ACTUAL' AS resultado,
    '=============================================' AS separador;

-- Ver qué sites puede acceder el usuario actual
SELECT 
    so.site_id,
    s.name as site_name,
    'Can access via site_ownership' as access_type
FROM site_ownership so
LEFT JOIN sites s ON so.site_id = s.id
WHERE so.user_id = auth.uid()
LIMIT 5;

-- 6. RECOMENDACIONES
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'DIAGNÓSTICO COMPLETADO';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Revisa los resultados anteriores:';
    RAISE NOTICE '1. ¿Las políticas están creadas correctamente?';
    RAISE NOTICE '2. ¿El INSERT manual funcionó?';
    RAISE NOTICE '3. ¿auth.uid() retorna un ID válido?';
    RAISE NOTICE '4. ¿El usuario tiene acceso via site_ownership?';
    RAISE NOTICE '';
    RAISE NOTICE 'Si el INSERT manual falló, el problema es de políticas RLS';
    RAISE NOTICE 'Si funcionó, el problema es en el código de la aplicación';
    RAISE NOTICE '';
END $$; 