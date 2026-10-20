CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.push_subscriptions TO service_role;
REVOKE ALL ON public.push_subscriptions FROM anon, authenticated;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE INDEX push_subscriptions_user_idx ON public.push_subscriptions(user_id);

CREATE TABLE public.deadline_notifications (
  user_id uuid NOT NULL,
  deadline_id uuid NOT NULL,
  due_at timestamptz NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (deadline_id, due_at)
);
GRANT ALL ON public.deadline_notifications TO service_role;
REVOKE ALL ON public.deadline_notifications FROM anon, authenticated;
ALTER TABLE public.deadline_notifications ENABLE ROW LEVEL SECURITY;