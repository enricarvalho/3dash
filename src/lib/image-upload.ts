import { supabase } from "@/integrations/supabase/client";

const BUCKET = "part-images";
const MAX_DIM = 1600;
const THUMB_DIM = 400;
const QUALITY = 0.85;
const THUMB_QUALITY = 0.8;
export const MAX_FILE_MB = 8;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp"];
const ACCEPTED_EXT = /\.(jpe?g|png|webp|gif|bmp)$/i;
export const ACCEPT_ATTR = ACCEPTED_TYPES.join(",");

export function validateImageFile(file: File): void {
  const typeOk = file.type ? ACCEPTED_TYPES.includes(file.type) : ACCEPTED_EXT.test(file.name);
  if (!typeOk) {
    throw new Error("Formato inválido. Use JPG, PNG, WebP, GIF ou BMP.");
  }
  if (file.size === 0) {
    throw new Error("Arquivo vazio ou corrompido.");
  }
  if (file.size > MAX_FILE_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    throw new Error(`Imagem muito grande (${mb} MB). Limite: ${MAX_FILE_MB} MB.`);
  }
}

export type UploadStage = "reading" | "converting" | "uploading" | "done";
export interface UploadProgress {
  stage: UploadStage;
  percent: number;
  label: string;
}
export type ProgressCallback = (p: UploadProgress) => void;

const STAGE_LABEL: Record<UploadStage, string> = {
  reading: "Lendo arquivo",
  converting: "Convertendo para WebP",
  uploading: "Enviando imagem",
  done: "Concluído",
};

function emit(cb: ProgressCallback | undefined, stage: UploadStage, percent: number) {
  cb?.({ stage, percent: Math.max(0, Math.min(100, Math.round(percent))), label: STAGE_LABEL[stage] });
}

async function loadImage(file: File, onProgress?: ProgressCallback): Promise<HTMLImageElement> {
  emit(onProgress, "reading", 0);
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onprogress = (e) => {
      if (e.lengthComputable) emit(onProgress, "reading", (e.loaded / e.total) * 100);
    };
    r.onload = () => {
      emit(onProgress, "reading", 100);
      resolve(r.result as string);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Não foi possível carregar a imagem"));
    i.src = dataUrl;
  });
}

function renderWebp(img: HTMLImageElement, maxDim: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas indisponível"));
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao converter para WebP"))),
      "image/webp",
      quality,
    ),
  );
}

export function thumbPathFor(path: string | null | undefined): string {
  if (!path) return "";
  return path.replace(/\.webp$/i, "_thumb.webp");
}

export async function uploadPartImage(file: File, onProgress?: ProgressCallback): Promise<string> {
  validateImageFile(file);
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("Sessão expirada");

  const img = await loadImage(file, onProgress);
  emit(onProgress, "converting", 20);
  const full = await renderWebp(img, MAX_DIM, QUALITY);
  emit(onProgress, "converting", 70);
  const thumb = await renderWebp(img, THUMB_DIM, THUMB_QUALITY);
  emit(onProgress, "converting", 100);

  const id = crypto.randomUUID();
  const path = `${uid}/${id}.webp`;
  const thumbPath = `${uid}/${id}_thumb.webp`;

  emit(onProgress, "uploading", 10);
  let pct = 10;
  const timer = setInterval(() => {
    pct = Math.min(90, pct + 8);
    emit(onProgress, "uploading", pct);
  }, 200);
  try {
    const [mainRes, thumbRes] = await Promise.all([
      supabase.storage.from(BUCKET).upload(path, full, { contentType: "image/webp", upsert: false }),
      supabase.storage.from(BUCKET).upload(thumbPath, thumb, { contentType: "image/webp", upsert: false }),
    ]);
    if (mainRes.error) throw mainRes.error;
    if (thumbRes.error) {
      // thumb is optional; clean the main to avoid orphans if the thumb failed hard
      // but keep going — PartImage can fall back to the full image.
      console.warn("Thumb upload failed, using full image as fallback", thumbRes.error);
    }
  } finally {
    clearInterval(timer);
  }
  emit(onProgress, "uploading", 100);
  emit(onProgress, "done", 100);
  return path;
}

export async function removePartImage(path: string): Promise<void> {
  if (!path || /^https?:\/\//i.test(path)) return;
  const paths = [path];
  const thumb = thumbPathFor(path);
  if (thumb && thumb !== path) paths.push(thumb);
  await supabase.storage.from(BUCKET).remove(paths);
}

export async function getPartImageUrl(pathOrUrl: string): Promise<string> {
  if (!pathOrUrl) return "";
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(pathOrUrl, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}
