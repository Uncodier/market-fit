-- Script para manejar la eliminación en cascada de requirements cuando se borra una campaña
-- Fecha: $(date +%Y-%m-%d)
-- Descripción: Este script implementa la eliminación automática de requirements asociados
-- cuando se elimina una campaña a través de la tabla intermedia campaign_requirements

-- ============================================================================
-- OPCIÓN 1: USANDO TRIGGER (Recomendado)
-- ============================================================================

-- Crear función que maneje la eliminación en cascada
CREATE OR REPLACE FUNCTION handle_campaign_deletion()
RETURNS TRIGGER AS $$
BEGIN
    -- Log de la operación (opcional, para debugging)
    RAISE NOTICE 'Deleting campaign: % - %', OLD.id, OLD.title;
    
    -- Primero eliminamos las relaciones en campaign_requirements
    DELETE FROM public.campaign_requirements 
    WHERE campaign_id = OLD.id;
    
    -- Luego eliminamos los requirements que solo estaban asociados a esta campaña
    -- (requirements que no tienen otras relaciones de campaña)
    DELETE FROM public.requirements 
    WHERE id IN (
        SELECT r.id 
        FROM public.requirements r
        LEFT JOIN public.campaign_requirements cr ON r.id = cr.requirement_id
        WHERE cr.requirement_id IS NULL
        AND r.id IN (
            -- Solo eliminar requirements que estaban asociados a la campaña eliminada
            SELECT requirement_id 
            FROM public.campaign_requirements 
            WHERE campaign_id = OLD.id
        )
    );
    
    -- También eliminar subtasks relacionadas
    DELETE FROM public.campaign_subtasks 
    WHERE campaign_id = OLD.id;
    
    -- Eliminar segments relacionados
    DELETE FROM public.campaign_segments 
    WHERE campaign_id = OLD.id;
    
    -- Eliminar transacciones relacionadas
    DELETE FROM public.transactions 
    WHERE campaign_id = OLD.id;
    
    RAISE NOTICE 'Campaign deletion completed for: %', OLD.id;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Crear el trigger
DROP TRIGGER IF EXISTS campaign_cascade_delete_trigger ON public.campaigns;
CREATE TRIGGER campaign_cascade_delete_trigger
    BEFORE DELETE ON public.campaigns
    FOR EACH ROW
    EXECUTE FUNCTION handle_campaign_deletion();

-- ============================================================================
-- OPCIÓN 2: FUNCIÓN ALTERNATIVA (Solo elimina requirements huérfanos)
-- ============================================================================

-- Función alternativa que solo elimina requirements que quedan huérfanos
-- (sin ninguna campaña asociada)
CREATE OR REPLACE FUNCTION handle_campaign_deletion_orphans_only()
RETURNS TRIGGER AS $$
BEGIN
    RAISE NOTICE 'Deleting campaign: % - %', OLD.id, OLD.title;
    
    -- Guardamos los requirement_ids que están asociados a esta campaña
    -- antes de eliminar las relaciones
    CREATE TEMP TABLE temp_campaign_requirements AS
    SELECT requirement_id 
    FROM public.campaign_requirements 
    WHERE campaign_id = OLD.id;
    
    -- Eliminar las relaciones en campaign_requirements
    DELETE FROM public.campaign_requirements 
    WHERE campaign_id = OLD.id;
    
    -- Eliminar solo los requirements que quedaron huérfanos
    -- (que no tienen ninguna otra campaña asociada)
    DELETE FROM public.requirements 
    WHERE id IN (
        SELECT tcr.requirement_id 
        FROM temp_campaign_requirements tcr
        LEFT JOIN public.campaign_requirements cr ON tcr.requirement_id = cr.requirement_id
        WHERE cr.requirement_id IS NULL
    );
    
    -- Limpiar tabla temporal
    DROP TABLE temp_campaign_requirements;
    
    -- Eliminar otros elementos relacionados
    DELETE FROM public.campaign_subtasks WHERE campaign_id = OLD.id;
    DELETE FROM public.campaign_segments WHERE campaign_id = OLD.id;
    DELETE FROM public.transactions WHERE campaign_id = OLD.id;
    
    RAISE NOTICE 'Campaign deletion completed for: %', OLD.id;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- OPCIÓN 3: USANDO FOREIGN KEYS CON CASCADA (Alternativa)
-- ============================================================================

-- NOTA: Si prefieres usar foreign keys con cascada en lugar de triggers,
-- puedes ejecutar estos comandos (comentados porque requieren recrear las FK):

/*
-- Eliminar las foreign keys existentes
ALTER TABLE public.campaign_requirements 
DROP CONSTRAINT IF EXISTS campaign_requirements_campaign_id_fkey;

ALTER TABLE public.campaign_subtasks 
DROP CONSTRAINT IF EXISTS campaign_subtasks_campaign_id_fkey;

ALTER TABLE public.campaign_segments 
DROP CONSTRAINT IF EXISTS campaign_segments_campaign_id_fkey;

ALTER TABLE public.transactions 
DROP CONSTRAINT IF EXISTS transactions_campaign_id_fkey;

-- Recrear con DELETE CASCADE
ALTER TABLE public.campaign_requirements 
ADD CONSTRAINT campaign_requirements_campaign_id_fkey 
FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;

ALTER TABLE public.campaign_subtasks 
ADD CONSTRAINT campaign_subtasks_campaign_id_fkey 
FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;

ALTER TABLE public.campaign_segments 
ADD CONSTRAINT campaign_segments_campaign_id_fkey 
FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;

ALTER TABLE public.transactions 
ADD CONSTRAINT transactions_campaign_id_fkey 
FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;
*/

-- ============================================================================
-- FUNCIÓN PARA CAMBIAR ENTRE COMPORTAMIENTOS
-- ============================================================================

-- Si quieres cambiar a la función que solo elimina huérfanos:
/*
DROP TRIGGER IF EXISTS campaign_cascade_delete_trigger ON public.campaigns;
CREATE TRIGGER campaign_cascade_delete_trigger
    BEFORE DELETE ON public.campaigns
    FOR EACH ROW
    EXECUTE FUNCTION handle_campaign_deletion_orphans_only();
*/

-- ============================================================================
-- TESTING (Opcional - para verificar que funciona)
-- ============================================================================

-- Script de prueba (descomenta para probar):
/*
-- Crear campaña de prueba
INSERT INTO public.campaigns (id, title, description, type, site_id, user_id)
VALUES (
    gen_random_uuid(),
    'Test Campaign for Deletion',
    'This is a test campaign',
    'test',
    (SELECT id FROM public.sites LIMIT 1),
    (SELECT id FROM auth.users LIMIT 1)
);

-- Crear requirement de prueba
INSERT INTO public.requirements (id, title, description, priority, status, completion_status, site_id, user_id)
VALUES (
    gen_random_uuid(),
    'Test Requirement',
    'This is a test requirement',
    'medium',
    'backlog',
    'pending',
    (SELECT id FROM public.sites LIMIT 1),
    (SELECT id FROM auth.users LIMIT 1)
);

-- Relacionar campaña con requirement
INSERT INTO public.campaign_requirements (campaign_id, requirement_id)
VALUES (
    (SELECT id FROM public.campaigns WHERE title = 'Test Campaign for Deletion'),
    (SELECT id FROM public.requirements WHERE title = 'Test Requirement')
);

-- Verificar que existe la relación
SELECT c.title as campaign, r.title as requirement
FROM public.campaigns c
JOIN public.campaign_requirements cr ON c.id = cr.campaign_id
JOIN public.requirements r ON cr.requirement_id = r.id
WHERE c.title = 'Test Campaign for Deletion';

-- Eliminar la campaña (debería eliminar automáticamente el requirement si no tiene otras relaciones)
DELETE FROM public.campaigns WHERE title = 'Test Campaign for Deletion';

-- Verificar que el requirement también fue eliminado
SELECT * FROM public.requirements WHERE title = 'Test Requirement';
*/

-- ============================================================================
-- NOTAS IMPORTANTES
-- ============================================================================

/*
COMPORTAMIENTO DEL SCRIPT:

1. TRIGGER PRINCIPAL (handle_campaign_deletion):
   - Elimina la campaña
   - Elimina todas las relaciones en campaign_requirements
   - Elimina requirements que quedan huérfanos (sin otras campañas)
   - Elimina subtasks, segments y transactions relacionados

2. TRIGGER ALTERNATIVO (handle_campaign_deletion_orphans_only):
   - Solo elimina requirements que no tienen ninguna otra campaña asociada
   - Más conservador, mantiene requirements si están en otras campañas

3. FOREIGN KEY CASCADE:
   - Eliminación automática por la base de datos
   - Más rápido pero menos control sobre la lógica

RECOMENDACIÓN:
- Usar la OPCIÓN 1 (trigger principal) si quieres eliminar todos los datos relacionados
- Usar la OPCIÓN 2 si quieres preservar requirements que están en múltiples campañas
- La OPCIÓN 3 es más simple pero no maneja la lógica de requirements huérfanos

Para activar: simplemente ejecuta este script en tu base de datos Supabase
El trigger se activará automáticamente cuando elimines una campaña.
*/ 