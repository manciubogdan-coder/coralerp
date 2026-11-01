ALTER TABLE public.huse_paleti_miscari
  ADD COLUMN IF NOT EXISTS functie text,
  ADD COLUMN IF NOT EXISTS nr_remorca text,
  ADD COLUMN IF NOT EXISTS client text,
  ADD COLUMN IF NOT EXISTS cursa text,
  ADD COLUMN IF NOT EXISTS sofer text,
  ADD COLUMN IF NOT EXISTS poza_path text;
CREATE POLICY "huse poze read" ON storage.objects FOR SELECT USING (bucket_id = 'huse-poze');
CREATE POLICY "huse poze insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'huse-poze');