/**
 * Deduplication — mark duplicates; never delete data (Sprint 2.2).
 */

import { hashClaim } from '../pipeline/extractEvidence.js';
import { normalizeCompanyName, normalizeDomain, normalizeWebsite } from '../normalization/index.js';
import { companyRegistrationNumber } from './companyMatch.js';

/**
 * @typedef {import('../types.js').CompanyRecord} CompanyRecord
 * @typedef {import('../types.js').EvidenceRecord} EvidenceRecord
 * @typedef {import('../types.js').RawDocument} RawDocument
 */

/**
 * @typedef {Object} DedupeMark
 * @property {'company'|'evidence'|'source_url'|'document'|'claim'} kind
 * @property {string} id
 * @property {string} duplicate_of_id
 * @property {string} reason
 */

/**
 * @param {CompanyRecord[]} companies
 * @returns {{ marks: DedupeMark[], companies: CompanyRecord[] }}
 */
export function markDuplicateCompanies(companies) {
  /** @type {DedupeMark[]} */
  const marks = [];
  const byDomain = new Map();
  const byReg = new Map();
  const byNorm = new Map();

  for (const c of companies) {
    if (c.duplicate_of_id || c.duplicate_marked) continue;
    const domain = c.domain || normalizeDomain(c.website, c.domain);
    const country = (c.country || '').toLowerCase();
    if (domain) {
      const key = `${domain.toLowerCase()}::${country}`;
      if (byDomain.has(key)) {
        const canonical = byDomain.get(key);
        c.duplicate_marked = true;
        c.duplicate_of_id = canonical.id;
        marks.push({
          kind: 'company',
          id: c.id,
          duplicate_of_id: canonical.id,
          reason: 'domain_country',
        });
        continue;
      }
      byDomain.set(key, c);
    }
    const reg = companyRegistrationNumber(c);
    if (reg) {
      if (byReg.has(reg)) {
        const canonical = byReg.get(reg);
        c.duplicate_marked = true;
        c.duplicate_of_id = canonical.id;
        marks.push({
          kind: 'company',
          id: c.id,
          duplicate_of_id: canonical.id,
          reason: 'registration_number',
        });
        continue;
      }
      byReg.set(reg, c);
    }
    const nn = c.normalized_name || normalizeCompanyName(c.name);
    const nkey = `${nn}::${country}`;
    if (nn && byNorm.has(nkey)) {
      // Soft mark only when domain also aligns or both lack domain — still mark, do not merge
      const canonical = byNorm.get(nkey);
      const cDomain = domain;
      const canDomain = canonical.domain || normalizeDomain(canonical.website, canonical.domain);
      if (cDomain && canDomain && cDomain === canDomain) {
        c.duplicate_marked = true;
        c.duplicate_of_id = canonical.id;
        marks.push({
          kind: 'company',
          id: c.id,
          duplicate_of_id: canonical.id,
          reason: 'normalized_name_domain',
        });
      }
      continue;
    }
    if (nn) byNorm.set(nkey, c);
  }

  return { marks, companies };
}

/**
 * @param {EvidenceRecord[]} evidence
 * @returns {{ marks: DedupeMark[], evidence: EvidenceRecord[] }}
 */
export function markDuplicateEvidence(evidence) {
  /** @type {DedupeMark[]} */
  const marks = [];
  const byHash = new Map();
  const byClaimUrl = new Map();

  for (const e of evidence) {
    if (e.status === 'quarantined' && e.extractor?.includes('duplicate')) continue;
    const hash = e.artifact_hash || hashClaim(`${e.artifact_url || ''}|${e.claim}`);
    if (byHash.has(hash)) {
      const canonical = byHash.get(hash);
      e.status = 'quarantined';
      e.extractor = `${e.extractor || ''}|duplicate_of:${canonical.id || 'unknown'}`;
      marks.push({
        kind: 'evidence',
        id: e.id || hash,
        duplicate_of_id: canonical.id || 'unknown',
        reason: 'artifact_hash',
      });
      continue;
    }
    byHash.set(hash, e);

    const ck = `${e.company_id}|${e.claim}|${e.artifact_url || ''}`;
    if (byClaimUrl.has(ck)) {
      const canonical = byClaimUrl.get(ck);
      e.status = 'quarantined';
      e.extractor = `${e.extractor || ''}|duplicate_of:${canonical.id || 'unknown'}`;
      marks.push({
        kind: 'claim',
        id: e.id || ck,
        duplicate_of_id: canonical.id || 'unknown',
        reason: 'claim_url',
      });
      continue;
    }
    byClaimUrl.set(ck, e);
  }

  return { marks, evidence };
}

/**
 * @param {string[]} urls
 * @returns {{ unique: string[], duplicates: string[] }}
 */
export function dedupeSourceUrls(urls) {
  const seen = new Set();
  const unique = [];
  const duplicates = [];
  for (const u of urls) {
    const key = normalizeWebsite(u) || String(u).trim().toLowerCase();
    if (!key) continue;
    if (seen.has(key)) {
      duplicates.push(u);
    } else {
      seen.add(key);
      unique.push(u);
    }
  }
  return { unique, duplicates };
}

/**
 * @param {RawDocument[]} docs
 * @returns {{ marks: DedupeMark[], documents: RawDocument[] }}
 */
export function markDuplicateDocuments(docs) {
  /** @type {DedupeMark[]} */
  const marks = [];
  const seen = new Map();
  for (const d of docs) {
    const key = `${d.url || ''}|${typeof d.content === 'string' ? d.content.slice(0, 200) : JSON.stringify(d.content).slice(0, 200)}`;
    const h = hashClaim(key);
    if (seen.has(h)) {
      marks.push({
        kind: 'document',
        id: d.id,
        duplicate_of_id: seen.get(h),
        reason: 'content_fingerprint',
      });
    } else {
      seen.set(h, d.id);
    }
  }
  return { marks, documents: docs };
}
