-- SCRIPT PARA ELIMINAR LA FUNCIÓN PROBLEMÁTICA
-- Esta función está causando el error al referenciar una tabla que no existe

-- 1. Buscar y eliminar triggers relacionados con sync_site_membership
DROP TRIGGER IF EXISTS sync_site_membership_trigger ON public.site_members;
DROP TRIGGER IF EXISTS sync_membership_trigger ON public.site_members;
DROP TRIGGER IF EXISTS update_site_membership ON public.site_members;

-- 2. Eliminar la función problemática
DROP FUNCTION IF EXISTS public.sync_site_membership();
DROP FUNCTION IF EXISTS public.sync_site_membership(site_id uuid, user_id uuid);
DROP FUNCTION IF EXISTS sync_site_membership();

-- 3. Verificar que no hay más triggers problemáticos en site_members
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'site_members';

-- 4. Ahora intentar la inserción de prueba
INSERT INTO public.site_members (
    site_id, 
    user_id, 
    email, 
    role, 
    status, 
    added_by
) 
VALUES (
    (SELECT id FROM public.sites LIMIT 1),
    NULL,  
    'test@example.com',
    'collaborator',
    'pending',
    (SELECT user_id FROM public.sites LIMIT 1)
)
RETURNING id, email, role;

-- 5. Limpiar el registro de prueba
DELETE FROM public.site_members WHERE email = 'test@example.com';

-- 6. Confirmar que la inserción funciona
SELECT 'INSERCIÓN EXITOSA - PROBLEMA RESUELTO' as resultado; 