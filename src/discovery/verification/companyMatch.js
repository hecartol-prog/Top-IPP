/**
 * Company matching — priority (Sprint 2.2):
 * 1 Domain → 2 Website → 3 Registration Number → 4 Exact Name → 5 Normalized Name
 * Never merge automatically below confidence threshold. Create new Company instead.
 * NEVER overwrite existing Company fields.
 */

import {
  normalizeCompanyName,
  normalizeDomain,
  normalizeWebsite,
} from '../normalization/index.js';
import { MATCH_SCORES } from '../types.js';
import { COMPANY_MATCH_CONFIDENCE_THRESHOLD } from '../registry/types.js';

/**
 * @typedef {import('../types.js').NormalizedRecord} NormalizedRecord
 * @typedef {import('../types.js').CompanyRecord} CompanyRecord
 */

/**
 * @typedef {Object} CompanyRepository
 * @property {() => Promise<CompanyRecord[]>} list
 * @property {(data: Omit<CompanyRecord, 'id'> & { id?: string }) => Promise<CompanyRecord>} create
 * @property {(id: string, patch: Partial<CompanyRecord>) => Promise<CompanyRecord>} [update]
 */

/**
 * @param {CompanyRecord} c
 * @returns {string|null}
 */
export function companyRegistrationNumber(c) {
  if (c.registration_number) return String(c.registration_number).trim().toUpperCase();
  const tag = (c.tags || []).find((t) => String(t).startsWith('reg:'));
  return tag ? String(tag).slice(4).trim().toUpperCase() : null;
}

/**
 * @param {CompanyRecord[]} companies
 * @param {NormalizedRecord} record
 * @param {{ threshold?: number }} [opts]
 * @returns {{ match: CompanyRecord|null, confidence: number, reason: string }}
 */
export function findCompanyMatch(companies, record, opts = {}) {
  const threshold = opts.threshold ?? COMPANY_MATCH_CONFIDENCE_THRESHOLD;
  const domain = record.domain;
  const website = record.website;
  const country = (record.country || '').toLowerCase();
  const normName = record.normalized_name || normalizeCompanyName(record.company_name);
  const exactName = String(record.company_name || '').trim().toLowerCase();
  const reg = record.registration_number
    ? String(record.registration_number).trim().toUpperCase()
    : null;

  /** @type {{ match: CompanyRecord, confidence: number, reason: string }[]} */
  const candidates = [];

  // 1 Domain
  if (domain) {
    for (const c of companies) {
      const cDomain = c.domain || normalizeDomain(c.website, c.domain);
      if (!cDomain || cDomain.toLowerCase() !== domain.toLowerCase()) continue;
      const cCountry = (c.country || '').toLowerCase();
      if (country && cCountry && country !== cCountry) continue;
      candidates.push({ match: c, confidence: MATCH_SCORES.domain, reason: 'domain_match' });
    }
  }

  // 2 Website
  if (website) {
    const nw = normalizeWebsite(website);
    for (const c of companies) {
      const cw = normalizeWebsite(c.website);
      if (nw && cw && nw === cw) {
        candidates.push({ match: c, confidence: MATCH_SCORES.website, reason: 'website_match' });
      }
    }
  }

  // 3 Registration number
  if (reg) {
    for (const c of companies) {
      const cr = companyRegistrationNumber(c);
      if (cr && cr === reg) {
        candidates.push({
          match: c,
          confidence: MATCH_SCORES.registration_number,
          reason: 'registration_number_match',
        });
      }
    }
  }

  // 4 Exact name (+ country when both present)
  for (const c of companies) {
    if (String(c.name || '').trim().toLowerCase() !== exactName) continue;
    const cCountry = (c.country || '').toLowerCase();
    if (country && cCountry && country !== cCountry) continue;
    candidates.push({ match: c, confidence: MATCH_SCORES.exact_name, reason: 'exact_name_match' });
  }

  // 5 Normalized name (+ country)
  const nameMatches = companies.filter((c) => {
    const nn = c.normalized_name || normalizeCompanyName(c.name);
    if (nn !== normName) return false;
    const cCountry = (c.country || '').toLowerCase();
    if (!country || !cCountry) return true;
    return cCountry === country;
  });

  if (nameMatches.length === 1) {
    candidates.push({
      match: nameMatches[0],
      confidence: MATCH_SCORES.normalized_name,
      reason: 'normalized_name_match',
    });
  } else if (nameMatches.length > 1) {
    return { match: null, confidence: 0, reason: 'ambiguous_name_matches' };
  }

  if (!candidates.length) {
    return { match: null, confidence: 0, reason: 'no_match' };
  }

  // Highest confidence wins; if multiple distinct companies at top — uncertain
  candidates.sort((a, b) => b.confidence - a.confidence);
  const best = candidates[0];
  const bestIds = new Set(
    candidates.filter((c) => c.confidence === best.confidence).map((c) => c.match.id)
  );
  if (bestIds.size > 1) {
    return { match: null, confidence: best.confidence, reason: 'ambiguous_high_confidence_matches' };
  }

  if (best.confidence < threshold) {
    return { match: null, confidence: best.confidence, reason: 'below_match_threshold' };
  }

  return best;
}

/**
 * @param {CompanyRepository} repo
 * @param {NormalizedRecord} record
 * @param {{ threshold?: number }} [opts]
 * @returns {Promise<{ company: CompanyRecord, created: boolean, reason: string, confidence: number }>}
 */
export async function matchOrCreateCompany(repo, record, opts = {}) {
  const companies = await repo.list();
  const { match, reason, confidence } = findCompanyMatch(companies, record, opts);

  if (match) {
    return { company: match, created: false, reason, confidence };
  }

  const tags = record.sectors.length ? [...record.sectors] : [];
  if (record.registration_number) {
    tags.push(`reg:${record.registration_number}`);
  }

  const created = await repo.create({
    name: record.company_name,
    normalized_name: record.normalized_name,
    website: record.website || undefined,
    domain: record.domain || undefined,
    country: record.country || undefined,
    industry_raw: record.sectors.length ? record.sectors.join('; ') : undefined,
    verification_status: 'unverified',
    path_a_status: 'observed',
    source_provenance: record.source.source_type,
    tags: tags.length ? tags : undefined,
    registration_number: record.registration_number || undefined,
  });

  return {
    company: created,
    created: true,
    reason: reason.startsWith('ambiguous') || reason === 'below_match_threshold'
      ? `created_due_to_${reason}`
      : 'created_unverified_observed',
    confidence: 0,
  };
}
