ALTER TABLE public.sale_audit_log DROP CONSTRAINT IF EXISTS sale_audit_log_sale_id_fkey;
ALTER TABLE public.sale_audit_log ADD COLUMN IF NOT EXISTS sale_label text;