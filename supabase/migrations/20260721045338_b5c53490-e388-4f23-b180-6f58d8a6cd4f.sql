GRANT SELECT, INSERT, UPDATE, DELETE ON public.productie_grupare_ambalare TO anon;
DROP POLICY IF EXISTS "auth read grupare" ON public.productie_grupare_ambalare;
DROP POLICY IF EXISTS "auth write grupare" ON public.productie_grupare_ambalare;
CREATE POLICY "public read grupare" ON public.productie_grupare_ambalare FOR SELECT USING (true);
CREATE POLICY "public write grupare" ON public.productie_grupare_ambalare FOR ALL USING (true) WITH CHECK (true);