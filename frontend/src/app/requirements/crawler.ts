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
const DEFAULT_MAX_PAGES = 75;
const DEFAULT_MAX_DEPTH = 3;

export interface ExtractedDocument {
  title: string;
  url: string;
  documentType: DocumentType;
  fileType: string | null; // 'pdf' | 'html' | ...
  language: string | null;
  checksum: string; // sha256 of downloaded bytes when available, otherwise normalized URL
  sourceUrl: string;
  lastModified: string | null;
  contentLength: number | null;
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
  { type: "affidavit", words: /\b(affidavit|declaraci[óo]n jurada)\b/i },
  { type: "checklist", words: /\b(checklist|lista|requisitos|requirements)\b/i },
  { type: "instructions", words: /\b(instructions|instrucciones|gu[íi]a|guide|how to|c[óo]mo)\b/i },
  { type: "guide", words: /\b(gu[íi]a|guide|orientaci[óo]n)\b/i },
  { type: "manual", words: /\b(manual)\b/i },
  { type: "renewal_form", words: /\b(renewal|renovaci[óo]n)\b/i },
  { type: "permit_form", words: /\b(permiso|permit|permiso[ -]?[úu]nico)\b/i },
  { type: "license_form", words: /\b(license|licencia|patente)\b/i },
  { type: "inspection_request", words: /\b(inspection|inspecci[óo]n|bomberos|salud|sanitaria)\b/i },
  { type: "certification_request", words: /\b(certification|certificaci[óo]n|certificado)\b/i },
  { type: "regulation", words: /\b(regulation|reglamento|reglamentaci[óo]n)\b/i },
  { type: "circular_letter", words: /\b(circular letter|carta circular)\b/i },
  { type: "administrative_order", words: /\b(administrative order|orden administrativa)\b/i },
  { type: "policy", words: /\b(policy|pol[íi]tica)\b/i },
  { type: "application", words: /\b(application|solicitud|formulario|planilla)\b/i },
  { type: "zoning_document", words: /\b(zoning|zonificaci[óo]n|uso de terreno)\b/i },
  { type: "tax_registration", words: /\b(tax|hacienda|registro|iva|ivu|contribuci[óo]n)\b/i },
  { type: "license_requirement", words: /\b(license|licencia|certificado de uso|certificate of use)\b/i },
  { type: "inspection_requirement", words: /\b(inspection|inspecci[óo]n|bomberos|salud|sanitaria)\b/i },
];

// Anchors worth following / capturing must look requirement-related.
const RELEVANT = /\b(formularios?|forms?|documentos?|downloads?|permisos?|solicitudes?|aplicaciones?|manuales?|gu[ií]as?|certificaciones?|licencias?|inspecciones?|pdf|permiso|licencia|patente|planilla|certificado|requisitos|arancel|tarifa|inspecci[óo]n|zonificaci[óo]n|uso|permit|license|application|form|checklist|fee|inspection|zoning|certificate)\b/i;

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

async function downloadMetadata(url: string): Promise<{ checksum: string; lastModified: string | null; contentLength: number | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "SmartPR-DocumentDiscovery/1.0 (readiness; non-commercial)" },
    });
    if (!res.ok) throw new Error(`download_failed_${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    return {
      checksum: createHash("sha256").update(bytes).digest("hex"),
      lastModified: res.headers.get("last-modified"),
      contentLength: Number(res.headers.get("content-length") || bytes.length) || null,
    };
  } catch {
    return { checksum: checksumUrl(url), lastModified: null, contentLength: null };
  } finally {
    clearTimeout(timer);
  }
}

function classify(text: string, url: string): DocumentType {
  const hay = `${text} ${url}`;
  for (const { type, words } of TYPE_KEYWORDS) if (words.test(hay)) return type;
  return "other";
}

function fileTypeOf(url: string): string | null {
  const m = url.toLowerCase().match(/\.(pdf|docx?|xlsx?|zip|rtf|odt|ods|html?)(?:$|\?)/);
  return m ? m[1].replace("htm", "html") : null;
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
    const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<unknown>;
    const mod = (await dynamicImport(specifier).catch(() => null)) as
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

    const candidates: { abs: string; text: string; ft: string | null; isDownloadable: boolean }[] = [];
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";
      const text = ($(el).text() || "").replace(/\s+/g, " ").trim();
      const abs = normalizeUrl(href, url);
      if (!abs || !isOfficialHost(abs, officialHosts)) return;

      const ft = fileTypeOf(abs);
      const isDownloadable = ft && ft !== "html";
      const looksRelevant = RELEVANT.test(text) || RELEVANT.test(abs);

      // Capture downloadable forms / relevant documents.
      if ((isDownloadable || looksRelevant) && !seenDocs.has(abs)) {
        seenDocs.add(abs);
        candidates.push({ abs, text, ft, isDownloadable: Boolean(isDownloadable) });
      }

      // Follow relevant same-source HTML pages for another level.
      if (!isDownloadable && looksRelevant && depth < maxDepth && !seenPages.has(abs)) {
        queue.push({ url: abs, depth: depth + 1 });
      }
    });

    for (const c of candidates) {
      const meta = c.isDownloadable ? await downloadMetadata(c.abs) : { checksum: checksumUrl(c.abs), lastModified: null, contentLength: null };
      result.documents.push({
        title: c.text || c.abs.split("/").pop() || c.abs,
        url: c.abs,
        documentType: classify(c.text, c.abs),
        fileType: c.ft,
        language: langOf(c.text || pageText.slice(0, 200)),
        checksum: meta.checksum,
        sourceUrl: url,
        lastModified: meta.lastModified,
        contentLength: meta.contentLength,
      });
    }
  }

  return result;
}
