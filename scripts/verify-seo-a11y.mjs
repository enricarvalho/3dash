#!/usr/bin/env node
// Pre-publish verification: robots.txt, sitemap.xml, canonicals, basic a11y.
// Fails the build (exit 1) when any check errors. Warnings do not fail.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : null);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// ---------- 1. Read canonical base URL from sitemap route ----------
const sitemapPath = join(ROOT, "src/routes/sitemap[.]xml.ts");
const sitemapSrc = read(sitemapPath);
let baseUrl = null;
if (!sitemapSrc) {
  err(`Missing ${relative(ROOT, sitemapPath)} — no sitemap route defined.`);
} else {
  const m = sitemapSrc.match(/BASE_URL\s*=\s*["'`]([^"'`]*)["'`]/);
  if (!m) err("sitemap route: could not locate BASE_URL constant.");
  else {
    baseUrl = m[1];
    if (!baseUrl) err("sitemap BASE_URL is empty — <loc> entries would be relative.");
    else if (!/^https:\/\//.test(baseUrl))
      err(`sitemap BASE_URL must be an absolute https:// URL (got "${baseUrl}").`);
    else if (baseUrl.endsWith("/"))
      warn(`sitemap BASE_URL ends with "/"; entries may double up slashes ("${baseUrl}").`);
  }
}

// ---------- 2. robots.txt ----------
const robotsPath = join(ROOT, "public/robots.txt");
const robots = read(robotsPath);
if (!robots) {
  err("public/robots.txt is missing.");
} else {
  const sitemapLine = robots.split(/\r?\n/).find((l) => /^\s*Sitemap:/i.test(l));
  if (!sitemapLine) err("robots.txt has no `Sitemap:` directive.");
  else if (baseUrl) {
    const url = sitemapLine.replace(/^\s*Sitemap:\s*/i, "").trim();
    if (!/^https:\/\//.test(url))
      err(`robots.txt Sitemap URL must be absolute https:// (got "${url}").`);
    if (baseUrl && !url.startsWith(baseUrl))
      err(
        `robots.txt Sitemap URL "${url}" does not match sitemap BASE_URL "${baseUrl}".`,
      );
    if (!/\/sitemap\.xml$/.test(url))
      warn(`robots.txt Sitemap URL should point at /sitemap.xml (got "${url}").`);
  }
  if (/^\s*User-agent:\s*\*\s*[\r\n]+\s*Disallow:\s*\/\s*$/im.test(robots))
    warn("robots.txt disallows all crawlers (`Disallow: /`). Intentional?");
}

// ---------- 3. Canonical links across route files ----------
const routesDir = join(ROOT, "src/routes");
const routeFiles = walk(routesDir).filter(
  (p) => /\.(t|j)sx?$/.test(p) && !p.endsWith(".gen.ts") && !p.includes(`${sep}api${sep}`),
);
let leafRoutesChecked = 0;
let leafRoutesWithCanonical = 0;
for (const file of routeFiles) {
  const src = read(file);
  if (!src || !/createFileRoute/.test(src)) continue;
  const isRoot = /createRootRoute(WithContext)?\s*(<|\()/.test(src);
  const isLeafContent =
    !isRoot &&
    /component\s*:/.test(src) &&
    !/\/api\//.test(file) &&
    !/sitemap\[\.\]xml/.test(file) &&
    !/mcp/i.test(file);
  // Canonical/og:url should be self-referential when present.
  const canonMatches = [...src.matchAll(/rel:\s*["']canonical["'][^}]*href:\s*["']([^"']+)["']/g)];
  const ogUrlMatches = [...src.matchAll(/property:\s*["']og:url["'][^}]*content:\s*["']([^"']+)["']/g)];
  if (isRoot) {
    if (canonMatches.length)
      err(`${relative(ROOT, file)}: canonical link declared on root route (belongs on leaf routes only).`);
  } else if (isLeafContent) {
    leafRoutesChecked++;
    if (canonMatches.length || ogUrlMatches.length) leafRoutesWithCanonical++;
    for (const [, href] of canonMatches) {
      if (/^https?:\/\//i.test(href) && baseUrl && !href.startsWith(baseUrl))
        err(`${relative(ROOT, file)}: canonical "${href}" does not match BASE_URL "${baseUrl}".`);
    }
    for (const [, href] of ogUrlMatches) {
      if (/^https?:\/\//i.test(href) && baseUrl && !href.startsWith(baseUrl))
        err(`${relative(ROOT, file)}: og:url "${href}" does not match BASE_URL "${baseUrl}".`);
    }
  }
}
if (leafRoutesChecked > 0 && leafRoutesWithCanonical === 0)
  warn("No leaf route declares a canonical or og:url. Consider adding one per shareable page.");

// ---------- 4. Basic accessibility checks ----------
const componentFiles = walk(join(ROOT, "src")).filter(
  (p) => /\.(t|j)sx$/.test(p) && !p.endsWith(".gen.ts") && !p.endsWith(".d.ts"),
);
for (const file of componentFiles) {
  const src = read(file);
  if (!src) continue;
  const rel = relative(ROOT, file);
  const lines = src.split(/\r?\n/);

  // <img ... /> without alt= (tags may span multiple lines)
  for (const match of src.matchAll(/<img\b([\s\S]*?)\/?>/g)) {
    if (/\balt\s*=/.test(match[1])) continue;
    const line = src.slice(0, match.index).split(/\r?\n/).length;
    err(`${rel}:${line} <img> without alt attribute.`);
  }

  // Icon-only buttons: <button ...> with only an icon child and no aria-label / title
  const iconOnly = src.matchAll(
    /<(?:button|Button)\b([^>]*?)>\s*<([A-Z]\w+|svg)\b[^<]*?\/>\s*<\/(?:button|Button)>/g,
  );
  for (const [match, attrs] of iconOnly) {
    if (!/aria-label\s*=|title\s*=|aria-labelledby\s*=/.test(attrs)) {
      const idx = src.indexOf(match);
      const line = src.slice(0, idx).split(/\r?\n/).length;
      warn(`${rel}:${line} icon-only button missing aria-label/title.`);
    }
  }
}

// ---------- 5. <html lang> present in root shell ----------
const rootPath = join(ROOT, "src/routes/__root.tsx");
const rootSrc = read(rootPath);
if (rootSrc && !/<html\b[^>]*\blang\s*=/.test(rootSrc))
  err("src/routes/__root.tsx: <html> tag is missing lang attribute.");

// ---------- Report ----------
const label = (n, s) => `${n} ${s}${n === 1 ? "" : "s"}`;
if (warnings.length) {
  console.warn(`\n⚠️  ${label(warnings.length, "warning")}:`);
  for (const w of warnings) console.warn(`   • ${w}`);
}
if (errors.length) {
  console.error(`\n❌ ${label(errors.length, "error")}:`);
  for (const e of errors) console.error(`   • ${e}`);
  console.error("\nBuild verification failed. Fix the errors above before publishing.");
  process.exit(1);
}
console.log(
  `✅ SEO/a11y verification passed (${leafRoutesChecked} leaf routes checked, ${warnings.length} warnings).`,
);
