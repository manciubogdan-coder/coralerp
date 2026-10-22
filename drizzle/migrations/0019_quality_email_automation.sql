CREATE TABLE public.quality_email_settings (inventory_type text PRIMARY KEY CHECK (inventory_type IN ('materii-prime','ambalaje','etichete')), enabled boolean NOT NULL DEFAULT false, send_time text NOT NULL DEFAULT '17:00' CHECK (send_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'), day_offset integer NOT NULL DEFAULT 0 CHECK (day_offset IN (0,1)), activated_on date NOT NULL DEFAULT CURRENT_DATE, updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.quality_email_settings TO service_role;
ALTER TABLE public.quality_email_settings ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.quality_email_routes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), inventory_type text NOT NULL REFERENCES public.quality_email_settings(inventory_type), supplier_id text NOT NULL, supplier_name text NOT NULL, manufacturer_id text, manufacturer_name text, recipient_mode text NOT NULL DEFAULT 'supplier' CHECK (recipient_mode IN ('supplier','manufacturer')), recipient_email text NOT NULL, cc_emails jsonb NOT NULL DEFAULT '[]', language text NOT NULL DEFAULT 'en' CHECK (language IN ('ro','en','it')), version text NOT NULL DEFAULT 'v2' CHECK (version IN ('v1','v2')), enabled boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.quality_email_routes TO service_role;
ALTER TABLE public.quality_email_routes ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.quality_email_reviews (inventory_type text NOT NULL, inventory_id text NOT NULL, finalized boolean NOT NULL DEFAULT false, snapshot jsonb NOT NULL DEFAULT '{}', reviewed_by uuid, reviewed_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (inventory_type,inventory_id));
GRANT ALL ON public.quality_email_reviews TO service_role;
ALTER TABLE public.quality_email_reviews ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.quality_email_deliveries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), route_id uuid NOT NULL REFERENCES public.quality_email_routes(id), receipt_day date NOT NULL, status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','sending','sent','failed','uncertain')), message_id text, detail text, receipt_count integer NOT NULL DEFAULT 0, recipient_email text NOT NULL, cc_emails jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (route_id,receipt_day));
GRANT ALL ON public.quality_email_deliveries TO service_role;
ALTER TABLE public.quality_email_deliveries ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.quality_email_schedule(p_type text,p_time text,p_enabled boolean,p_url text,p_secret text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public,cron,net AS $$
DECLARE v_job bigint; v_hour integer; v_minute integer;
BEGIN
 IF p_type NOT IN ('materii-prime','ambalaje','etichete') OR p_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR p_url !~ '^https://[a-z]+\.supabase\.co/functions/v1/quality-emails$' OR length(p_secret)<32 THEN RAISE EXCEPTION 'Invalid scheduling configuration'; END IF;
 FOR v_job IN SELECT jobid FROM cron.job WHERE jobname='quality-email-'||p_type LOOP PERFORM cron.unschedule(v_job); END LOOP;
 IF p_enabled THEN
  v_hour:=split_part(p_time,':',1)::integer; v_minute:=split_part(p_time,':',2)::integer;
  PERFORM cron.schedule('quality-email-'||p_type, v_minute::text||' '||((v_hour+21)%24)::text||','||((v_hour+22)%24)::text||' * * *', format('SELECT net.http_post(url:=%L,headers:=jsonb_build_object(''Content-Type'',''application/json'',''x-quality-job'',%L),body:=%L::jsonb,timeout_milliseconds:=120000)',p_url,p_secret,jsonb_build_object('action','scheduled','inventory_type',p_type)::text));
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.quality_email_schedule(text,text,boolean,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.quality_email_schedule(text,text,boolean,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.quality_email_claim(p_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer;
BEGIN UPDATE public.quality_email_deliveries SET status='sending',updated_at=now(),detail=null WHERE id=p_id AND status IN ('waiting','failed'); GET DIAGNOSTICS n=ROW_COUNT; RETURN n=1; END $$;
REVOKE ALL ON FUNCTION public.quality_email_claim(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.quality_email_claim(uuid) TO service_role;