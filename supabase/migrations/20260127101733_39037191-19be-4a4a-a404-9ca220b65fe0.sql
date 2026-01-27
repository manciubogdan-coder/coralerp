-- Order management tables for all inventory types

-- Materii Prime Orders
CREATE TABLE public.product_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id),
  quantity_ordered NUMERIC(14,2) NOT NULL,
  order_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  expected_delivery_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ordered', 'delivered', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ambalaje Orders
CREATE TABLE public.ambalaje_product_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.ambalaje_products(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.ambalaje_suppliers(id),
  quantity_ordered NUMERIC(14,2) NOT NULL,
  order_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  expected_delivery_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ordered', 'delivered', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Etichete Orders
CREATE TABLE public.etichete_product_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.etichete_products(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.etichete_suppliers(id),
  quantity_ordered NUMERIC(14,2) NOT NULL,
  order_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  expected_delivery_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ordered', 'delivered', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambalaje_product_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etichete_product_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow all authenticated users
CREATE POLICY "Authenticated users can view orders" ON public.product_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert orders" ON public.product_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update orders" ON public.product_orders FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete orders" ON public.product_orders FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view ambalaje orders" ON public.ambalaje_product_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert ambalaje orders" ON public.ambalaje_product_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update ambalaje orders" ON public.ambalaje_product_orders FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete ambalaje orders" ON public.ambalaje_product_orders FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view etichete orders" ON public.etichete_product_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert etichete orders" ON public.etichete_product_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update etichete orders" ON public.etichete_product_orders FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete etichete orders" ON public.etichete_product_orders FOR DELETE TO authenticated USING (true);

-- Add default_supplier_id to products tables for quick supplier lookup
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS default_supplier_id UUID REFERENCES public.suppliers(id);
ALTER TABLE public.ambalaje_products ADD COLUMN IF NOT EXISTS default_supplier_id UUID REFERENCES public.ambalaje_suppliers(id);
ALTER TABLE public.etichete_products ADD COLUMN IF NOT EXISTS default_supplier_id UUID REFERENCES public.etichete_suppliers(id);