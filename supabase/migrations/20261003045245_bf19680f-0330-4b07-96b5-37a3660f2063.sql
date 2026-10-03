GRANT SELECT ON public.packaging_methods TO anon;

CREATE POLICY "Public can view packaging methods"
ON public.packaging_methods
FOR SELECT
TO anon
USING (true);