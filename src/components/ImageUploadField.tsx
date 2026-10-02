import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { PartImage } from "@/components/PartImage";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ACCEPT_ATTR,
  removePartImage,
  uploadPartImage,
  validateImageFile,
  type UploadProgress,
} from "@/lib/image-upload";
import { cn } from "@/lib/utils";

type Props = {
  value: string | null;
  onChange: (path: string | null) => void;
  label?: string;
  className?: string;
};

/** Campo de upload de imagem (foto do produto ou arte), com conversão para WebP. */
export function ImageUploadField({ value, onChange, label = "Imagem", className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    try {
      validateImageFile(file);
      const previous = value;
      const path = await uploadPartImage(file, (p) => setProgress(p));
      onChange(path);
      if (previous) await removePartImage(previous).catch(() => undefined);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {value ? (
        <div className="flex items-center gap-3">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-muted">
            <PartImage src={value} alt={label} variant="thumb" className="h-full w-full object-cover" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
              Trocar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={async () => {
                const previous = value;
                onChange(null);
                if (previous) await removePartImage(previous).catch(() => undefined);
              }}
            >
              <X className="h-4 w-4" /> Remover
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full justify-center border-dashed"
          disabled={!!progress}
          onClick={() => inputRef.current?.click()}
        >
          {progress ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImagePlus className="h-4 w-4" />
          )}
          {progress ? progress.label : `${label}: enviar foto ou arte`}
        </Button>
      )}
      {progress && <Progress value={progress.percent} className="h-1.5" />}
    </div>
  );
}
