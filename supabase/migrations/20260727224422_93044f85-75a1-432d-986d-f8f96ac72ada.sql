
CREATE OR REPLACE FUNCTION public.on_new_support_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid;
  v_body text := left(COALESCE(NEW.body, '[imagem]'), 120);
  v_admin record;
BEGIN
  SELECT user_id INTO v_user FROM support_threads WHERE id = NEW.thread_id;
  IF NEW.is_admin THEN
    UPDATE support_threads SET
      last_message = v_body, last_message_at = NEW.created_at,
      user_unread = user_unread + 1, updated_at = now()
    WHERE id = NEW.thread_id;
    IF v_user IS NOT NULL AND NEW.sender_id IS DISTINCT FROM v_user THEN
      INSERT INTO notifications (user_id, type, title, body, link)
      VALUES (v_user, 'support', 'Nova resposta do suporte', v_body, '/suporte');
    END IF;
  ELSE
    UPDATE support_threads SET
      last_message = v_body, last_message_at = NEW.created_at,
      admin_unread = admin_unread + 1, updated_at = now()
    WHERE id = NEW.thread_id;
    -- Notify every admin about the incoming support message
    FOR v_admin IN
      SELECT ur.user_id FROM user_roles ur WHERE ur.role = 'admin'
    LOOP
      IF v_admin.user_id IS DISTINCT FROM NEW.sender_id THEN
        INSERT INTO notifications (user_id, type, title, body, link)
        VALUES (v_admin.user_id, 'support', 'Nova mensagem no suporte', v_body, '/admin/conversas');
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END; $$;
