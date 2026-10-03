CREATE POLICY "Service role manages packaging methods"
ON public.packaging_methods
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);