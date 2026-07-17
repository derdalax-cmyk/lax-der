
-- Etapa 5: novos estados de produto (adicionar valores ao enum existente)
ALTER TYPE public.product_status ADD VALUE IF NOT EXISTS 'out_of_stock';
ALTER TYPE public.product_status ADD VALUE IF NOT EXISTS 'inactive';

-- Etapa 5: campos de stock para produtos sem variações
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock integer NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock_alert integer NOT NULL DEFAULT 5;

-- Etapa 2: divisão de pedidos entre vendedores
CREATE TABLE IF NOT EXISTS public.order_sellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  subtotal numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  tracking_code text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, seller_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_sellers TO authenticated;
GRANT ALL ON public.order_sellers TO service_role;

ALTER TABLE public.order_sellers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Seller can view own order parts" ON public.order_sellers
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR seller_id = public.current_seller_id()
  );

CREATE POLICY "Seller can update own order parts" ON public.order_sellers
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR seller_id = public.current_seller_id()
  );

CREATE POLICY "Admin manages order parts" ON public.order_sellers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_order_sellers_updated_at
  BEFORE UPDATE ON public.order_sellers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger que popula/atualiza a parte do vendedor sempre que se insere um item de pedido
CREATE OR REPLACE FUNCTION public.sync_order_seller_part()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_seller uuid;
BEGIN
  SELECT seller_id INTO v_seller FROM public.products WHERE id = NEW.product_id;
  IF v_seller IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.order_sellers (order_id, seller_id, subtotal)
    VALUES (NEW.order_id, v_seller, NEW.price * NEW.quantity)
    ON CONFLICT (order_id, seller_id)
    DO UPDATE SET subtotal = public.order_sellers.subtotal + EXCLUDED.subtotal, updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_order_seller ON public.order_items;
CREATE TRIGGER trg_sync_order_seller
  AFTER INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.sync_order_seller_part();

-- Preencher order_sellers a partir de itens existentes
INSERT INTO public.order_sellers (order_id, seller_id, subtotal)
SELECT oi.order_id, p.seller_id, sum(oi.price * oi.quantity)
FROM public.order_items oi
JOIN public.products p ON p.id = oi.product_id
WHERE p.seller_id IS NOT NULL
GROUP BY oi.order_id, p.seller_id
ON CONFLICT (order_id, seller_id) DO NOTHING;

-- Função para o vendedor atualizar o estado da sua parte do pedido
CREATE OR REPLACE FUNCTION public.set_order_seller_status(
  _order_id uuid,
  _status text,
  _tracking text DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_seller uuid := public.current_seller_id();
BEGIN
  IF v_seller IS NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  IF _status NOT IN ('pending','processing','sent','delivered','cancelled') THEN
    RAISE EXCEPTION 'Estado inválido';
  END IF;
  UPDATE public.order_sellers
     SET status = _status,
         tracking_code = COALESCE(_tracking, tracking_code),
         notes = COALESCE(_notes, notes),
         updated_at = now()
   WHERE order_id = _order_id
     AND (public.has_role(auth.uid(), 'admin') OR seller_id = v_seller);
END;
$$;
