-- =====================================================
-- SCRIPT DE VALIDACIÓN Y CONFIGURACIÓN DE PERMISOS
-- Valida que cuando se cree una cuenta de usuario,
-- se le asignen automáticamente los permisos de sitio
-- =====================================================

-- 1. VALIDAR ESTRUCTURA DE TABLAS EXISTENTES
-- =====================================================

DO $$
DECLARE
    table_exists boolean;
    column_exists boolean;
BEGIN
    -- Verificar que existe la tabla site_members
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'site_members'
    ) INTO table_exists;
    
    IF NOT table_exists THEN
        RAISE EXCEPTION 'ERROR: La tabla site_members no existe. Debe ejecutar las migraciones primero.';
    ELSE
        RAISE NOTICE 'OK: Tabla site_members existe';
    END IF;
    
    -- Verificar campos críticos en site_members
    SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'site_members' 
        AND column_name = 'user_id'
    ) INTO column_exists;
    
    IF NOT column_exists THEN
        RAISE EXCEPTION 'ERROR: Campo user_id no existe en site_members';
    ELSE
        RAISE NOTICE 'OK: Campo user_id existe';
    END IF;
    
    -- Verificar campo email
    SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'site_members' 
        AND column_name = 'email'
    ) INTO column_exists;
    
    IF NOT column_exists THEN
        RAISE EXCEPTION 'ERROR: Campo email no existe en site_members';
    ELSE
        RAISE NOTICE 'OK: Campo email existe';
    END IF;
    
    -- Verificar campo status
    SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'site_members' 
        AND column_name = 'status'
    ) INTO column_exists;
    
    IF NOT column_exists THEN
        RAISE EXCEPTION 'ERROR: Campo status no existe en site_members';
    ELSE
        RAISE NOTICE 'OK: Campo status existe';
    END IF;
    
    -- Verificar que existe la tabla profiles
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles'
    ) INTO table_exists;
    
    IF NOT table_exists THEN
        RAISE EXCEPTION 'ERROR: La tabla profiles no existe';
    ELSE
        RAISE NOTICE 'OK: Tabla profiles existe';
    END IF;
END $$;

-- 2. FUNCIÓN PARA ACTIVAR MIEMBROS PENDIENTES
-- =====================================================

CREATE OR REPLACE FUNCTION activate_pending_site_members()
RETURNS TRIGGER AS $$
BEGIN
    -- Cuando se inserta un nuevo perfil (usuario se registra)
    -- Buscar y activar cualquier site_member pendiente con ese email
    UPDATE public.site_members 
    SET 
        user_id = NEW.id,
        status = 'active',
        updated_at = NOW()
    WHERE 
        email = NEW.email 
        AND status = 'pending' 
        AND user_id IS NULL;
    
    -- Log para debugging
    IF FOUND THEN
        RAISE NOTICE 'Usuario % activado en site_members para email %', NEW.id, NEW.email;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. CREAR TRIGGER PARA ACTIVACIÓN AUTOMÁTICA
-- =====================================================

-- Eliminar trigger existente si existe
DROP TRIGGER IF EXISTS trigger_activate_site_members ON public.profiles;

-- Crear nuevo trigger
CREATE TRIGGER trigger_activate_site_members
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION activate_pending_site_members();

-- 4. FUNCIÓN PARA VALIDAR PERMISOS DE UN USUARIO
-- =====================================================

CREATE OR REPLACE FUNCTION validate_user_site_permissions(user_email text)
RETURNS TABLE (
    site_id uuid,
    site_name text,
    user_role text,
    member_status text,
    has_access boolean
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sm.site_id,
        s.name as site_name,
        sm.role as user_role,
        sm.status as member_status,
        (sm.status = 'active' AND sm.user_id IS NOT NULL) as has_access
    FROM public.site_members sm
    LEFT JOIN public.sites s ON sm.site_id = s.id
    WHERE sm.email = user_email
    ORDER BY sm.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 5. FUNCIÓN PARA VERIFICAR MIEMBROS PENDIENTES
-- =====================================================

CREATE OR REPLACE FUNCTION check_pending_invitations()
RETURNS TABLE (
    email text,
    site_name text,
    role text,
    invited_date timestamptz,
    has_user_account boolean
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sm.email,
        s.name as site_name,
        sm.role,
        sm.created_at as invited_date,
        (p.id IS NOT NULL) as has_user_account
    FROM public.site_members sm
    LEFT JOIN public.sites s ON sm.site_id = s.id
    LEFT JOIN public.profiles p ON sm.email = p.email
    WHERE sm.status = 'pending'
    ORDER BY sm.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 6. PROCEDIMIENTO PARA REPARAR PERMISOS EXISTENTES
-- =====================================================

CREATE OR REPLACE FUNCTION repair_existing_site_permissions()
RETURNS void AS $$
DECLARE
    updated_count integer := 0;
BEGIN
    -- Activar site_members que tienen una cuenta pero están pendientes
    UPDATE public.site_members sm
    SET 
        user_id = p.id,
        status = 'active',
        updated_at = NOW()
    FROM public.profiles p
    WHERE 
        sm.email = p.email 
        AND sm.status = 'pending' 
        AND sm.user_id IS NULL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    RAISE NOTICE 'Reparados % registros de site_members', updated_count;
END;
$$ LANGUAGE plpgsql;

-- 7. QUERIES DE VALIDACIÓN
-- =====================================================

-- Query para verificar el estado actual de miembros pendientes
SELECT 
    'MIEMBROS PENDIENTES SIN CUENTA' as tipo,
    COUNT(*) as cantidad
FROM public.site_members sm
LEFT JOIN public.profiles p ON sm.email = p.email
WHERE sm.status = 'pending' AND p.id IS NULL

UNION ALL

SELECT 
    'MIEMBROS PENDIENTES CON CUENTA (NECESITAN REPARACIÓN)' as tipo,
    COUNT(*) as cantidad
FROM public.site_members sm
INNER JOIN public.profiles p ON sm.email = p.email
WHERE sm.status = 'pending' AND sm.user_id IS NULL

UNION ALL

SELECT 
    'MIEMBROS ACTIVOS' as tipo,
    COUNT(*) as cantidad
FROM public.site_members
WHERE status = 'active' AND user_id IS NOT NULL;

-- 8. INSTRUCCIONES DE USO
-- =====================================================

/*
INSTRUCCIONES DE USO:

1. EJECUTAR ESTE SCRIPT COMPLETO para validar y configurar el sistema

2. VERIFICAR MIEMBROS PENDIENTES:
   SELECT * FROM check_pending_invitations();

3. VALIDAR PERMISOS DE UN USUARIO ESPECÍFICO:
   SELECT * FROM validate_user_site_permissions('usuario@example.com');

4. REPARAR PERMISOS EXISTENTES (si hay inconsistencias):
   SELECT repair_existing_site_permissions();

5. VERIFICAR QUE EL TRIGGER FUNCIONA:
   -- Cuando un usuario se registre, debería activarse automáticamente
   -- Si era un miembro pendiente

6. MONITOREAR LOGS:
   -- Los triggers generan logs con RAISE NOTICE
   -- Revisar logs de PostgreSQL para confirmar activaciones

FLUJO ESPERADO:
1. Usuario es invitado → se crea registro en site_members con status='pending'
2. Usuario crea cuenta → se inserta en profiles → trigger activa site_member
3. Usuario ahora tiene acceso al sitio con el rol asignado
*/

-- 9. VALIDACIÓN FINAL
-- =====================================================

DO $$
BEGIN
    -- Ejecutar reparación de permisos existentes
    PERFORM repair_existing_site_permissions();
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'CONFIGURACIÓN COMPLETADA EXITOSAMENTE';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'El sistema ahora:';
    RAISE NOTICE '1. Valida estructura de tablas ✓';
    RAISE NOTICE '2. Activa automáticamente miembros pendientes ✓';
    RAISE NOTICE '3. Proporciona funciones de validación ✓';
    RAISE NOTICE '4. Incluye procedimientos de reparación ✓';
    RAISE NOTICE '========================================';
END $$; 