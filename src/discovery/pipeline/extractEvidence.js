/**
 * Evidence extraction — create Evidence candidates only (no BuyingSignal, no Opportunity).
 */

import { EVENT_TO_EVIDENCE_TYPE, EXTRACTOR_ID } from '../types.js';

/**
 * @typedef {import('../types.js').NormalizedRecord} NormalizedRecord
 * @typedef {import('../types.js').EvidenceRecord} EvidenceRecord
 * @typedef {import('../types.js').CompanyRecord} CompanyRecord
 */

/**
 * Simple stable hash for duplicate detection (artifact_url + claim).
 * @param {string} input
 * @returns {string}
 */
export function hashClaim(input) {
  let h = 2166136261;
  const s = String(input);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `h${(h >>> 0).toString(16)}`;
}

/**
 * @param {NormalizedRecord} record
 * @param {CompanyRecord} company
 * @returns {EvidenceRecord|null}
 */
export function extractEvidence(record, company) {
  if (!company?.id) return null;

  const hasArtifact = Boolean(record.artifact_url);
  const hasAttestation = Boolean(record.manual_attestation && record.attested_by);
  if (!hasArtifact && !hasAttestation) {
    return null; // No evidence without provenance
  }

  const evidenceType = EVENT_TO_EVIDENCE_TYPE[record.event_type] || 'media';
  const claim = record.claim;
  const artifact_hash = hashClaim(`${record.artifact_url || 'attestation'}|${claim}`);

  return {
    company_id: company.id,
    type: evidenceType,
    claim,
    source_type: record.source.source_type,
    artifact_url: record.artifact_url || undefined,
    artifact_hash,
    source_weight: record.source.source_weight,
    confidence: record.confidence,
    observed_at: record.observed_at,
    expires_at: record.expires_at || undefined,
    extractor: `${EXTRACTOR_ID}|event:${record.event_type}`,
    raw_excerpt: record.raw_excerpt || undefined,
    manual_attestation: hasAttestation ? true : undefined,
    attested_by: hasAttestation ? record.attested_by || undefined : undefined,
    status: 'active',
    discovery_event_type: record.event_type,
  };
}
