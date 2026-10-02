-- White label: perfis novos não herdam mais o nome da 3D Create.
ALTER TABLE public.profiles ALTER COLUMN company DROP DEFAULT;
UPDATE public.profiles SET company = NULL WHERE company = '3D Create';
