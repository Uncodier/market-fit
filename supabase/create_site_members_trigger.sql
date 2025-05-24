-- =====================================================
-- CREAR FUNCIÓN Y TRIGGER PARA ACTIVACIÓN AUTOMÁTICA
-- Activa site_members pendientes cuando se crea un usuario
-- =====================================================

-- 1. CREAR FUNCIÓN PARA ACTIVAR MIEMBROS PENDIENTES
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
    
    -- Log para debugging (aparecerá en los logs de PostgreSQL)
    IF FOUND THEN
        RAISE NOTICE 'Usuario % activado en site_members para email %', NEW.id, NEW.email;
    ELSE
        RAISE NOTICE 'No se encontraron site_members pendientes para email %', NEW.email;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. CREAR TRIGGER PARA ACTIVACIÓN AUTOMÁTICA
-- =====================================================

-- Eliminar trigger existente si existe (para evitar duplicados)
DROP TRIGGER IF EXISTS trigger_activate_site_members ON public.profiles;

-- Crear nuevo trigger
CREATE TRIGGER trigger_activate_site_members
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION activate_pending_site_members();

-- 3. VERIFICAR QUE SE CREÓ CORRECTAMENTE
-- =====================================================

-- Verificar que la función existe
SELECT 
    'VERIFICACIÓN DE CREACIÓN' AS resultado,
    '========================' AS separador;

SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc 
            WHERE proname = 'activate_pending_site_members'
        ) 
        THEN '✓ FUNCIÓN CREADA CORRECTAMENTE'
        ELSE '✗ ERROR: FUNCIÓN NO CREADA'
    END AS estado_funcion;

-- Verificar que el trigger existe
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.triggers 
            WHERE trigger_name = 'trigger_activate_site_members'
                AND event_object_table = 'profiles'
        ) 
        THEN '✓ TRIGGER CREADO CORRECTAMENTE'
        ELSE '✗ ERROR: TRIGGER NO CREADO'
    END AS estado_trigger;

-- 4. ACTIVAR MIEMBROS PENDIENTES EXISTENTES (REPARACIÓN)
-- =====================================================

-- Función para reparar casos existentes
CREATE OR REPLACE FUNCTION repair_existing_pending_members()
RETURNS TABLE (
    email_reparado text,
    user_id_asignado uuid,
    sitio text
) AS $$
BEGIN
    -- Mostrar qué se va a reparar antes de hacerlo
    RAISE NOTICE 'Iniciando reparación de miembros pendientes existentes...';
    
    -- Activar site_members que tienen una cuenta pero están pendientes
    UPDATE public.site_members sm
    SET 
        user_id = p.id,
        status = 'active',
        updated_at = NOW()
    FROM public.profiles p, public.sites s
    WHERE 
        sm.email = p.email 
        AND sm.status = 'pending' 
        AND sm.user_id IS NULL
        AND sm.site_id = s.id;
    
    -- Retornar los casos reparados
    RETURN QUERY
    SELECT 
        sm.email as email_reparado,
        sm.user_id as user_id_asignado,
        s.name as sitio
    FROM public.site_members sm
    LEFT JOIN public.sites s ON sm.site_id = s.id
    WHERE sm.status = 'active' 
        AND sm.updated_at >= NOW() - INTERVAL '1 minute'
        AND sm.user_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Ejecutar la reparación y mostrar resultados
SELECT 
    'REPARACIÓN DE CASOS EXISTENTES' AS resultado,
    '===============================' AS separador;

SELECT * FROM repair_existing_pending_members();

-- 5. INSTRUCCIONES Y VERIFICACIÓN FINAL
-- =====================================================

SELECT 
    'CONFIGURACIÓN COMPLETADA' AS resultado,
    '========================' AS separador;

-- Mostrar el estado final del sistema
SELECT 
    'ELEMENTO' AS componente,
    'ESTADO' AS estado
    
UNION ALL

SELECT 
    'Función activate_pending_site_members',
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'activate_pending_site_members')
        THEN '✓ CREADA'
        ELSE '✗ ERROR'
    END

UNION ALL

SELECT 
    'Trigger trigger_activate_site_members',
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.triggers 
            WHERE trigger_name = 'trigger_activate_site_members'
        )
        THEN '✓ CREADO'
        ELSE '✗ ERROR'
    END

UNION ALL

SELECT 
    'Sistema de activación automática',
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'activate_pending_site_members')
             AND EXISTS (
                SELECT 1 FROM information_schema.triggers 
                WHERE trigger_name = 'trigger_activate_site_members'
             )
        THEN '✅ FUNCIONANDO'
        ELSE '❌ INCOMPLETO'
    END;

-- 6. MOSTRAR CASOS PENDIENTES RESTANTES
-- =====================================================

SELECT 
    'CASOS PENDIENTES DESPUÉS DE LA REPARACIÓN' AS resultado,
    '=========================================' AS separador;

-- Verificar si quedan casos pendientes
SELECT 
    sm.email,
    sm.role,
    s.name as sitio,
    sm.created_at as fecha_invitacion,
    CASE 
        WHEN p.id IS NULL THEN 'Usuario aún no se ha registrado'
        ELSE 'Error: Usuario existe pero no se activó'
    END AS motivo_pendiente
FROM public.site_members sm
LEFT JOIN public.profiles p ON sm.email = p.email
LEFT JOIN public.sites s ON sm.site_id = s.id
WHERE sm.status = 'pending'
ORDER BY sm.created_at DESC;

-- Mensaje final
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'CONFIGURACIÓN COMPLETADA EXITOSAMENTE';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'El sistema ahora funcionará así:';
    RAISE NOTICE '1. Usuario es invitado → se crea en site_members con status=pending';
    RAISE NOTICE '2. Usuario se registra → se inserta en profiles';
    RAISE NOTICE '3. Trigger automático → activa el site_member correspondiente';
    RAISE NOTICE '4. Usuario tiene acceso inmediato con el rol asignado';
    RAISE NOTICE '';
    RAISE NOTICE 'Para probar: invita a un usuario y pídele que se registre';
    RAISE NOTICE 'Revisa los logs de PostgreSQL para ver la activación';
    RAISE NOTICE '';
END $$; 