ALTER TABLE public.jobs ADD COLUMN field_sent_at jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.job_events ADD COLUMN company_key text NOT NULL DEFAULT '';
CREATE INDEX job_events_company_key_idx ON public.job_events (company_key);