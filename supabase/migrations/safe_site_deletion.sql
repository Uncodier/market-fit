-- Migration: Safe site deletion function and improved trigger
-- This allows the app to delete sites while protecting against accidental admin deletion

-- ========================================
-- 1. FUNCIÓN SEGURA PARA ELIMINAR SITIOS
-- ========================================

-- Función segura para eliminar sitios completos
CREATE OR REPLACE FUNCTION delete_site_safely(site_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Verificar que el usuario tiene permisos (owner del sitio)
    IF NOT EXISTS (
        SELECT 1 FROM sites s
        WHERE s.id = site_id_param 
        AND s.user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Permission denied: Only site owner can delete the site';
    END IF;
    
    -- Establecer variable de contexto para indicar que estamos eliminando un sitio
    PERFORM set_config('app.deleting_site', site_id_param::text, true);
    
    -- Eliminar el sitio (CASCADE eliminará todo lo demás)
    DELETE FROM sites WHERE id = site_id_param;
    
    -- Limpiar la variable de contexto
    PERFORM set_config('app.deleting_site', '', true);
    
    RETURN true;
EXCEPTION
    WHEN OTHERS THEN
        -- Limpiar la variable en caso de error
        PERFORM set_config('app.deleting_site', '', true);
        RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- 2. TRIGGER MEJORADO PARA PROTEGER ADMINS
-- ========================================

-- Función mejorada del trigger que respeta el contexto de eliminación de sitios
CREATE OR REPLACE FUNCTION prevent_last_admin_deletion()
RETURNS TRIGGER AS $$
DECLARE
    admin_count INTEGER;
    site_id_to_check UUID;
    deleting_site_id TEXT;
BEGIN
    site_id_to_check := OLD.site_id;
    
    -- Solo proteger admin/owner deletions
    IF OLD.role NOT IN ('admin', 'owner') THEN
        RETURN OLD;
    END IF;
    
    -- Verificar si estamos eliminando este sitio completo
    deleting_site_id := current_setting('app.deleting_site', true);
    
    -- Si estamos eliminando este sitio, permitir la eliminación del owner
    IF deleting_site_id = site_id_to_check::text THEN
        RETURN OLD;
    END IF;
    
    -- Contar admins restantes para eliminaciones individuales
    SELECT COUNT(*) INTO admin_count
    FROM site_members 
    WHERE site_id = site_id_to_check 
    AND role IN ('admin', 'owner')
    AND id != OLD.id;
    
    -- Proteger contra eliminar el último admin individualmente
    IF admin_count = 0 THEN
        RAISE EXCEPTION 'Cannot delete the last admin or owner of the site. At least one admin or owner must remain.';
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Recrear el trigger con la función mejorada
DROP TRIGGER IF EXISTS prevent_last_admin_deletion_trigger ON site_members;

CREATE TRIGGER prevent_last_admin_deletion_trigger
    BEFORE DELETE ON site_members
    FOR EACH ROW
    EXECUTE FUNCTION prevent_last_admin_deletion();

-- ========================================
-- 3. PERMISOS PARA LA FUNCIÓN
-- ========================================

-- Grant permisos para que authenticated users puedan usar la función
GRANT EXECUTE ON FUNCTION delete_site_safely(UUID) TO authenticated;

-- ========================================
-- 4. COMENTARIOS PARA DOCUMENTACIÓN
-- ========================================

COMMENT ON FUNCTION delete_site_safely(UUID) IS 'Safely deletes a site and all its related data. Only the site owner can delete the site.';
COMMENT ON FUNCTION prevent_last_admin_deletion() IS 'Prevents deletion of the last admin/owner unless the entire site is being deleted.';
COMMENT ON TRIGGER prevent_last_admin_deletion_trigger ON site_members IS 'Ensures at least one admin/owner remains when deleting members individually, but allows deletion during site deletion.'; 