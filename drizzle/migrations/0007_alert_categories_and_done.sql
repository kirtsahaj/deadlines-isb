ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS deadline_reminders boolean NOT NULL DEFAULT true;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS class_reminders boolean NOT NULL DEFAULT true;

-- Items a student ticked as done on Assignments. Keys are the item's stable identities
-- (elearn:<activity key> and/or outline occurrence id), so a tick survives connecting eLearn.
CREATE TABLE IF NOT EXISTS public.deadline_done (
  user_id uuid NOT NULL,
  item_key text NOT NULL,
  done_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_key)
);
GRANT SELECT, INSERT, DELETE ON public.deadline_done TO authenticated;
GRANT ALL ON public.deadline_done TO service_role;
ALTER TABLE public.deadline_done ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deadline_done_select_own ON public.deadline_done;
CREATE POLICY deadline_done_select_own ON public.deadline_done FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id AND public.is_allowed_isb_user());
DROP POLICY IF EXISTS deadline_done_insert_own ON public.deadline_done;
CREATE POLICY deadline_done_insert_own ON public.deadline_done FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id AND public.is_allowed_isb_user());
DROP POLICY IF EXISTS deadline_done_delete_own ON public.deadline_done;
CREATE POLICY deadline_done_delete_own ON public.deadline_done FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id AND public.is_allowed_isb_user());
