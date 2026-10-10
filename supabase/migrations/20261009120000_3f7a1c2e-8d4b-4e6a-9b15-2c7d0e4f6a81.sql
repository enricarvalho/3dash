-- Logo da empresa (Configurações): exibida na sidebar, nos orçamentos/relatórios impressos e nos PDFs.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS logo_url text;

-- Bucket público: a logo precisa carregar no <img> e ser embutida nos PDFs sem URL assinada.
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "company logos read" ON storage.objects;
DROP POLICY IF EXISTS "own company logo insert" ON storage.objects;
DROP POLICY IF EXISTS "own company logo update" ON storage.objects;
DROP POLICY IF EXISTS "own company logo delete" ON storage.objects;

CREATE POLICY "company logos read" ON storage.objects FOR SELECT
  USING (bucket_id = 'company-logos');
CREATE POLICY "own company logo insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-logos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own company logo update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'company-logos' AND owner = auth.uid());
CREATE POLICY "own company logo delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'company-logos' AND owner = auth.uid());

NOTIFY pgrst, 'reload schema';
