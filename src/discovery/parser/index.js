/**
 * Parsers — RawDocument → ParsedRecord[]
 * Deterministic extraction only (no AI / LLM).
 */

import { DISCOVERY_EVENT_TYPES } from '../types.js';

/**
 * @typedef {import('../types.js').RawDocument} RawDocument
 * @typedef {import('../types.js').ParsedRecord} ParsedRecord
 * @typedef {import('../types.js').DiscoveryEventType} DiscoveryEventType
 */

/**
 * @param {string} value
 * @returns {DiscoveryEventType}
 */
export function normalizeEventType(value) {
  if (!value) return 'other';
  const key = String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  const aliases = {
    factory_expansion: 'factory_expansion',
    expansion: 'factory_expansion',
    tender: 'tender',
    rfp: 'tender',
    investment: 'investment',
    hiring: 'hiring',
    job: 'hiring',
    new_product_line: 'new_product_line',
    product_launch: 'new_product_line',
    equipment_purchase: 'equipment_purchase',
    machinery: 'equipment_purchase',
    environmental_permit: 'environmental_permit',
    env_permit: 'environmental_permit',
    government_funding: 'government_funding',
    funding: 'government_funding',
    factory_construction: 'factory_construction',
    construction: 'factory_construction',
    production_increase: 'production_increase',
    certification: 'certification',
    export_activity: 'export_activity',
    export: 'export_activity',
    other: 'other',
  };
  const mapped = aliases[key] || key;
  return DISCOVERY_EVENT_TYPES.includes(mapped) ? /** @type {DiscoveryEventType} */ (mapped) : 'other';
}

/**
 * @param {string} text
 * @returns {ParsedRecord[]}
 */
function parseRssLikeXml(text) {
  const items = [];
  const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(text)) !== null) {
    const block = match[1];
    const title = extractXmlTag(block, 'title');
    const link = extractXmlTag(block, 'link');
    const description = extractXmlTag(block, 'description');
    const pubDate = extractXmlTag(block, 'pubDate');
    const company =
      extractXmlTag(block, 'company') ||
      extractXmlTag(block, 'companyName') ||
      inferCompanyFromTitle(title);
    items.push({
      company_name: company || title || 'Unknown',
      claim: description || title || '',
      artifact_url: link || undefined,
      observed_at: pubDate ? new Date(pubDate).toISOString() : undefined,
      event_type: inferEventFromText(`${title} ${description}`),
      raw_excerpt: (description || title || '').slice(0, 500),
      website: extractWebsiteFromText(description || ''),
      country: extractXmlTag(block, 'country') || undefined,
    });
  }
  return items;
}

/**
 * @param {string} block
 * @param {string} tag
 * @returns {string|null}
 */
function extractXmlTag(block, tag) {
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i');
  const m = block.match(re);
  return m ? decodeXml(m[1].trim()) : null;
}

/**
 * @param {string} s
 */
function decodeXml(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * @param {string} title
 */
function inferCompanyFromTitle(title) {
  if (!title) return null;
  const m = title.match(/^([^:—\-–|]+)/);
  return m ? m[1].trim() : title.trim();
}

/**
 * @param {string} text
 * @returns {DiscoveryEventType}
 */
function inferEventFromText(text) {
  const t = (text || '').toLowerCase();
  if (/tender|rfp|rfq|bid\b/.test(t)) return 'tender';
  if (/environmental\s+permit|eia\b|discharge\s+permit/.test(t)) return 'environmental_permit';
  if (/construction\s+permit|building\s+permit|greenfield/.test(t)) return 'factory_construction';
  if (/expand|expansion|capacity\s+increase/.test(t)) return 'factory_expansion';
  if (/invest|capex|funding\s+round/.test(t)) return 'investment';
  if (/government\s+(grant|fund|funding)|subsidy/.test(t)) return 'government_funding';
  if (/hiring|job\s+opening|recruit/.test(t)) return 'hiring';
  if (/new\s+product|product\s+line|sku\s+launch/.test(t)) return 'new_product_line';
  if (/equipment|machinery|purchase\s+order/.test(t)) return 'equipment_purchase';
  if (/certif|iso\s*\d|haccp/.test(t)) return 'certification';
  if (/export|shipment|customs/.test(t)) return 'export_activity';
  if (/production\s+increase|throughput/.test(t)) return 'production_increase';
  return 'other';
}

/**
 * @param {string} text
 */
function extractWebsiteFromText(text) {
  const m = text.match(/https?:\/\/[^\s<>"']+/i);
  return m ? m[0] : undefined;
}

/**
 * @param {string} csv
 * @returns {ParsedRecord[]}
 */
function parseCsv(csv) {
  const lines = String(csv)
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  /** @type {ParsedRecord[]} */
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    /** @type {Record<string, string>} */
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (cols[idx] ?? '').trim();
    });
    const company =
      obj.company_name || obj.company || obj.name || obj.account || '';
    if (!company) continue;
    rows.push({
      company_name: company,
      website: obj.website || obj.url || undefined,
      domain: obj.domain || undefined,
      country: obj.country || undefined,
      language: obj.language || undefined,
      phone: obj.phone || undefined,
      email: obj.email || undefined,
      sectors: obj.sector || obj.industry || obj.sectors
        ? String(obj.sector || obj.industry || obj.sectors)
            .split(/[|;,]/)
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined,
      claim: obj.claim || obj.description || obj.title || `${company} discovered via CSV import`,
      event_type: normalizeEventType(obj.event_type || obj.type || obj.signal || 'other'),
      artifact_url: obj.artifact_url || obj.source_url || obj.link || undefined,
      observed_at: obj.observed_at || obj.date || undefined,
      expires_at: obj.expires_at || undefined,
      confidence: obj.confidence ? Number(obj.confidence) : undefined,
      currency: obj.currency || undefined,
      amount: obj.amount || obj.value || undefined,
      unit: obj.unit || undefined,
      raw_excerpt: (obj.claim || obj.description || '').slice(0, 500) || undefined,
      manual_attestation: String(obj.manual_attestation || '').toLowerCase() === 'true',
      attested_by: obj.attested_by || undefined,
    });
  }
  return rows;
}

/**
 * @param {string} line
 * @returns {string[]}
 */
function splitCsvLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

/**
 * @param {unknown} data
 * @returns {ParsedRecord[]}
 */
function parseJsonPayload(data) {
  const list = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray(/** @type {any} */ (data).items)
      ? /** @type {any} */ (data).items
      : data && typeof data === 'object' && Array.isArray(/** @type {any} */ (data).records)
        ? /** @type {any} */ (data).records
        : data && typeof data === 'object'
          ? [data]
          : [];

  return list.map((item) => {
    const o = item && typeof item === 'object' ? item : {};
    return {
      company_name: o.company_name || o.company || o.name || 'Unknown',
      website: o.website || undefined,
      domain: o.domain || undefined,
      country: o.country || undefined,
      language: o.language || undefined,
      phone: o.phone || undefined,
      email: o.email || undefined,
      sectors: Array.isArray(o.sectors)
        ? o.sectors
        : o.industry
          ? [String(o.industry)]
          : undefined,
      claim: o.claim || o.description || o.title || '',
      event_type: normalizeEventType(o.event_type || o.type || 'other'),
      artifact_url: o.artifact_url || o.url || o.link || undefined,
      observed_at: o.observed_at || o.date || undefined,
      expires_at: o.expires_at || undefined,
      confidence: typeof o.confidence === 'number' ? o.confidence : undefined,
      currency: o.currency || undefined,
      amount: o.amount ?? o.value,
      unit: o.unit || undefined,
      raw_excerpt: (o.raw_excerpt || o.claim || o.description || '').slice(0, 500) || undefined,
      manual_attestation: Boolean(o.manual_attestation),
      attested_by: o.attested_by || undefined,
      extras: o.extras,
    };
  });
}

/**
 * Minimal HTML: look for data-company / meta / simple patterns — no full scrape.
 * @param {string} html
 * @returns {ParsedRecord[]}
 */
function parseHtml(html) {
  const text = String(html);
  const companyMatch =
    text.match(/data-company=["']([^"']+)["']/i) ||
    text.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i) ||
    text.match(/<title>([^<]+)<\/title>/i);
  const company = companyMatch ? companyMatch[1].trim() : null;
  if (!company) return [];
  const claimMatch = text.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  const claim = claimMatch ? claimMatch[1].trim() : `HTML page observed for ${company}`;
  const urlMatch = text.match(/canonical["'][^>]+href=["']([^"']+)["']/i);
  return [
    {
      company_name: company,
      claim,
      event_type: inferEventFromText(claim),
      artifact_url: urlMatch ? urlMatch[1] : undefined,
      raw_excerpt: claim.slice(0, 500),
      website: extractWebsiteFromText(text),
    },
  ];
}

/**
 * @param {RawDocument} doc
 * @returns {ParsedRecord[]}
 */
export function parseRawDocument(doc) {
  const kind = doc.source?.adapter_kind;
  const content = doc.content;

  if (kind === 'rss' || kind === 'xml' || String(doc.content_type || '').includes('xml')) {
    return parseRssLikeXml(String(content));
  }
  if (kind === 'csv' || String(doc.content_type || '').includes('csv')) {
    return parseCsv(String(content));
  }
  if (kind === 'html' || String(doc.content_type || '').includes('html')) {
    return parseHtml(String(content));
  }
  // json_api, manual_upload, default
  if (typeof content === 'string') {
    try {
      return parseJsonPayload(JSON.parse(content));
    } catch {
      // treat as CSV fallback for manual text
      if (content.includes(',') && content.includes('\n')) return parseCsv(content);
      return [];
    }
  }
  return parseJsonPayload(content);
}
