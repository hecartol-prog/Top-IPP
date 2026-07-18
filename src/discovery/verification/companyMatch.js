/**
 * Company matching — attach evidence to existing Company or create observed/unverified.
 * NEVER overwrite existing Company fields. NEVER auto-merge when uncertain.
 */

import { companyMatchKeys, normalizeCompanyName, normalizeDomain } from '../normalization/index.js';

/**
 * @typedef {import('../types.js').NormalizedRecord} NormalizedRecord
 * @typedef {import('../types.js').CompanyRecord} CompanyRecord
 */

/**
 * @typedef {Object} CompanyRepository
 * @property {() => Promise<CompanyRecord[]>} list
 * @property {(data: Omit<CompanyRecord, 'id'> & { id?: string }) => Promise<CompanyRecord>} create
 */

/**
 * @param {CompanyRecord[]} companies
 * @param {NormalizedRecord} record
 * @returns {{ match: CompanyRecord|null, confidence: 'exact'|'none', reason: string }}
 */
export function findCompanyMatch(companies, record) {
  const domain = record.domain;
  const country = (record.country || '').toLowerCase();
  const normName = record.normalized_name || normalizeCompanyName(record.company_name);

  // Absolute: domain + country when domain present
  if (domain) {
    const exactDomain = companies.find((c) => {
      const cDomain = c.domain || normalizeDomain(c.website, c.domain);
      if (!cDomain || cDomain.toLowerCase() !== domain.toLowerCase()) return false;
      const cCountry = (c.country || '').toLowerCase();
      // If either side lacks country, domain-only match is allowed (single-tenant industrial lists)
      if (!country || !cCountry) return true;
      return cCountry === country;
    });
    if (exactDomain) {
      return { match: exactDomain, confidence: 'exact', reason: 'domain_match' };
    }
  }

  // Soft: normalized_name + country
  const nameMatches = companies.filter((c) => {
    const nn = c.normalized_name || normalizeCompanyName(c.name);
    if (nn !== normName) return false;
    const cCountry = (c.country || '').toLowerCase();
    if (!country || !cCountry) return true;
    return cCountry === country;
  });

  if (nameMatches.length === 1) {
    return { match: nameMatches[0], confidence: 'exact', reason: 'normalized_name_match' };
  }

  if (nameMatches.length > 1) {
    // Uncertain — do not merge
    return { match: null, confidence: 'none', reason: 'ambiguous_name_matches' };
  }

  return { match: null, confidence: 'none', reason: 'no_match' };
}

/**
 * @param {CompanyRepository} repo
 * @param {NormalizedRecord} record
 * @returns {Promise<{ company: CompanyRecord, created: boolean, reason: string }>}
 */
export async function matchOrCreateCompany(repo, record) {
  const companies = await repo.list();
  const { match, reason } = findCompanyMatch(companies, record);

  if (match) {
    // Never overwrite existing Company
    return { company: match, created: false, reason };
  }

  if (reason === 'ambiguous_name_matches') {
    // Create separate observed company rather than merging uncertain duplicates
    // (docs/12: never merge on name alone when uncertain)
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
    tags: record.sectors.length ? [...record.sectors] : undefined,
  });

  return { company: created, created: true, reason: 'created_unverified_observed' };
}

export { companyMatchKeys };
