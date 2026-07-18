/**
 * Discovery adapters — framework only (no scraping complexity).
 * Each adapter returns RawDocument + source metadata + timestamp + source id.
 */

/**
 * @typedef {import('./types.js').RawDocument} RawDocument
 * @typedef {import('./types.js').SourceMetadata} SourceMetadata
 * @typedef {import('./types.js').AdapterKind} AdapterKind
 */

/**
 * @typedef {Object} AdapterInput
 * @property {string} source_id
 * @property {string} [source_type]
 * @property {number} [source_weight]
 * @property {string} [label]
 * @property {string} [url]
 * @property {string|object|Array} [payload]
 * @property {string} [content_type]
 * @property {Record<string, string>} [headers]
 */

/**
 * @param {AdapterKind} kind
 * @param {AdapterInput} input
 * @param {string|object|Array} content
 * @param {string} contentType
 * @returns {RawDocument}
 */
function buildRawDocument(kind, input, content, contentType) {
  const fetched_at = new Date().toISOString();
  /** @type {SourceMetadata} */
  const source = {
    source_id: input.source_id,
    adapter_kind: kind,
    source_type: input.source_type || kind,
    source_weight: typeof input.source_weight === 'number' ? input.source_weight : undefined,
    label: input.label,
  };
  return {
    id: `${kind}:${input.source_id}:${fetched_at}`,
    content,
    content_type: contentType,
    source,
    fetched_at,
    url: input.url,
    headers: input.headers,
  };
}

/**
 * @param {AdapterInput} input
 * @returns {Promise<RawDocument>}
 */
export async function fetchRss(input) {
  const content = input.payload ?? '';
  return buildRawDocument('rss', input, content, input.content_type || 'application/rss+xml');
}

/**
 * @param {AdapterInput} input
 * @returns {Promise<RawDocument>}
 */
export async function fetchXml(input) {
  const content = input.payload ?? '';
  return buildRawDocument('xml', input, content, input.content_type || 'application/xml');
}

/**
 * @param {AdapterInput} input
 * @returns {Promise<RawDocument>}
 */
export async function fetchCsv(input) {
  const content = input.payload ?? '';
  return buildRawDocument('csv', input, content, input.content_type || 'text/csv');
}

/**
 * @param {AdapterInput} input
 * @returns {Promise<RawDocument>}
 */
export async function fetchJsonApi(input) {
  const content = input.payload ?? {};
  return buildRawDocument('json_api', input, content, input.content_type || 'application/json');
}

/**
 * @param {AdapterInput} input
 * @returns {Promise<RawDocument>}
 */
export async function fetchManualUpload(input) {
  const content = input.payload ?? '';
  return buildRawDocument(
    'manual_upload',
    { ...input, source_type: input.source_type || 'manual_import' },
    content,
    input.content_type || 'application/json'
  );
}

/**
 * @param {AdapterInput} input
 * @returns {Promise<RawDocument>}
 */
export async function fetchHtmlPage(input) {
  const content = input.payload ?? '';
  return buildRawDocument('html', input, content, input.content_type || 'text/html');
}

/** @type {Record<AdapterKind, (input: AdapterInput) => Promise<RawDocument>>} */
export const ADAPTERS = {
  rss: fetchRss,
  xml: fetchXml,
  csv: fetchCsv,
  json_api: fetchJsonApi,
  manual_upload: fetchManualUpload,
  html: fetchHtmlPage,
};

/**
 * @param {AdapterKind} kind
 * @param {AdapterInput} input
 * @returns {Promise<RawDocument>}
 */
export async function runAdapter(kind, input) {
  const adapter = ADAPTERS[kind];
  if (!adapter) {
    throw new Error(`Unknown adapter kind: ${kind}`);
  }
  if (!input?.source_id) {
    throw new Error('Adapter requires source_id');
  }
  return adapter(input);
}
