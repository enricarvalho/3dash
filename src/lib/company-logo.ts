import { supabase } from "@/integrations/supabase/client";
import { validateImageFile } from "@/lib/image-upload";

const BUCKET = "company-logos";
const MAX_DIM = 600;

/** Logo pronta para o jsPDF (PNG em data URL + proporção). */
export type PdfLogo = { dataUrl: string; width: number; height: number };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível carregar a imagem"));
    img.src = src;
  });
}

/** Redimensiona para PNG (mantém transparência, formato aceito pelo jsPDF). */
function toPng(img: HTMLImageElement, maxDim: number) {
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function uploadCompanyLogo(file: File): Promise<string> {
  validateImageFile(file);
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("Sessão expirada");

  const objectUrl = URL.createObjectURL(file);
  let blob: Blob;
  try {
    const canvas = toPng(await loadImage(objectUrl), MAX_DIM);
    blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao converter a imagem"))), "image/png"),
    );
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  const path = `${uid}/logo-${crypto.randomUUID()}.png`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: "image/png", upsert: false });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function removeCompanyLogo(url: string): Promise<void> {
  const marker = `/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx < 0) return;
  await supabase.storage.from(BUCKET).remove([url.slice(idx + marker.length)]);
}

/** Baixa a logo e converte para data URL PNG, para embutir nos PDFs. */
export async function loadPdfLogo(url: string): Promise<PdfLogo> {
  const canvas = toPng(await loadImage(url), MAX_DIM);
  return { dataUrl: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height };
}
