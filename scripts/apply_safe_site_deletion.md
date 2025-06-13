# Guía: Implementación de Eliminación Segura de Sitios

Esta guía te ayudará a implementar el sistema de eliminación segura de sitios que requiere confirmación por nombre del proyecto.

## ✅ Cambios Realizados en el Código

### 1. **Función SQL Segura** (`supabase/migrations/safe_site_deletion.sql`)
- ✅ Función `delete_site_safely()` que verifica permisos
- ✅ Trigger mejorado que permite eliminación durante eliminación de sitio
- ✅ Protección contra eliminación accidental de administradores

### 2. **Service Layer** (`lib/services/site-service.ts`)
- ✅ Modificado `deleteSite()` para usar `supabase.rpc('delete_site_safely')`
- ✅ Manejo de errores mejorado

### 3. **UI Modal** (`app/settings/page.tsx`)
- ✅ Input de confirmación por nombre del proyecto
- ✅ Validación en tiempo real
- ✅ Indicadores visuales de estado
- ✅ Botón deshabilitado hasta confirmar nombre

## 🚀 Pasos de Implementación

### Paso 1: Ejecutar la Migración SQL
Copia y pega este código en tu **Supabase SQL Editor**:

```sql
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
```

### Paso 2: Verificar la Implementación
Los cambios en el código ya están aplicados. Solo necesitas:

1. **Hacer build/deploy** de la aplicación
2. **Probar la funcionalidad**

## 🧪 Testing

### ✅ Escenario 1: Eliminación de sitio (debe funcionar)
1. Ve a Settings → General → Danger Zone
2. Haz clic en "Delete Site"
3. Escribe el nombre exacto del proyecto
4. El botón se habilita y permite eliminar

### ✅ Escenario 2: Eliminación de último admin (debe bloquearse)
1. Ve a Settings → Team
2. Intenta eliminar el último admin/owner
3. Debe mostrar error: "Cannot delete the last admin or owner"

### ✅ Escenario 3: Validación de nombre (debe funcionar)
1. En el modal de eliminación
2. Escribe un nombre incorrecto → botón deshabilitado + mensaje rojo
3. Escribe el nombre correcto → botón habilitado + checkmark verde

## 🎯 Beneficios Implementados

1. **Seguridad Mejorada**: Requiere confirmación explícita por nombre
2. **Protección de Datos**: Impide eliminación accidental de administradores
3. **UX Elegante**: Validación en tiempo real con indicadores visuales
4. **Flexibilidad**: Permite eliminación completa de sitios desde la app
5. **Robustez**: Manejo de errores y cleanup automático

## 🚨 Importante

- **Usuario**: La cuenta del usuario **NO se elimina**, solo el sitio
- **Datos**: Todos los datos relacionados al sitio se eliminan en cascada
- **Permisos**: Solo el owner original puede eliminar el sitio
- **Reversión**: La eliminación es **irreversible**

## ✨ Funcionalidades Adicionales

- Modal con confirmación por nombre del proyecto
- Indicadores visuales de validación (rojo/verde)
- Botón inteligente que se habilita solo cuando es seguro
- Mensajes de error informativos
- Protección contra eliminación accidental de admins

¡Listo para producción! 🚀 