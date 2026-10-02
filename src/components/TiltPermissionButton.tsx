import { useDeviceTilt } from "@/hooks/use-device-tilt";

/** Botão discreto — só aparece no iOS, onde o giroscópio exige permissão explícita. */
export function TiltPermissionButton({ className = "" }: { className?: string }) {
  const { needsPermission, enable } = useDeviceTilt();
  if (!needsPermission) return null;

  return (
    <button
      type="button"
      onClick={() => void enable()}
      className={`inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs text-white/70 transition-colors hover:border-white/40 hover:text-white ${className}`}
    >
      <span aria-hidden className="brand-gradient size-2 rounded-full" />
      Ativar efeito 3D
    </button>
  );
}
