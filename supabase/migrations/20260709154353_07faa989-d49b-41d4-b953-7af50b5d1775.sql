CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_created ON public.notifications (user_id, created_at DESC);

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Realtime
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- New order -> notify seller (once per order per seller)
CREATE OR REPLACE FUNCTION public.notify_seller_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller uuid;
  v_user uuid;
  v_customer text;
BEGIN
  SELECT seller_id INTO v_seller FROM products WHERE id = NEW.product_id;
  IF v_seller IS NULL THEN RETURN NEW; END IF;
  SELECT user_id INTO v_user FROM sellers WHERE id = v_seller;
  IF v_user IS NULL THEN RETURN NEW; END IF;
  IF EXISTS (
    SELECT 1 FROM notifications
    WHERE user_id = v_user AND type = 'order' AND (data->>'order_id') = NEW.order_id::text
  ) THEN
    RETURN NEW;
  END IF;
  SELECT customer_name INTO v_customer FROM orders WHERE id = NEW.order_id;
  INSERT INTO notifications (user_id, type, title, body, link, data)
  VALUES (
    v_user, 'order', 'Novo pedido recebido',
    COALESCE(v_customer, 'Um cliente') || ' fez um pedido com os seus produtos.',
    '/vendedor/pedidos',
    jsonb_build_object('order_id', NEW.order_id)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_seller_new_order
AFTER INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.notify_seller_new_order();

-- Product approval status change -> notify seller
CREATE OR REPLACE FUNCTION public.notify_seller_product_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_user uuid;
BEGIN
  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status
     AND NEW.approval_status IN ('approved','rejected')
     AND NEW.seller_id IS NOT NULL THEN
    SELECT user_id INTO v_user FROM sellers WHERE id = NEW.seller_id;
    IF v_user IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, body, link, data)
      VALUES (
        v_user,
        CASE WHEN NEW.approval_status = 'approved' THEN 'product_approved' ELSE 'product_rejected' END,
        CASE WHEN NEW.approval_status = 'approved' THEN 'Produto aprovado' ELSE 'Produto rejeitado' END,
        NEW.title || CASE WHEN NEW.approval_status = 'approved'
          THEN ' foi aprovado e já está publicado.'
          ELSE ' não foi aprovado pela administração.' END,
        '/vendedor/produtos',
        jsonb_build_object('product_id', NEW.id)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_seller_product_status
AFTER UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.notify_seller_product_status();

-- Featured collection candidacy status change -> notify seller
CREATE OR REPLACE FUNCTION public.notify_seller_featured_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_col text;
  v_prod text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('approved','rejected')
     AND NEW.submitted_by IS NOT NULL THEN
    SELECT user_id INTO v_user FROM sellers WHERE id = NEW.submitted_by;
    IF v_user IS NOT NULL THEN
      SELECT name INTO v_col FROM featured_collections WHERE id = NEW.collection_id;
      SELECT title INTO v_prod FROM products WHERE id = NEW.product_id;
      INSERT INTO notifications (user_id, type, title, body, link, data)
      VALUES (
        v_user,
        CASE WHEN NEW.status = 'approved' THEN 'featured_approved' ELSE 'featured_rejected' END,
        CASE WHEN NEW.status = 'approved' THEN 'Candidatura de destaque aprovada' ELSE 'Candidatura de destaque rejeitada' END,
        COALESCE(v_prod, 'O seu produto') || ' · ' || COALESCE(v_col, 'Destaque'),
        '/vendedor/destaques',
        jsonb_build_object('collection_id', NEW.collection_id, 'product_id', NEW.product_id)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_seller_featured_status
AFTER UPDATE ON public.featured_collection_products
FOR EACH ROW EXECUTE FUNCTION public.notify_seller_featured_status();