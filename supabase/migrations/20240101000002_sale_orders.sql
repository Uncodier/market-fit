-- Create sale_orders table
CREATE TABLE IF NOT EXISTS public.sale_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_total NUMERIC NOT NULL DEFAULT 0,
  discount_total NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index on sale_id for faster queries
CREATE INDEX IF NOT EXISTS idx_sale_orders_sale_id ON public.sale_orders(sale_id);

-- Create index on site_id for faster queries
CREATE INDEX IF NOT EXISTS idx_sale_orders_site_id ON public.sale_orders(site_id);

-- Create trigger to update updated_at column automatically
CREATE OR REPLACE FUNCTION update_sale_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_sale_orders_updated_at
BEFORE UPDATE ON public.sale_orders
FOR EACH ROW
EXECUTE FUNCTION update_sale_orders_updated_at();

-- RLS (Row Level Security) Policies
ALTER TABLE public.sale_orders ENABLE ROW LEVEL SECURITY;

-- Simple policy to allow users to select their own records
CREATE POLICY "Users can view their own sale orders" ON public.sale_orders
  FOR SELECT
  USING (user_id = auth.uid());

-- Simple policy to allow users to insert their own records
CREATE POLICY "Users can insert their own sale orders" ON public.sale_orders
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Simple policy to allow users to update their own records
CREATE POLICY "Users can update their own sale orders" ON public.sale_orders
  FOR UPDATE
  USING (user_id = auth.uid());

-- Simple policy to allow users to delete their own records
CREATE POLICY "Users can delete their own sale orders" ON public.sale_orders
  FOR DELETE
  USING (user_id = auth.uid());

-- Comments on table and columns
COMMENT ON TABLE public.sale_orders IS 'Stores order details associated with sales';
COMMENT ON COLUMN public.sale_orders.id IS 'Primary key for the sale order';
COMMENT ON COLUMN public.sale_orders.sale_id IS 'Reference to the associated sale';
COMMENT ON COLUMN public.sale_orders.order_number IS 'Unique identifier for the order';
COMMENT ON COLUMN public.sale_orders.items IS 'JSON array containing order items with details';
COMMENT ON COLUMN public.sale_orders.subtotal IS 'Sum of all items before tax and discounts';
COMMENT ON COLUMN public.sale_orders.tax_total IS 'Total tax amount applied to the order';
COMMENT ON COLUMN public.sale_orders.discount_total IS 'Total discount amount applied to the order';
COMMENT ON COLUMN public.sale_orders.total IS 'Final order total (subtotal + tax - discount)';
COMMENT ON COLUMN public.sale_orders.notes IS 'Additional notes or comments about the order';
COMMENT ON COLUMN public.sale_orders.status IS 'Current status of the order';
COMMENT ON COLUMN public.sale_orders.site_id IS 'Reference to the site this order belongs to';
COMMENT ON COLUMN public.sale_orders.user_id IS 'User who created this order';
COMMENT ON COLUMN public.sale_orders.created_at IS 'Timestamp when the order was created';
COMMENT ON COLUMN public.sale_orders.updated_at IS 'Timestamp when the order was last updated'; 