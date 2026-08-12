-- Allow public/anonymous SELECT of modifier groups attached to active catalog items
-- (shop & marketplace PDP). Writes remain restricted to the existing unified policies.

CREATE POLICY "modifier_groups_public_read" ON public.modifier_groups
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.catalog_item_modifier_groups link
    JOIN public.catalog_items host ON host.id = link.catalog_item_id
    WHERE link.modifier_group_id = modifier_groups.id
      AND host.status = 'active'
  )
);

CREATE POLICY "modifier_group_items_public_read" ON public.modifier_group_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.modifier_groups g
    JOIN public.catalog_item_modifier_groups link ON link.modifier_group_id = g.id
    JOIN public.catalog_items host ON host.id = link.catalog_item_id
    WHERE g.id = modifier_group_items.modifier_group_id
      AND host.status = 'active'
  )
);

CREATE POLICY "catalog_item_modifier_groups_public_read" ON public.catalog_item_modifier_groups
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.catalog_items host
    WHERE host.id = catalog_item_modifier_groups.catalog_item_id
      AND host.status = 'active'
  )
);
