DROP POLICY IF EXISTS "Users create own review after purchase" ON public.seller_reviews;
CREATE POLICY "Users create own review after purchase"
ON public.seller_reviews FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND order_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.orders o
     WHERE o.id = seller_reviews.order_id
       AND o.user_id = auth.uid()
       AND o.status <> 'cancelled'
       AND (
         EXISTS (
           SELECT 1 FROM public.order_items oi
            WHERE oi.order_id = o.id AND oi.seller_id = seller_reviews.seller_id
         )
         OR EXISTS (
           SELECT 1 FROM public.order_sellers os
            WHERE os.order_id = o.id AND os.seller_id = seller_reviews.seller_id
         )
       )
  )
);