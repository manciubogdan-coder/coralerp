CREATE TABLE public.argus_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  title text NOT NULL DEFAULT 'Conversație nouă',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.argus_threads TO service_role;
ALTER TABLE public.argus_threads ENABLE ROW LEVEL SECURITY;
CREATE INDEX argus_threads_user_idx ON public.argus_threads(user_id, updated_at DESC);

CREATE TABLE public.argus_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.argus_threads(id) ON DELETE CASCADE,
  sdk_id text,
  role text NOT NULL,
  message jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.argus_messages TO service_role;
ALTER TABLE public.argus_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX argus_messages_thread_idx ON public.argus_messages(thread_id, created_at);

CREATE TABLE public.argus_daily_summaries (
  day date PRIMARY KEY,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.argus_daily_summaries TO service_role;
ALTER TABLE public.argus_daily_summaries ENABLE ROW LEVEL SECURITY;