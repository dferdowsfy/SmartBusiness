// ============================================================================
// PR 8 (real): bounded crawler + document extractor for official sources.
//
//   * Cheerio/static fetch FIRST. Playwright is used only as an optional
//     fallback for JS-rendered pages (lazy dynamic import; no-op if the
//     package/browsers aren't installed, so builds never depend on it).
//   * Restricted to official government hosts (sources.ts).
//   * Bounded: max pages + max depth + per-fetch timeout.
//   * Extracts candidate documents (forms/checklists/fee schedules/etc.),
//     fee references, and the requirement keywords present on each page.
//
// GUARDRAILS: no CAPTCHA bypass, no portal login, no form submission. We only
// read public pages and downloadable form links.
// ============================================================================

import * as cheerio from "cheerio";
import { createHash } from "crypto";
import { isOfficialHost } from "./sources";
import type { DocumentType } from "./types";

const FETCH_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_PAGES = 20;
const DEFAULT_MAX_DEPTH = 2;

export interface ExtractedDocument {
  title: string;
  url: string;
  documentType: DocumentType;
  fileType: string | null; // 'pdf' | 'html' | ...
  language: string | null;
  checksum: string; // sha256 of the normalized URL (stable de-dup key)
}

export interface CrawlResult {
  pagesVisited: string[];
  documents: ExtractedDocument[];
  feeReferences: string[];
  errors: string[];
}

export interface CrawlOptions {
  officialHosts?: string[];
  maxPages?: number;
  maxDepth?: number;
  usePlaywright?: boolean;
}

// Keyword → document_type classification (English + Spanish / PR terms).
const TYPE_KEYWORDS: { type: DocumentType; words: RegExp }[] = [
  { type: "application_form", words: /\b(application|solicitud|formulario|planilla|permiso[ -]?[úu]nico|patente)\b/i },
  { type: "checklist", words: /\b(checklist|lista|requisitos|requirements)\b/i },
  { type: "fee_schedule", words: /\b(fee|fees|arancel|aranceles|tarifa|costo|derechos)\b/i },
  { type: "instructions", words: /\b(instructions|instrucciones|gu[íi]a|guide|how to|c[óo]mo)\b/i },
  { type: "zoning_document", words: /\b(zoning|zonificaci[óo]n|uso de terreno)\b/i },
  { type: "tax_registration", words: /\b(tax|hacienda|registro|iva|ivu|contribuci[óo]n)\b/i },
  { type: "license_requirement", words: /\b(license|licencia|certificado de uso|certificate of use)\b/i },
  { type: "inspection_requirement", words: /\b(inspection|inspecci[óo]n|bomberos|salud|sanitaria)\b/i },
];

// Anchors worth following / capturing must look requirement-related.
const RELEVANT = /\b(permiso|licencia|patente|solicitud|formulario|planilla|certificado|requisitos|arancel|tarifa|inspecci[óo]n|zonificaci[óo]n|uso|download|descargar|permit|license|application|form|checklist|fee|inspection|zoning|certificate)\b/i;
const DOWNLOAD_LINK = /\b(download|descargar)\b/i;

const FEE_RE = /(?:\$|US\$)\s?\d[\d,]*(?:\.\d{2})?/g;

function normalizeUrl(raw: string, base: string): string | null {
  try {
    const u = new URL(raw, base);
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

function checksumUrl(url: string): string {
  return createHash("sha256").update(url.trim().toLowerCase()).digest("hex");
}

function classify(text: string, url: string): DocumentType {
  const hay = `${text} ${url}`;
  for (const { type, words } of TYPE_KEYWORDS) if (words.test(hay)) return type;
  return "other";
}

function fileTypeOf(url: string): string | null {
  const m = url.toLowerCase().match(/\.(pdf|docx?|xlsx?|html?)(?:$|\?)/);
  return m ? m[1].replace("htm", "html") : null;
}

function inferredFileType(url: string, text: string): string | null {
  const explicit = fileTypeOf(url);
  if (explicit) return explicit;
  const host = new URL(url).hostname.toLowerCase();
  if (DOWNLOAD_LINK.test(text) && (host === "docs.pr.gov" || host.endsWith(".sharepoint.com"))) return "pdf";
  return null;
}

function langOf(text: string): string | null {
  if (/[áéíóúñ¿¡]|solicitud|permiso|licencia|formulario/i.test(text)) return "es";
  if (/[a-z]/i.test(text)) return "en";
  return null;
}

async function staticFetch(url: string): Promise<{ ok: boolean; html: string; status: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "SmartPR-RequirementDiscovery/1.0 (readiness; non-commercial)" },
    });
    const ct = res.headers.get("content-type") || "";
    // Only parse HTML pages; binary forms (PDF) are captured as links, not fetched.
    const html = res.ok && ct.includes("html") ? await res.text() : "";
    return { ok: res.ok, html, status: res.status };
  } catch {
    return { ok: false, html: "", status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

// Optional Playwright fallback for JS-rendered pages. Lazily imported and fully
// guarded: if 'playwright' (or its browsers) isn't installed, returns null and
// the crawler continues with static HTML only.
async function playwrightFetch(url: string): Promise<string | null> {
  try {
    // Non-literal specifier so TS does not require 'playwright' to be installed;
    // it's an optional runtime enhancement only.
    const specifier = "playwright";
    const mod = (await import(specifier).catch(() => null)) as
      | { chromium: { launch: (o?: unknown) => Promise<unknown> } }
      | null;
    if (!mod?.chromium) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const browser: any = await mod.chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: FETCH_TIMEOUT_MS });
      return (await page.content()) as string;
    } finally {
      await browser.close();
    }
  } catch {
    return null;
  }
}

/**
 * Crawl outward from a seed URL on official hosts only, collecting candidate
 * requirement documents. Bounded by maxPages/maxDepth.
 */
export async function crawlSource(seedUrl: string, opts: CrawlOptions = {}): Promise<CrawlResult> {
  const maxPages = opts.maxPages ?? DEFAULT_MAX_PAGES;
  const maxDepth = opts.maxDepth ?? DEFAULT_MAX_DEPTH;
  const officialHosts = opts.officialHosts ?? [];

  const result: CrawlResult = { pagesVisited: [], documents: [], feeReferences: [], errors: [] };
  if (!isOfficialHost(seedUrl, officialHosts)) {
    result.errors.push(`Seed is not an official government host: ${seedUrl}`);
    return result;
  }

  const seenPages = new Set<string>();
  const seenDocs = new Set<string>();
  const queue: { url: string; depth: number }[] = [{ url: seedUrl, depth: 0 }];

  while (queue.length > 0 && result.pagesVisited.length < maxPages) {
    const { url, depth } = queue.shift()!;
    if (seenPages.has(url)) continue;
    seenPages.add(url);

    const fetched = await staticFetch(url);
    let { ok, html } = fetched;
    const status = fetched.status;
    if ((!ok || html.trim().length < 200) && opts.usePlaywright) {
      const rendered = await playwrightFetch(url);
      if (rendered) {
        html = rendered;
        ok = true;
      }
    }
    if (!ok || !html) {
      result.errors.push(`Fetch failed (${status}): ${url}`);
      continue;
    }
    result.pagesVisited.push(url);

    const $ = cheerio.load(html);
    const pageText = $("body").text().replace(/\s+/g, " ").trim();
    for (const m of pageText.match(FEE_RE) ?? []) {
      if (!result.feeReferences.includes(m)) result.feeReferences.push(m);
    }

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";
      const text = ($(el).text() || "").replace(/\s+/g, " ").trim();
      const abs = normalizeUrl(href, url);
      if (!abs || !isOfficialHost(abs, officialHosts)) return;

      const rowText = ($(el).closest("tr").text() || $(el).parent().text() || text).replace(/\s+/g, " ").trim();
      const title = rowText && rowText.length > text.length ? rowText : text;
      const ft = inferredFileType(abs, title);
      const isDownloadable = ft && ft !== "html";
      const looksRelevant = RELEVANT.test(title) || RELEVANT.test(abs);

      // Capture downloadable forms / relevant documents.
      if ((isDownloadable || looksRelevant) && !seenDocs.has(abs)) {
        seenDocs.add(abs);
        result.documents.push({
          title: title || abs.split("/").pop() || abs,
          url: abs,
          documentType: classify(title, abs),
          fileType: ft,
          language: langOf(title || pageText.slice(0, 200)),
          checksum: checksumUrl(abs),
        });
      }

      // Follow relevant same-source HTML pages for another level.
      if (!isDownloadable && looksRelevant && depth < maxDepth && !seenPages.has(abs)) {
        queue.push({ url: abs, depth: depth + 1 });
      }
    });
  }

  return result;
}
