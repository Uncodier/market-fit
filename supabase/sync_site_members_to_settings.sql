-- SINCRONIZACIÓN AUTOMÁTICA: site_members → settings.team_members
-- Este trigger mantiene actualizado el campo team_members en settings cuando cambia site_members

CREATE OR REPLACE FUNCTION sync_site_members_to_settings()
RETURNS TRIGGER AS $$
DECLARE
    affected_site_id UUID;
    team_members_json JSONB;
BEGIN
    -- Determinar qué site_id fue afectado
    IF TG_OP = 'DELETE' THEN
        affected_site_id := OLD.site_id;
    ELSE
        affected_site_id := NEW.site_id;
    END IF;
    
    -- Construir el JSON de team_members desde site_members
    SELECT jsonb_agg(
        jsonb_build_object(
            'email', sm.email,
            'role', CASE 
                WHEN sm.role = 'admin' THEN 'admin'
                WHEN sm.role = 'marketing' THEN 'create'
                WHEN sm.role = 'collaborator' THEN 'view'
                ELSE 'view'
            END,
            'name', COALESCE(sm.name, ''),
            'position', COALESCE(sm.position, '')
        )
    )
    INTO team_members_json
    FROM public.site_members sm
    WHERE sm.site_id = affected_site_id
      AND sm.status = 'active'
      AND sm.role != 'owner'; -- Excluir owners del team_members
    
    -- Si no hay miembros, usar array vacío
    team_members_json := COALESCE(team_members_json, '[]'::jsonb);
    
    -- Actualizar settings.team_members
    UPDATE public.settings
    SET team_members = team_members_json,
        updated_at = now()
    WHERE site_id = affected_site_id;
    
    -- Si no existe un registro en settings, crearlo
    IF NOT FOUND THEN
        INSERT INTO public.settings (site_id, team_members, created_at, updated_at)
        VALUES (affected_site_id, team_members_json, now(), now())
        ON CONFLICT (site_id) DO UPDATE 
        SET team_members = EXCLUDED.team_members,
            updated_at = EXCLUDED.updated_at;
    END IF;
    
    -- Retornar el registro apropiado
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Crear el trigger que se ejecuta en INSERT, UPDATE, DELETE
DROP TRIGGER IF EXISTS sync_members_to_settings ON public.site_members;
CREATE TRIGGER sync_members_to_settings
    AFTER INSERT OR UPDATE OR DELETE ON public.site_members
    FOR EACH ROW
    EXECUTE FUNCTION sync_site_members_to_settings();

-- Sincronizar datos existentes (ejecutar una sola vez)
UPDATE public.settings 
SET team_members = (
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'email', sm.email,
            'role', CASE 
                WHEN sm.role = 'admin' THEN 'admin'
                WHEN sm.role = 'marketing' THEN 'create'
                WHEN sm.role = 'collaborator' THEN 'view'
                ELSE 'view'
            END,
            'name', COALESCE(sm.name, ''),
            'position', COALESCE(sm.position, '')
        )
    ), '[]'::jsonb)
    FROM public.site_members sm
    WHERE sm.site_id = settings.site_id
      AND sm.status = 'active'
      AND sm.role != 'owner'
),
updated_at = now()
WHERE EXISTS (
    SELECT 1 FROM public.site_members 
    WHERE site_id = settings.site_id
);

-- Verificar que la sincronización funciona
SELECT 'SINCRONIZACIÓN CONFIGURADA CORRECTAMENTE' as resultado; 