DROP POLICY IF EXISTS "ggn_codes writable by authenticated" ON public.ggn_codes;
DROP POLICY IF EXISTS "ggn_codes updatable by authenticated" ON public.ggn_codes;
DROP POLICY IF EXISTS "ggn_codes deletable by authenticated" ON public.ggn_codes;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ggn_codes TO anon;

CREATE POLICY "Anyone can insert ggn codes" ON public.ggn_codes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update ggn codes" ON public.ggn_codes FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete ggn codes" ON public.ggn_codes FOR DELETE USING (true);