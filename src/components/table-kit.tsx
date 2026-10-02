import { useMemo, useState } from "react";
import { ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export function useTableState<T>(rows: T[], searchFields: (row: T) => string, pageSize = 10) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [asc, setAsc] = useState(true);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let out = term ? rows.filter((r) => searchFields(r).toLowerCase().includes(term)) : [...rows];
    if (sortKey) {
      out = out.sort((a, b) => {
        const av = a[sortKey] as unknown;
        const bv = b[sortKey] as unknown;
        if (typeof av === "number" && typeof bv === "number") return asc ? av - bv : bv - av;
        return asc
          ? String(av ?? "").localeCompare(String(bv ?? ""), "pt-BR")
          : String(bv ?? "").localeCompare(String(av ?? ""), "pt-BR");
      });
    }
    return out;
  }, [rows, search, searchFields, sortKey, asc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, totalPages);
  const paged = filtered.slice((current - 1) * pageSize, current * pageSize);

  const toggleSort = (key: keyof T) => {
    if (sortKey === key) setAsc(!asc);
    else {
      setSortKey(key);
      setAsc(true);
    }
  };

  return {
    search,
    setSearch: (v: string) => {
      setSearch(v);
      setPage(1);
    },
    paged,
    filtered,
    page: current,
    totalPages,
    setPage,
    toggleSort,
    sortKey,
  };
}

export function SortButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
      type="button"
    >
      {label}
      <ArrowUpDown className="h-3 w-3 opacity-50" />
    </button>
  );
}

export function Pager({
  page,
  totalPages,
  setPage,
  total,
}: {
  page: number;
  totalPages: number;
  setPage: (n: number) => void;
  total: number;
}) {
  return (
    <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
      <span>
        {total} registro{total === 1 ? "" : "s"} · página {page} de {totalPages}
      </span>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
