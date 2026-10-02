import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  getSearchConsoleStatus,
  querySearchConsole,
  inspectSearchConsoleUrl,
  type SearchAnalyticsRow,
} from "@/lib/search-console.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/search-console")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      queryKey: ["search-console", "status"],
      queryFn: () => getSearchConsoleStatus(),
    });
  },
  head: () => ({
    meta: [
      { title: "Search Console | 3D Create" },
      {
        name: "description",
        content: "Dashboard do Google Search Console da 3D Create.",
      },
      { property: "og:title", content: "Search Console | 3D Create" },
      {
        property: "og:description",
        content: "Dashboard do Google Search Console da 3D Create.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://3dcreate.com.br/search-console" }],
  }),
  component: SearchConsolePage,
});

function SearchConsolePage() {
  const { data: status } = useSuspenseQuery({
    queryKey: ["search-console", "status"],
    queryFn: () => getSearchConsoleStatus(),
  });

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <header className="mb-10">
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Google Search Console
          </h1>
          <p className="mt-2 text-muted-foreground">
            Acompanhe indexação, cobertura e consultas sobre “impressão 3D em Goiânia”.
          </p>
        </header>

        {status.status === "selection_required" ? (
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-display text-lg font-semibold">Selecione a propriedade</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Várias propriedades do Search Console cobrem este site. Escolha uma para continuar:
            </p>
            <ul className="mt-4 space-y-2">
              {status.candidates.map((candidate) => (
                <li key={candidate}>
                  <code className="rounded bg-muted px-2 py-1 text-sm">{candidate}</code>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="space-y-8">
            <StatusCards status={status} />
            <AnalyticsPanel />
            <UrlInspector />
          </div>
        )}
      </div>
    </main>
  );
}

function StatusCards({ status }: { status: Awaited<ReturnType<typeof getSearchConsoleStatus>> }) {
  if (status.status !== "ok") return null;

  const sitemap = status.sitemaps.sitemap?.[0];
  const inspection = status.homepageInspection.inspectionResult;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card title="Propriedade">
        <p className="text-sm text-muted-foreground">Propriedade verificada</p>
        <p className="mt-1 font-medium break-all">{status.siteUrl}</p>
      </Card>

      <Card title="Sitemap">
        {sitemap ? (
          <>
            <p className="text-sm text-muted-foreground">
              Submetido em {new Date(sitemap.lastSubmitted).toLocaleString("pt-BR")}
            </p>
            <p className="mt-2 text-sm">
              <span className="font-medium">{sitemap.contents?.[0]?.submitted ?? "0"}</span>{" "}
              URLs enviadas
              {" · "}
              <span className="font-medium">{sitemap.contents?.[0]?.indexed ?? "0"}</span>{" "}
              indexadas
            </p>
            {Number(sitemap.errors) > 0 && (
              <p className="mt-1 text-sm text-destructive">{sitemap.errors} erro(s)</p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum sitemap submetido.</p>
        )}
      </Card>

      <Card title="Homepage">
        {inspection ? (
          <>
            <p className="text-sm text-muted-foreground">Status de indexação</p>
            <p className="mt-1 font-medium">{inspection.indexStatusResult.coverageState}</p>
            <a
              href={inspection.inspectionResultLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center text-sm font-medium text-primary hover:underline"
            >
              Ver no Search Console →
            </a>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Dados de inspeção indisponíveis.</p>
        )}
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function AnalyticsPanel() {
  const queryFn = useServerFn(querySearchConsole);
  const [dimension, setDimension] = useState<"query" | "page" | "device" | "country" | "date">(
    "query",
  );
  const [days, setDays] = useState(28);

  const end = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data, isLoading, error } = useSuspenseQuery({
    queryKey: ["search-console", "analytics", dimension, start, end],
    queryFn: () =>
      queryFn({
        data: {
          targetUrl: "https://3dcreate.com.br/",
          startDate: start,
          endDate: end,
          dimensions: [dimension],
          rowLimit: 50,
        },
      }),
  });

  const rows = data?.analytics?.rows ?? [];
  const totals = rows.reduce(
    (acc, row) => ({
      clicks: acc.clicks + row.clicks,
      impressions: acc.impressions + row.impressions,
    }),
    { clicks: 0, impressions: 0 },
  );

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold">Desempenho na busca</h2>
          <p className="text-sm text-muted-foreground">
            {new Date(start).toLocaleDateString("pt-BR")} —{" "}
            {new Date(end).toLocaleDateString("pt-BR")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value={7}>Últimos 7 dias</option>
            <option value={28}>Últimos 28 dias</option>
            <option value={90}>Últimos 90 dias</option>
          </select>
          <select
            value={dimension}
            onChange={(e) => setDimension(e.target.value as typeof dimension)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="query">Por consulta</option>
            <option value="page">Por página</option>
            <option value="device">Por dispositivo</option>
            <option value="country">Por país</option>
            <option value="date">Por data</option>
          </select>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Metric label="Cliques" value={totals.clicks} />
        <Metric label="Impressões" value={totals.impressions} />
        <Metric
          label="CTR médio"
          value={
            totals.impressions > 0
              ? `${((totals.clicks / totals.impressions) * 100).toFixed(1)}%`
              : "0.0%"
          }
        />
      </div>

      {isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Carregando...</p>
      ) : error ? (
        <p className="mt-6 text-sm text-destructive">
          Erro ao carregar dados: {error instanceof Error ? error.message : "desconhecido"}
        </p>
      ) : rows.length === 0 ? (
        <div className="mt-6 rounded-lg bg-muted p-4">
          <p className="text-sm text-muted-foreground">
            Ainda não há dados de consultas no período. Isso é normal para sites recém-submetidos —
            o Google pode levar alguns dias para começar a exibir estatísticas.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-4 font-medium">
                  {dimension === "query" && "Consulta"}
                  {dimension === "page" && "Página"}
                  {dimension === "device" && "Dispositivo"}
                  {dimension === "country" && "País"}
                  {dimension === "date" && "Data"}
                </th>
                <th className="py-2 pr-4 font-medium">Cliques</th>
                <th className="py-2 pr-4 font-medium">Impressões</th>
                <th className="py-2 pr-4 font-medium">CTR</th>
                <th className="py-2 font-medium">Posição média</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className="border-b border-border/50">
                  <td className="py-3 pr-4 font-medium">{row.keys.join(", ")}</td>
                  <td className="py-3 pr-4">{row.clicks}</td>
                  <td className="py-3 pr-4">{row.impressions.toLocaleString("pt-BR")}</td>
                  <td className="py-3 pr-4">{(row.ctr * 100).toFixed(1)}%</td>
                  <td className="py-3">{row.position.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-muted p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">
        {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
      </p>
    </div>
  );
}

function UrlInspector() {
  const inspectFn = useServerFn(inspectSearchConsoleUrl);
  const [url, setUrl] = useState("https://3dcreate.com.br/");
  const [result, setResult] = useState<Awaited<ReturnType<typeof inspectSearchConsoleUrl>> | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await inspectFn({ data: { inspectionUrl: url } });
      setResult(res);
    } catch (err) {
      setResult({
        status: "ok",
        siteUrl: "",
        inspection: {
          inspectionResult: {
            inspectionResultLink: "",
            indexStatusResult: {
              verdict: "ERROR",
              coverageState: err instanceof Error ? err.message : "Erro desconhecido",
              robotsTxtState: "ROBOTS_TXT_STATE_UNSPECIFIED",
              indexingState: "INDEXING_STATE_UNSPECIFIED",
              pageFetchState: "PAGE_FETCH_STATE_UNSPECIFIED",
            },
            mobileUsabilityResult: { verdict: "VERDICT_UNSPECIFIED" },
          },
        },
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="font-display text-xl font-semibold">Inspeção de URL</h2>
      <p className="text-sm text-muted-foreground">
        Verifique o status de indexação de uma página específica.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="https://3dcreate.com.br/..."
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {loading ? "Inspecionando..." : "Inspecionar"}
        </button>
      </form>

      {result?.inspection?.inspectionResult && (
        <div className="mt-6 rounded-lg bg-muted p-4">
          <p className="text-sm text-muted-foreground">Status de indexação</p>
          <p className="mt-1 font-medium">
            {result.inspection.inspectionResult.indexStatusResult.coverageState}
          </p>
          {result.inspection.inspectionResult.inspectionResultLink && (
            <a
              href={result.inspection.inspectionResult.inspectionResultLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center text-sm font-medium text-primary hover:underline"
            >
              Ver detalhes no Search Console →
            </a>
          )}
        </div>
      )}
    </section>
  );
}
