/**
 * Source Registry types (Sprint 2.2).
 * DiscoverySource is a catalog/config concept — not a Base44 entity (docs/33).
 */

/**
 * @typedef {'rss'|'sitemap'|'xml'|'json_api'|'csv'|'manual_url'|'manual_pdf'|'html'|'manual_upload'} ConnectorType
 */

/**
 * @typedef {Object} SourceRegistryEntry
 * @property {string} id
 * @property {string} name
 * @property {ConnectorType} type
 * @property {string} country
 * @property {string} industry
 * @property {string} vertical_pack
 * @property {string} url
 * @property {string} language
 * @property {string} refresh_interval
 * @property {boolean} enabled
 * @property {number} priority
 * @property {string|null} [last_success]
 * @property {string|null} [last_error]
 * @property {string[]} [supported_countries]
 * @property {string[]} [supported_languages]
 * @property {string[]} [supported_vertical_packs]
 * @property {string} [parser]
 * @property {string} [normalizer]
 * @property {number} [source_weight]
 * @property {string} [source_type]
 */

export const CONNECTOR_TYPES = Object.freeze([
  'rss',
  'sitemap',
  'xml',
  'json_api',
  'csv',
  'manual_url',
  'manual_pdf',
  'html',
  'manual_upload',
]);

/** Minimum company-match confidence to attach (never merge below this). */
export const COMPANY_MATCH_CONFIDENCE_THRESHOLD = 0.85;
