/**
 * Evidence validation — reject duplicates, expired, invalid URL, missing company, low confidence.
 */

import { CONFIDENCE_THRESHOLD } from '../types.js';

/**
 * @typedef {import('../types.js').EvidenceRecord} EvidenceRecord
 * @typedef {'active'|'expired'|'quarantined'} EvidenceStatus
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} accepted
 * @property {EvidenceStatus} status
 * @property {string} reason
 * @property {EvidenceRecord} [evidence]
 */

/**
 * @param {string|undefined} url
 * @returns {boolean}
 */
export function isValidArtifactUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * @param {EvidenceRecord} evidence
 * @param {EvidenceRecord[]} existing
 * @param {{ confidenceThreshold?: number, now?: Date }} [opts]
 * @returns {ValidationResult}
 */
export function validateEvidence(evidence, existing = [], opts = {}) {
  const threshold = opts.confidenceThreshold ?? CONFIDENCE_THRESHOLD;
  const now = opts.now ?? new Date();

  if (!evidence.company_id) {
    return { accepted: false, status: 'quarantined', reason: 'missing_company' };
  }

  const hasArtifact = Boolean(evidence.artifact_url);
  const hasAttestation = Boolean(evidence.manual_attestation && evidence.attested_by);
  if (!hasArtifact && !hasAttestation) {
    return { accepted: false, status: 'quarantined', reason: 'missing_provenance' };
  }

  if (hasArtifact && !isValidArtifactUrl(evidence.artifact_url)) {
    return { accepted: false, status: 'quarantined', reason: 'invalid_url' };
  }

  if (typeof evidence.confidence !== 'number' || evidence.confidence < threshold) {
    return {
      accepted: false,
      status: 'quarantined',
      reason: 'confidence_below_threshold',
      evidence: { ...evidence, status: 'quarantined' },
    };
  }

  if (evidence.expires_at) {
    const exp = new Date(evidence.expires_at);
    if (!Number.isNaN(exp.getTime()) && exp.getTime() < now.getTime()) {
      return {
        accepted: false,
        status: 'expired',
        reason: 'expired_evidence',
        evidence: { ...evidence, status: 'expired' },
      };
    }
  }

  const dup = existing.find((e) => {
    if (e.artifact_hash && evidence.artifact_hash && e.artifact_hash === evidence.artifact_hash) {
      return true;
    }
    if (
      e.company_id === evidence.company_id &&
      e.claim === evidence.claim &&
      (e.artifact_url || '') === (evidence.artifact_url || '')
    ) {
      return true;
    }
    return false;
  });

  if (dup) {
    return { accepted: false, status: 'quarantined', reason: 'duplicate_evidence' };
  }

  if (!evidence.claim || !String(evidence.claim).trim()) {
    return { accepted: false, status: 'quarantined', reason: 'missing_claim' };
  }

  if (!evidence.source_type) {
    return { accepted: false, status: 'quarantined', reason: 'missing_source_type' };
  }

  return {
    accepted: true,
    status: 'active',
    reason: 'ok',
    evidence: { ...evidence, status: 'active' },
  };
}
