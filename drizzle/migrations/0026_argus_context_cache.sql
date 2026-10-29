CREATE TABLE public.argus_context_cache (
 thread_id uuid PRIMARY KEY REFERENCES public.argus_threads(id) ON DELETE CASCADE,
 user_id uuid NOT NULL,
 prefix_hash text NOT NULL,
 summary text NOT NULL,
 covered_messages integer NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.argus_context_cache TO service_role;
REVOKE ALL ON public.argus_context_cache FROM anon, authenticated;
ALTER TABLE public.argus_context_cache ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.argus_attachment_summaries (
 thread_id uuid NOT NULL REFERENCES public.argus_threads(id) ON DELETE CASCADE,
 user_id uuid NOT NULL,
 reference text NOT NULL,
 summary text NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(thread_id, reference)
);
GRANT ALL ON public.argus_attachment_summaries TO service_role;
REVOKE ALL ON public.argus_attachment_summaries FROM anon, authenticated;
ALTER TABLE public.argus_attachment_summaries ENABLE ROW LEVEL SECURITY;