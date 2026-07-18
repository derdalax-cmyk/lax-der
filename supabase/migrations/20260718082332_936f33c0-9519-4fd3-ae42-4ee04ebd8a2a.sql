-- Notify buyer when a seller updates the order status for their portion
CREATE OR REPLACE FUNCTION public.notify_buyer_order_seller_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer uuid;
  v_store text;
  v_label text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO v_buyer FROM public.orders WHERE id = NEW.order_id;
  IF v_buyer IS NULL THEN RETURN NEW; END IF;

  SELECT store_name INTO v_store FROM public.sellers WHERE id = NEW.seller_id;

  v_label := CASE NEW.status
    WHEN 'processing' THEN 'está a ser processado'
    WHEN 'sent' THEN 'foi enviado'
    WHEN 'delivered' THEN 'foi concluído com sucesso'
    WHEN 'cancelled' THEN 'foi rejeitado pela loja'
    ELSE 'foi atualizado'
  END;

  INSERT INTO public.notifications (user_id, type, title, body, link, data)
  VALUES (
    v_buyer,
    'order_status',
    'Atualização do seu pedido',
    'O seu pedido em ' || COALESCE(v_store, 'uma loja') || ' ' || v_label || '.',
    '/perfil/pedidos',
    jsonb_build_object('order_id', NEW.order_id, 'seller_id', NEW.seller_id, 'status', NEW.status)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_buyer_order_seller_status ON public.order_sellers;
CREATE TRIGGER trg_notify_buyer_order_seller_status
AFTER UPDATE ON public.order_sellers
FOR EACH ROW
EXECUTE FUNCTION public.notify_buyer_order_seller_status();