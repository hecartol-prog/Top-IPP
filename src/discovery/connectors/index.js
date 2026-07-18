/**
 * Shared connector interface + production connectors (Sprint 2.2).
 * Each connector: SourceRegistryEntry → RawDocument (or typed error).
 * No URLs hardcoded — always from registry entry / options.
 */

import { fetchText } from './http.js';

/**
 * @typedef {import('../registry/types.js').SourceRegistryEntry} SourceRegistryEntry
 * @typedef {import('../types.js').RawDocument} RawDocument
 */

/**
 * @typedef {Object} ConnectorContext
 * @property {string|object|Array} [payload] - Offline/fixture body (preferred in tests)
 * @property {Record<string, string>} [headers]
 * @property {number} [timeoutMs]
 * @property {typeof fetch} [fetchImpl]
 * @property {object} [pdfMeta] - Manual PDF metadata only
 */

/**
 * @typedef {Object} ConnectorResult
 * @property {boolean} ok
 * @property {RawDocument} [document]
 * @property {string} [error]
 * @property {string} [errorCode]
 */

/**
 * @typedef {Object} DiscoveryConnector
 * @property {string} type
 * @property {(source: SourceRegistryEntry, ctx?: ConnectorContext) => Promise<ConnectorResult>} fetch
 */

/**
 * @param {SourceRegistryEntry} source
 * @param {string} adapterKind
 * @param {string|object|Array} content
 * @param {string} contentType
 * @param {string} [url]
 * @returns {RawDocument}
 */
function buildDocument(source, adapterKind, content, contentType, url) {
  const fetched_at = new Date().toISOString();
  return {
    id: `${adapterKind}:${source.id}:${fetched_at}`,
    content,
    content_type: contentType,
    source: {
      source_id: source.id,
      adapter_kind: /** @type {any} */ (adapterKind),
      source_type: source.source_type || source.type,
      source_weight: source.source_weight,
      label: source.name,
    },
    fetched_at,
    url: url || source.url,
  };
}

/**
 * Resolve content from payload or network.
 * @param {SourceRegistryEntry} source
 * @param {ConnectorContext} ctx
 * @param {string} defaultContentType
 * @returns {Promise<ConnectorResult & { content?: string|object, contentType?: string, url?: string }>}
 */
async function resolveContent(source, ctx, defaultContentType) {
  if (ctx.payload !== undefined && ctx.payload !== null) {
    return {
      ok: true,
      content: ctx.payload,
      contentType: defaultContentType,
      url: source.url,
    };
  }

  const fetched = await fetchText(source.url, {
    timeoutMs: ctx.timeoutMs,
    headers: ctx.headers,
    fetchImpl: ctx.fetchImpl,
  });

  if (!fetched.ok) {
    return {
      ok: false,
      error: fetched.error || 'fetch_failed',
      errorCode: fetched.errorCode || 'fetch_failed',
    };
  }

  return {
    ok: true,
    content: fetched.body,
    contentType: fetched.contentType || defaultContentType,
    url: fetched.finalUrl || source.url,
  };
}

/** @type {DiscoveryConnector} */
export const rssConnector = {
  type: 'rss',
  async fetch(source, ctx = {}) {
    try {
      const resolved = await resolveContent(source, ctx, 'application/rss+xml');
      if (!resolved.ok) return resolved;
      return {
        ok: true,
        document: buildDocument(source, 'rss', resolved.content, resolved.contentType, resolved.url),
      };
    } catch (err) {
      return { ok: false, error: String(err?.message || err), errorCode: 'rss_error' };
    }
  },
};

/** @type {DiscoveryConnector} */
export const sitemapConnector = {
  type: 'sitemap',
  async fetch(source, ctx = {}) {
    try {
      const resolved = await resolveContent(source, ctx, 'application/xml');
      if (!resolved.ok) return resolved;
      return {
        ok: true,
        document: buildDocument(source, 'xml', resolved.content, 'application/xml', resolved.url),
      };
    } catch (err) {
      return { ok: false, error: String(err?.message || err), errorCode: 'sitemap_error' };
    }
  },
};

/** @type {DiscoveryConnector} */
export const xmlConnector = {
  type: 'xml',
  async fetch(source, ctx = {}) {
    try {
      const resolved = await resolveContent(source, ctx, 'application/xml');
      if (!resolved.ok) return resolved;
      return {
        ok: true,
        document: buildDocument(source, 'xml', resolved.content, resolved.contentType, resolved.url),
      };
    } catch (err) {
      return { ok: false, error: String(err?.message || err), errorCode: 'xml_error' };
    }
  },
};

/** @type {DiscoveryConnector} */
export const jsonApiConnector = {
  type: 'json_api',
  async fetch(source, ctx = {}) {
    try {
      const resolved = await resolveContent(source, ctx, 'application/json');
      if (!resolved.ok) return resolved;
      let content = resolved.content;
      if (typeof content === 'string') {
        try {
          content = JSON.parse(content);
        } catch {
          return { ok: false, error: 'invalid_json', errorCode: 'invalid_json' };
        }
      }
      return {
        ok: true,
        document: buildDocument(source, 'json_api', content, 'application/json', resolved.url),
      };
    } catch (err) {
      return { ok: false, error: String(err?.message || err), errorCode: 'json_error' };
    }
  },
};

/** @type {DiscoveryConnector} */
export const csvConnector = {
  type: 'csv',
  async fetch(source, ctx = {}) {
    try {
      const resolved = await resolveContent(source, ctx, 'text/csv');
      if (!resolved.ok) return resolved;
      return {
        ok: true,
        document: buildDocument(source, 'csv', resolved.content, 'text/csv', resolved.url),
      };
    } catch (err) {
      return { ok: false, error: String(err?.message || err), errorCode: 'csv_error' };
    }
  },
};

/** @type {DiscoveryConnector} */
export const manualUrlConnector = {
  type: 'manual_url',
  async fetch(source, ctx = {}) {
    try {
      const resolved = await resolveContent(source, ctx, 'text/html');
      if (!resolved.ok) return resolved;
      const ct = String(resolved.contentType || '');
      const kind = ct.includes('json') ? 'json_api' : ct.includes('xml') ? 'xml' : 'html';
      let content = resolved.content;
      if (kind === 'json_api' && typeof content === 'string') {
        try {
          content = JSON.parse(content);
        } catch {
          return { ok: false, error: 'invalid_json', errorCode: 'invalid_json' };
        }
      }
      return {
        ok: true,
        document: buildDocument(source, kind, content, resolved.contentType || 'text/html', resolved.url),
      };
    } catch (err) {
      return { ok: false, error: String(err?.message || err), errorCode: 'manual_url_error' };
    }
  },
};

/**
 * Manual PDF — metadata only (no text extraction / no AI).
 * Expects ctx.pdfMeta or JSON payload with metadata fields.
 * @type {DiscoveryConnector}
 */
export const manualPdfConnector = {
  type: 'manual_pdf',
  async fetch(source, ctx = {}) {
    try {
      const meta = ctx.pdfMeta || (typeof ctx.payload === 'object' && ctx.payload !== null ? ctx.payload : null);
      if (!meta || typeof meta !== 'object') {
        return {
          ok: false,
          error: 'pdf_metadata_required',
          errorCode: 'pdf_meta_missing',
        };
      }
      // Metadata only — never invent claims from PDF bytes
      const content = {
        company_name: meta.company_name || meta.company || null,
        website: meta.website || null,
        country: meta.country || null,
        claim: meta.claim || null,
        event_type: meta.event_type || 'other',
        artifact_url: meta.artifact_url || source.url,
        observed_at: meta.observed_at || new Date().toISOString(),
        confidence: typeof meta.confidence === 'number' ? meta.confidence : source.source_weight || 0.65,
        manual_attestation: Boolean(meta.manual_attestation),
        attested_by: meta.attested_by || null,
        sectors: meta.sectors || [source.industry].filter(Boolean),
        registration_number: meta.registration_number || null,
        extras: {
          pdf_filename: meta.filename || meta.pdf_filename || null,
          pdf_title: meta.title || meta.pdf_title || null,
          pdf_page_count: meta.page_count ?? meta.pdf_page_count ?? null,
          pdf_bytes_sha256: meta.sha256 || null,
          metadata_only: true,
        },
      };
      if (!content.company_name) {
        return { ok: false, error: 'pdf_meta_missing_company', errorCode: 'pdf_meta_incomplete' };
      }
      if (!content.claim && !content.manual_attestation) {
        return { ok: false, error: 'pdf_meta_missing_claim_or_attestation', errorCode: 'pdf_meta_incomplete' };
      }
      return {
        ok: true,
        document: buildDocument(source, 'manual_upload', content, 'application/pdf+meta', source.url),
      };
    } catch (err) {
      return { ok: false, error: String(err?.message || err), errorCode: 'pdf_error' };
    }
  },
};

/** @type {Record<string, DiscoveryConnector>} */
export const CONNECTORS = {
  rss: rssConnector,
  sitemap: sitemapConnector,
  xml: xmlConnector,
  json_api: jsonApiConnector,
  csv: csvConnector,
  manual_url: manualUrlConnector,
  manual_pdf: manualPdfConnector,
  // aliases to foundation adapters
  html: manualUrlConnector,
  manual_upload: csvConnector,
};

/**
 * @param {string} type
 * @returns {DiscoveryConnector}
 */
export function getConnector(type) {
  const c = CONNECTORS[type];
  if (!c) throw new Error(`No connector for type: ${type}`);
  return c;
}

/**
 * @param {SourceRegistryEntry} source
 * @param {ConnectorContext} [ctx]
 * @returns {Promise<ConnectorResult>}
 */
export async function runConnector(source, ctx = {}) {
  try {
    const connector = getConnector(source.type);
    return await connector.fetch(source, ctx);
  } catch (err) {
    return { ok: false, error: String(err?.message || err), errorCode: 'connector_crash' };
  }
}

export const SUPPORTED_CONNECTORS = Object.freeze([
  'rss',
  'sitemap',
  'xml',
  'json_api',
  'csv',
  'manual_url',
  'manual_pdf',
]);
