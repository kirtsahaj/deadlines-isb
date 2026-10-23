ALTER TABLE public.job_events ALTER COLUMN state SET DEFAULT 'applying';
ALTER TABLE public.job_events ADD COLUMN IF NOT EXISTS claimed_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS job_files_event_sha_uidx ON public.job_files (event_id, sha256);