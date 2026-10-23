CREATE TABLE public.job_inbound_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_email_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'received',
  reason text,
  subject text,
  original_message_id text,
  original_sent_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
GRANT ALL ON public.job_inbound_messages TO service_role;
ALTER TABLE public.job_inbound_messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company text NOT NULL,
  role text NOT NULL,
  company_key text NOT NULL,
  role_keys text[] NOT NULL DEFAULT '{}',
  role_aliases text[] NOT NULL DEFAULT '{}',
  deadline_date date,
  deadline_time text,
  deadline_at timestamptz,
  shortlist_date date,
  jd_file_id uuid,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_email_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX jobs_company_key_idx ON public.jobs (company_key);
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.job_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inbound_id uuid NOT NULL,
  original_key text NOT NULL UNIQUE,
  kind text NOT NULL,
  company text NOT NULL,
  role text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz NOT NULL,
  job_id uuid,
  state text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX job_events_pending_idx ON public.job_events (state) WHERE state = 'pending';
GRANT ALL ON public.job_events TO service_role;
ALTER TABLE public.job_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.job_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid,
  event_id uuid,
  storage_path text NOT NULL,
  sha256 text NOT NULL,
  filename text NOT NULL,
  mime text NOT NULL,
  size_bytes integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX job_files_job_idx ON public.job_files (job_id);
GRANT ALL ON public.job_files TO service_role;
ALTER TABLE public.job_files ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.job_stars (
  user_id uuid NOT NULL,
  job_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);
GRANT SELECT, INSERT, DELETE ON public.job_stars TO authenticated;
GRANT ALL ON public.job_stars TO service_role;
ALTER TABLE public.job_stars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own stars read" ON public.job_stars FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own stars add" ON public.job_stars FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own stars remove" ON public.job_stars FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.job_reminders (
  user_id uuid NOT NULL,
  job_id uuid NOT NULL,
  due_at timestamptz NOT NULL,
  offset_hours integer NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id, due_at, offset_hours)
);
GRANT ALL ON public.job_reminders TO service_role;
ALTER TABLE public.job_reminders ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_settings ADD COLUMN job_reminders boolean NOT NULL DEFAULT true;