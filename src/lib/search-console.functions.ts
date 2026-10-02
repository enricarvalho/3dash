import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY = "https://connector-gateway.lovable.dev/google_search_console";

const GATEWAY_HEADERS = () => {
  const lovableApiKey = process.env["LOVABLE_API_KEY"];
  const connectionApiKey = process.env["GOOGLE_SEARCH_CONSOLE_API_KEY"];
  if (!lovableApiKey || !connectionApiKey) {
    throw new Error("Missing Search Console credentials");
  }
  return {
    Authorization: `Bearer ${lovableApiKey}`,
    "X-Connection-Api-Key": connectionApiKey,
  };
};

export type SiteEntry = {
  siteUrl: string;
  permissionLevel?: string;
};

export type SearchAnalyticsRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type UrlInspectionResult = {
  inspectionResultLink: string;
  indexStatusResult: {
    verdict: string;
    coverageState: string;
    robotsTxtState: string;
    indexingState: string;
    pageFetchState: string;
  };
  mobileUsabilityResult: {
    verdict: string;
  };
};

export type SiteResolution =
  | { status: "selected"; siteUrl: string }
  | { status: "selection_required"; candidates: string[] };

export function coversTarget(siteUrl: string, target: URL) {
  if (siteUrl.startsWith("sc-domain:")) {
    const domain = siteUrl.slice("sc-domain:".length).toLowerCase();
    const host = target.hostname.toLowerCase();
    return host === domain || host.endsWith(`.${domain}`);
  }
  try {
    const prefix = new URL(siteUrl);
    return target.href.startsWith(prefix.href);
  } catch {
    return false;
  }
}

async function resolveSiteUrl(
  targetUrl: string,
  selectedSiteUrl?: string,
): Promise<SiteResolution> {
  const response = await fetch(`${GATEWAY}/webmasters/v3/sites`, {
    headers: GATEWAY_HEADERS(),
  });
  if (!response.ok) {
    throw new Error(
      `Could not list properties [${response.status}]: ${await response.text()}`,
    );
  }
  const { siteEntry = [] } = (await response.json()) as {
    siteEntry?: SiteEntry[];
  };
  const target = new URL(targetUrl);
  const matches = siteEntry.filter(
    (entry) =>
      entry.permissionLevel !== "siteUnverifiedUser" &&
      coversTarget(entry.siteUrl, target),
  );
  if (selectedSiteUrl) {
    const selected = matches.find((entry) => entry.siteUrl === selectedSiteUrl);
    if (!selected) {
      throw new Error(
        "The selected Search Console property is not verified for this site",
      );
    }
    return { status: "selected", siteUrl: selected.siteUrl };
  }
  if (matches.length === 0) {
    throw new Error("No verified Search Console property covers this site");
  }
  if (matches.length === 1) {
    return { status: "selected", siteUrl: matches[0].siteUrl };
  }
  return {
    status: "selection_required",
    candidates: matches.map((entry) => entry.siteUrl),
  };
}

async function querySearchAnalytics(
  siteUrl: string,
  query: Record<string, unknown>,
) {
  const response = await fetch(
    `${GATEWAY}/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { ...GATEWAY_HEADERS(), "Content-Type": "application/json" },
      body: JSON.stringify(query),
    },
  );
  if (response.status === 403) {
    throw new Error(
      "The connected Google account cannot access the selected Search Console property",
    );
  }
  if (!response.ok) {
    throw new Error(
      `Search Console query failed [${response.status}]: ${await response.text()}`,
    );
  }
  return (await response.json()) as { rows?: SearchAnalyticsRow[] };
}

async function inspectUrl(siteUrl: string, inspectionUrl: string) {
  const response = await fetch(
    `${GATEWAY}/v1/urlInspection/index:inspect`,
    {
      method: "POST",
      headers: { ...GATEWAY_HEADERS(), "Content-Type": "application/json" },
      body: JSON.stringify({ inspectionUrl, siteUrl }),
    },
  );
  if (!response.ok) {
    throw new Error(
      `URL inspection failed [${response.status}]: ${await response.text()}`,
    );
  }
  return (await response.json()) as { inspectionResult?: UrlInspectionResult };
}

async function listSitemaps(siteUrl: string) {
  const response = await fetch(
    `${GATEWAY}/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps`,
    { headers: GATEWAY_HEADERS() },
  );
  if (!response.ok) {
    throw new Error(
      `Could not list sitemaps [${response.status}]: ${await response.text()}`,
    );
  }
  return (await response.json()) as {
    sitemap?: Array<{
      path: string;
      lastSubmitted: string;
      lastDownloaded: string;
      warnings: string;
      errors: string;
      contents?: Array<{ type: string; submitted: string; indexed: string }>;
    }>;
  };
}

const analyticsInputSchema = z.object({
  targetUrl: z.string().url().default("https://3dcreate.com.br/"),
  selectedSiteUrl: z.string().optional(),
  startDate: z.string().default("2026-06-01"),
  endDate: z.string().default(() => new Date().toISOString().slice(0, 10)),
  dimensions: z.array(z.enum(["query", "page", "device", "country", "date"])).default(["query"]),
  rowLimit: z.number().int().min(1).max(25000).default(50),
});

const inspectInputSchema = z.object({
  targetUrl: z.string().url().default("https://3dcreate.com.br/"),
  selectedSiteUrl: z.string().optional(),
  inspectionUrl: z.string().url().optional(),
});

export const getSearchConsoleStatus = createServerFn({ method: "GET" }).handler(
  async () => {
    const resolution = await resolveSiteUrl("https://3dcreate.com.br/");
    if (resolution.status === "selection_required") {
      return {
        status: "selection_required",
        candidates: resolution.candidates,
      };
    }
    const [sitemaps, homepageInspection] = await Promise.all([
      listSitemaps(resolution.siteUrl),
      inspectUrl(resolution.siteUrl, "https://3dcreate.com.br/"),
    ]);
    return {
      status: "ok",
      siteUrl: resolution.siteUrl,
      sitemaps,
      homepageInspection,
    };
  },
);

export const querySearchConsole = createServerFn({ method: "POST" })
  .validator((data) => analyticsInputSchema.parse(data))
  .handler(async ({ data }) => {
    const resolution = await resolveSiteUrl(data.targetUrl, data.selectedSiteUrl);
    if (resolution.status === "selection_required") {
      return {
        status: "selection_required",
        candidates: resolution.candidates,
      };
    }
    const analytics = await querySearchAnalytics(resolution.siteUrl, {
      startDate: data.startDate,
      endDate: data.endDate,
      dimensions: data.dimensions,
      rowLimit: data.rowLimit,
      startRow: 0,
    });
    return {
      status: "ok",
      siteUrl: resolution.siteUrl,
      analytics,
    };
  });

export const inspectSearchConsoleUrl = createServerFn({ method: "POST" })
  .validator((data) => inspectInputSchema.parse(data))
  .handler(async ({ data }) => {
    const resolution = await resolveSiteUrl(data.targetUrl, data.selectedSiteUrl);
    if (resolution.status === "selection_required") {
      return {
        status: "selection_required",
        candidates: resolution.candidates,
      };
    }
    const url = data.inspectionUrl ?? data.targetUrl;
    const inspection = await inspectUrl(resolution.siteUrl, url);
    return {
      status: "ok",
      siteUrl: resolution.siteUrl,
      inspection,
    };
  });

