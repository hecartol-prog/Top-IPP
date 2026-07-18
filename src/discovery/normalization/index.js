/**
 * Normalization — company identity & field hygiene (docs/12 §6.5).
 * Never fabricates domains. Duplicate prevention via normalized_name + domain keys.
 */

import { EVENT_SOFT_EXPIRY_DAYS } from '../types.js';
import { normalizeEventType } from '../parser/index.js';

/**
 * @typedef {import('../types.js').ParsedRecord} ParsedRecord
 * @typedef {import('../types.js').NormalizedRecord} NormalizedRecord
 * @typedef {import('../types.js').SourceMetadata} SourceMetadata
 * @typedef {import('../types.js').DiscoveryEventType} DiscoveryEventType
 */

const COUNTRY_ALIASES = Object.freeze({
  usa: 'US',
  'united states': 'US',
  'united states of america': 'US',
  uk: 'GB',
  'united kingdom': 'GB',
  britain: 'GB',
  deutschland: 'DE',
  germany: 'DE',
  france: 'FR',
  spain: 'ES',
  italy: 'IT',
  china: 'CN',
  prc: 'CN',
  mexico: 'MX',
  brazil: 'BR',
  india: 'IN',
  japan: 'JP',
  'south korea': 'KR',
  korea: 'KR',
  uae: 'AE',
  'saudi arabia': 'SA',
  netherlands: 'NL',
  holland: 'NL',
  poland: 'PL',
  turkey: 'TR',
  vietnam: 'VN',
  thailand: 'TH',
  indonesia: 'ID',
  malaysia: 'MY',
  singapore: 'SG',
  philippines: 'PH',
  australia: 'AU',
  canada: 'CA',
});

const LANGUAGE_ALIASES = Object.freeze({
  english: 'en',
  spanish: 'es',
  french: 'fr',
  german: 'de',
  chinese: 'zh',
  portuguese: 'pt',
  italian: 'it',
  dutch: 'nl',
  arabic: 'ar',
  japanese: 'ja',
  korean: 'ko',
});

const CURRENCY_ALIASES = Object.freeze({
  $: 'USD',
  usd: 'USD',
  'us dollar': 'USD',
  'us dollars': 'USD',
  euro: 'EUR',
  euros: 'EUR',
  '€': 'EUR',
  eur: 'EUR',
  gbp: 'GBP',
  '£': 'GBP',
  cny: 'CNY',
  rmb: 'CNY',
  '¥': 'CNY',
  mxn: 'MXN',
});

/**
 * @param {string} name
 * @returns {string}
 */
export function normalizeCompanyName(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(incorporated|inc|llc|ltd|limited|corp|corporation|gmbh|s\.?a\.?|co|company)\b\.?/gi, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string|null|undefined} website
 * @returns {string|null}
 */
export function normalizeWebsite(website) {
  if (!website || typeof website !== 'string') return null;
  const trimmed = website.trim();
  if (!trimmed) return null;
  try {
    const url = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    const u = new URL(url);
    if (!u.hostname) return null;
    return `${u.protocol}//${u.hostname.replace(/^www\./, '')}${u.pathname === '/' ? '' : u.pathname}`.replace(/\/$/, '');
  } catch {
    return null;
  }
}

/**
 * Extract domain only when evidence provides a real website/domain — never invent.
 * @param {string|null|undefined} website
 * @param {string|null|undefined} domain
 * @returns {string|null}
 */
export function normalizeDomain(website, domain) {
  if (domain && typeof domain === 'string') {
    const d = domain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0];
    return d || null;
  }
  const site = normalizeWebsite(website);
  if (!site) return null;
  try {
    return new URL(site).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

/**
 * @param {string|null|undefined} country
 * @returns {string|null}
 */
export function normalizeCountry(country) {
  if (!country) return null;
  const raw = String(country).trim();
  if (!raw) return null;
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  const alias = COUNTRY_ALIASES[raw.toLowerCase()];
  return alias || raw;
}

/**
 * @param {string|null|undefined} language
 * @returns {string|null}
 */
export function normalizeLanguage(language) {
  if (!language) return null;
  const raw = String(language).trim();
  if (!raw) return null;
  if (/^[A-Za-z]{2}(-[A-Za-z]{2})?$/.test(raw)) return raw.toLowerCase().split('-')[0];
  return LANGUAGE_ALIASES[raw.toLowerCase()] || raw.toLowerCase().slice(0, 2);
}

/**
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
export function normalizeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * @param {string|null|undefined} currency
 * @returns {string|null}
 */
export function normalizeCurrency(currency) {
  if (!currency) return null;
  const raw = String(currency).trim();
  if (!raw) return null;
  if (/^[A-Za-z]{3}$/.test(raw)) return raw.toUpperCase();
  return CURRENCY_ALIASES[raw.toLowerCase()] || raw.toUpperCase();
}

/**
 * Normalize common industrial units to a short code.
 * @param {string|null|undefined} unit
 * @returns {string|null}
 */
export function normalizeUnit(unit) {
  if (!unit) return null;
  const u = String(unit).trim().toLowerCase();
  const map = {
    'square meters': 'm2',
    'sq m': 'm2',
    m2: 'm2',
    'square feet': 'ft2',
    sqft: 'ft2',
    tons: 't',
    tonnes: 't',
    kg: 'kg',
    liters: 'L',
    litres: 'L',
    mw: 'MW',
    kw: 'kW',
  };
  return map[u] || unit.trim();
}

/**
 * @param {string|null|undefined} phone
 * @returns {string|null}
 */
export function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/[^\d+]/g, '');
  if (digits.replace(/\D/g, '').length < 7) return null;
  return digits;
}

/**
 * @param {string|null|undefined} email
 * @returns {string|null}
 */
export function normalizeEmail(email) {
  if (!email) return null;
  const e = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null;
  // Ban obvious fabricated patterns (align with enrichLead spirit)
  if (/^(info|contact|sales|admin)@example\./.test(e)) return null;
  return e;
}

/**
 * @param {string[]|string|null|undefined} sectors
 * @returns {string[]}
 */
export function normalizeSectors(sectors) {
  if (!sectors) return [];
  const list = Array.isArray(sectors) ? sectors : String(sectors).split(/[|;,]/);
  const seen = new Set();
  const out = [];
  for (const s of list) {
    const n = String(s || '')
      .toLowerCase()
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

/**
 * @param {DiscoveryEventType} eventType
 * @param {string} observedAt
 * @returns {string}
 */
export function defaultExpiresAt(eventType, observedAt) {
  const days = EVENT_SOFT_EXPIRY_DAYS[eventType] ?? 120;
  const base = new Date(observedAt);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString();
}

/**
 * @param {number|string|null|undefined} amount
 * @param {string|null} currency
 * @returns {number|null} coarse USD band midpoint estimate (marked via null when unknown)
 */
export function normalizeAmountToUsdBand(amount, currency) {
  if (amount == null || amount === '') return null;
  const n = typeof amount === 'number' ? amount : Number(String(amount).replace(/[,\s]/g, ''));
  if (!Number.isFinite(n)) return null;
  const cur = currency || 'USD';
  // Framework rates only — estimate band, not FX truth
  const rates = { USD: 1, EUR: 1.08, GBP: 1.27, CNY: 0.14, MXN: 0.055 };
  const usd = n * (rates[cur] ?? 1);
  if (usd >= 2_000_000) return 2_000_000;
  if (usd >= 500_000) return 500_000;
  if (usd >= 100_000) return 100_000;
  return Math.round(usd);
}

/**
 * @param {ParsedRecord} record
 * @param {SourceMetadata} source
 * @returns {NormalizedRecord|null}
 */
export function normalizeRecord(record, source) {
  const company_name = String(record.company_name || '').trim();
  if (!company_name) return null;

  const event_type = normalizeEventType(record.event_type || 'other');
  const observed_at = normalizeDate(record.observed_at) || new Date().toISOString();
  const website = normalizeWebsite(record.website);
  const domain = normalizeDomain(record.website, record.domain);
  const currency = normalizeCurrency(record.currency);
  const claim = String(record.claim || '').trim() || `${company_name}: ${event_type} observed`;

  let confidence =
    typeof record.confidence === 'number' && Number.isFinite(record.confidence)
      ? record.confidence
      : typeof source.source_weight === 'number'
        ? source.source_weight * 0.7
        : 0.55;
  confidence = Math.max(0, Math.min(1, confidence));

  return {
    company_name,
    normalized_name: normalizeCompanyName(company_name),
    website,
    domain,
    country: normalizeCountry(record.country),
    language: normalizeLanguage(record.language),
    phone: normalizePhone(record.phone),
    email: normalizeEmail(record.email),
    sectors: normalizeSectors(record.sectors),
    claim,
    event_type,
    artifact_url: record.artifact_url ? String(record.artifact_url).trim() : null,
    observed_at,
    expires_at: normalizeDate(record.expires_at) || defaultExpiresAt(event_type, observed_at),
    confidence,
    currency,
    amount_usd_band: normalizeAmountToUsdBand(record.amount, currency),
    unit: normalizeUnit(record.unit),
    raw_excerpt: record.raw_excerpt ? String(record.raw_excerpt).slice(0, 500) : claim.slice(0, 500),
    manual_attestation: Boolean(record.manual_attestation),
    attested_by: record.attested_by ? String(record.attested_by) : null,
    registration_number: record.registration_number
      ? String(record.registration_number).trim().toUpperCase()
      : null,
    source,
  };
}

/**
 * Duplicate key helpers for company matching (docs/33 Company duplicate rules).
 * @param {{ domain?: string|null, normalized_name?: string, country?: string|null }} c
 */
export function companyMatchKeys(c) {
  const country = (c.country || '').toLowerCase();
  const keys = [];
  if (c.domain) keys.push(`domain:${c.domain.toLowerCase()}::${country}`);
  if (c.normalized_name) keys.push(`name:${c.normalized_name}::${country}`);
  return keys;
}
