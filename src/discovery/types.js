/**
 * Discovery Engine — shared types & constants (Sprint 2.1)
 * Persistence entities remain Company / Evidence / IntelligenceInboxItem (docs/33).
 * Discovery event categories map onto frozen Evidence.type enums — no new entities.
 */

/** @typedef {'rss'|'xml'|'csv'|'json_api'|'manual_upload'|'html'} AdapterKind */

/** @typedef {'identity'|'location'|'firmographic'|'contact_published'|'organizational'|'project_mention'|'financial_investment'|'operational'|'commercial_history'|'media'|'trade'|'manual_attestation'} EvidenceType */

/** @typedef {'active'|'expired'|'quarantined'} EvidenceStatus */

/**
 * Industrial discovery event categories (pipeline claim taxonomy).
 * Persisted Evidence.type uses the frozen schema enum via EVENT_TO_EVIDENCE_TYPE.
 * @typedef {'factory_expansion'|'tender'|'investment'|'hiring'|'new_product_line'|'equipment_purchase'|'environmental_permit'|'government_funding'|'factory_construction'|'production_increase'|'certification'|'export_activity'|'other'} DiscoveryEventType
 */

/**
 * @typedef {Object} SourceMetadata
 * @property {string} source_id
 * @property {AdapterKind} adapter_kind
 * @property {string} source_type - Catalog code (docs/27)
 * @property {number} [source_weight] - W 0–1
 * @property {string} [label]
 */

/**
 * @typedef {Object} RawDocument
 * @property {string} id
 * @property {string|object|Array} content
 * @property {string} content_type - e.g. application/json, text/csv, text/xml, text/html
 * @property {SourceMetadata} source
 * @property {string} fetched_at - ISO timestamp
 * @property {string} [url]
 * @property {Record<string, string>} [headers]
 */

/**
 * @typedef {Object} ParsedRecord
 * @property {string} company_name
 * @property {string} [website]
 * @property {string} [domain]
 * @property {string} [country]
 * @property {string} [language]
 * @property {string} [phone]
 * @property {string} [email]
 * @property {string[]} [sectors]
 * @property {string} [claim]
 * @property {DiscoveryEventType} [event_type]
 * @property {string} [artifact_url]
 * @property {string} [observed_at]
 * @property {string} [expires_at]
 * @property {number} [confidence]
 * @property {string} [currency]
 * @property {number|string} [amount]
 * @property {string} [unit]
 * @property {string} [raw_excerpt]
 * @property {boolean} [manual_attestation]
 * @property {string} [attested_by]
 * @property {Record<string, unknown>} [extras]
 */

/**
 * @typedef {Object} NormalizedRecord
 * @property {string} company_name
 * @property {string} normalized_name
 * @property {string|null} website
 * @property {string|null} domain
 * @property {string|null} country
 * @property {string|null} language
 * @property {string|null} phone
 * @property {string|null} email
 * @property {string[]} sectors
 * @property {string} claim
 * @property {DiscoveryEventType} event_type
 * @property {string|null} artifact_url
 * @property {string} observed_at
 * @property {string|null} expires_at
 * @property {number} confidence
 * @property {string|null} currency
 * @property {number|null} amount_usd_band
 * @property {string|null} unit
 * @property {string|null} raw_excerpt
 * @property {boolean} manual_attestation
 * @property {string|null} attested_by
 * @property {SourceMetadata} source
 */

/**
 * @typedef {Object} CompanyRecord
 * @property {string} id
 * @property {string} name
 * @property {string} [normalized_name]
 * @property {string} [website]
 * @property {string} [domain]
 * @property {string} [country]
 * @property {string} [industry_raw]
 * @property {string} verification_status
 * @property {string} path_a_status
 * @property {string} [source_provenance]
 * @property {string[]} [tags]
 */

/**
 * @typedef {Object} EvidenceRecord
 * @property {string} [id]
 * @property {string} company_id
 * @property {EvidenceType} type
 * @property {string} claim
 * @property {string} source_type
 * @property {string} [artifact_url]
 * @property {string} [artifact_hash]
 * @property {number} [source_weight]
 * @property {number} confidence
 * @property {string} observed_at
 * @property {string} [expires_at]
 * @property {string} [extractor]
 * @property {string} [raw_excerpt]
 * @property {boolean} [manual_attestation]
 * @property {string} [attested_by]
 * @property {EvidenceStatus} status
 * @property {DiscoveryEventType} [discovery_event_type]
 */

/**
 * @typedef {Object} InboxItemRecord
 * @property {string} [id]
 * @property {string} company_id
 * @property {string} status
 * @property {string} [path]
 * @property {string} [recommendation_summary]
 * @property {number} [priority_index]
 */

/**
 * @typedef {Object} StageLogEntry
 * @property {string} time
 * @property {string} stage
 * @property {string} [source]
 * @property {string} [company]
 * @property {string} [evidence]
 * @property {'ok'|'skip'|'reject'|'error'} result
 * @property {string} [message]
 * @property {unknown} [error]
 */

export const DISCOVERY_EVENT_TYPES = Object.freeze([
  'factory_expansion',
  'tender',
  'investment',
  'hiring',
  'new_product_line',
  'equipment_purchase',
  'environmental_permit',
  'government_funding',
  'factory_construction',
  'production_increase',
  'certification',
  'export_activity',
  'other',
]);

/** Map discovery event → frozen Evidence.type (docs/33, Evidence.jsonc) */
export const EVENT_TO_EVIDENCE_TYPE = Object.freeze({
  factory_expansion: 'project_mention',
  tender: 'project_mention',
  investment: 'financial_investment',
  hiring: 'operational',
  new_product_line: 'firmographic',
  equipment_purchase: 'trade',
  environmental_permit: 'project_mention',
  government_funding: 'financial_investment',
  factory_construction: 'project_mention',
  production_increase: 'operational',
  certification: 'operational',
  export_activity: 'trade',
  other: 'media',
});

/** Default minimum confidence to accept evidence (below Tier E floor → quarantine) */
export const CONFIDENCE_THRESHOLD = 0.35;

/** Soft expiry days by discovery event (aligned with docs/12 §4.4) */
export const EVENT_SOFT_EXPIRY_DAYS = Object.freeze({
  factory_expansion: 365,
  tender: 90,
  investment: 180,
  hiring: 90,
  new_product_line: 180,
  equipment_purchase: 180,
  environmental_permit: 365,
  government_funding: 180,
  factory_construction: 365,
  production_increase: 180,
  certification: 365,
  export_activity: 180,
  other: 120,
});

export const EXTRACTOR_ID = 'discovery-pipeline@2.1.0';
