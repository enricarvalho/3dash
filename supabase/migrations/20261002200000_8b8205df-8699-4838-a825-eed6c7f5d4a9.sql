-- Bucket privado das imagens de peças (antes criado fora das migrações pelo Lovable).
INSERT INTO storage.buckets (id, name, public)
VALUES ('part-images', 'part-images', false)
ON CONFLICT (id) DO NOTHING;
