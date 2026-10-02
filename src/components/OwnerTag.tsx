import { User } from "lucide-react";

import { useOwners } from "@/hooks/use-owners";
import { cn } from "@/lib/utils";

type Props = {
  ownerId?: string | null;
  className?: string;
  withIcon?: boolean;
  prefix?: string;
};

export function OwnerTag({ ownerId, className, withIcon = true, prefix }: Props) {
  const { ownerName } = useOwners();
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}>
      {withIcon && <User className="h-3 w-3 shrink-0" />}
      <span className="truncate">
        {prefix ? `${prefix} ` : ""}
        {ownerName(ownerId)}
      </span>
    </span>
  );
}
