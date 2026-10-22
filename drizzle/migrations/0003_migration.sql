CREATE TABLE public.term5_enrollment_overrides (
  user_id uuid NOT NULL,
  course_code text NOT NULL,
  section_id text,
  removed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, course_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.term5_enrollment_overrides TO authenticated;
GRANT ALL ON public.term5_enrollment_overrides TO service_role;
ALTER TABLE public.term5_enrollment_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY t5_overrides_select_own ON public.term5_enrollment_overrides FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id AND public.is_allowed_isb_user());
CREATE POLICY t5_overrides_insert_own ON public.term5_enrollment_overrides FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id AND public.is_allowed_isb_user());
CREATE POLICY t5_overrides_update_own ON public.term5_enrollment_overrides FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id AND public.is_allowed_isb_user())
  WITH CHECK ((SELECT auth.uid()) = user_id AND public.is_allowed_isb_user());
CREATE POLICY t5_overrides_delete_own ON public.term5_enrollment_overrides FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id AND public.is_allowed_isb_user());

-- Shared, non-personal section deadline pool. No user identifiers stored.
CREATE TABLE public.term5_shared_deadlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_code text NOT NULL,
  source_key text NOT NULL,
  contributor_section text NOT NULL,
  section_hint text,
  kind text NOT NULL,
  deadline_type text NOT NULL,
  title text NOT NULL,
  due_at timestamptz,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_confirmed_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  UNIQUE (course_code, source_key, contributor_section)
);
GRANT ALL ON public.term5_shared_deadlines TO service_role;
ALTER TABLE public.term5_shared_deadlines ENABLE ROW LEVEL SECURITY;