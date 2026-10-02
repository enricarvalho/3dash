import logo from "@/assets/logo-branca.png.asset.json";
import { cn } from "@/lib/utils";

/** Full white lockup (symbol + wordmark) on transparent background. */
export function Logo({ className }: { className?: string }) {
  return (
    <img
      src={logo.url}
      alt="3D Create"
      width={1606}
      height={518}
      className={cn("h-6 w-auto shrink-0 object-contain sm:h-7 md:h-8", className)}
    />
  );
}