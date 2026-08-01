-- Extend locations with address fields used by Settings UI,
-- then backfill from settings.locations JSON for every site.
-- Ensure every site has at least one default location.

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS zip text,
  ADD COLUMN IF NOT EXISTS country text;

DO $$
DECLARE
  site_record RECORD;
  loc_record jsonb;
  loc_name text;
  existing_count integer;
  has_default boolean;
BEGIN
  FOR site_record IN
    SELECT s.id AS site_id, COALESCE(st.locations, '[]'::jsonb) AS locations
    FROM public.sites s
    LEFT JOIN public.settings st ON st.site_id = s.id
  LOOP
    -- Backfill each JSON location that does not already exist by name
    IF jsonb_typeof(site_record.locations) = 'array'
       AND jsonb_array_length(site_record.locations) > 0 THEN
      FOR loc_record IN SELECT * FROM jsonb_array_elements(site_record.locations)
      LOOP
        loc_name := NULLIF(TRIM(COALESCE(loc_record->>'name', '')), '');
        IF loc_name IS NULL THEN
          CONTINUE;
        END IF;

        INSERT INTO public.locations (
          site_id,
          name,
          address,
          city,
          state,
          zip,
          country,
          is_default,
          is_active
        )
        VALUES (
          site_record.site_id,
          loc_name,
          NULLIF(TRIM(COALESCE(loc_record->>'address', '')), ''),
          NULLIF(TRIM(COALESCE(loc_record->>'city', '')), ''),
          NULLIF(TRIM(COALESCE(loc_record->>'state', '')), ''),
          NULLIF(TRIM(COALESCE(loc_record->>'zip', '')), ''),
          NULLIF(TRIM(COALESCE(loc_record->>'country', '')), ''),
          false,
          true
        )
        ON CONFLICT (site_id, name) DO UPDATE SET
          address = COALESCE(EXCLUDED.address, public.locations.address),
          city = COALESCE(EXCLUDED.city, public.locations.city),
          state = COALESCE(EXCLUDED.state, public.locations.state),
          zip = COALESCE(EXCLUDED.zip, public.locations.zip),
          country = COALESCE(EXCLUDED.country, public.locations.country),
          is_active = true,
          updated_at = now();
      END LOOP;
    END IF;

    -- Ensure at least one location exists
    SELECT COUNT(*) INTO existing_count
    FROM public.locations
    WHERE site_id = site_record.site_id;

    IF existing_count = 0 THEN
      INSERT INTO public.locations (site_id, name, is_default, is_active)
      VALUES (site_record.site_id, 'Main', true, true);
    ELSE
      -- Ensure exactly one default among existing locations
      SELECT EXISTS (
        SELECT 1 FROM public.locations
        WHERE site_id = site_record.site_id AND is_default = true
      ) INTO has_default;

      IF NOT has_default THEN
        UPDATE public.locations
        SET is_default = true, updated_at = now()
        WHERE id = (
          SELECT id FROM public.locations
          WHERE site_id = site_record.site_id
          ORDER BY created_at ASC, name ASC
          LIMIT 1
        );
      END IF;
    END IF;
  END LOOP;
END $$;
