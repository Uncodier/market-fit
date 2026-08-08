-- Add to publication for realtime if needed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'sale_orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE sale_orders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'sale_order_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE sale_order_items;
  END IF;
END
$$;
