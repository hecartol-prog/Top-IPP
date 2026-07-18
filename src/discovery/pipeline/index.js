/**
 * Discovery Pipeline — modular stages, independently testable.
 *
 * 1 Discovery Source → 2 Raw Document → 3 Parser → 4 Normalization
 * → 5 Company Match → 6 Evidence Extraction → 7 Evidence Validation
 * → 8 Store Evidence → 9 Trigger Inbox Candidate
 *
 * MUST NOT: create Opportunity, BuyingSignal, scores, recommendations, emails.
 */

import { runAdapter } from '../adapters/index.js';
import { parseRawDocument } from '../parser/index.js';
import { normalizeRecord } from '../normalization/index.js';
import { matchOrCreateCompany } from '../verification/companyMatch.js';
import { extractEvidence } from './extractEvidence.js';
import { validateEvidence } from '../verification/validateEvidence.js';
import { triggerInboxCandidate } from '../services/inboxCandidate.js';
import { PipelineLogger } from './logger.js';

/**
 * @typedef {import('../types.js').AdapterKind} AdapterKind
 * @typedef {import('../adapters/index.js').AdapterInput} AdapterInput
 * @typedef {import('../types.js').RawDocument} RawDocument
 * @typedef {import('../types.js').StageLogEntry} StageLogEntry
 */

/**
 * @typedef {Object} DiscoveryRepos
 * @property {{ list: Function, create: Function }} companies
 * @property {{ list: Function, create: Function }} evidence
 * @property {{ list: Function, create: Function }} inbox
 */

/**
 * @typedef {Object} PipelineResult
 * @property {RawDocument|null} rawDocument
 * @property {object[]} parsed
 * @property {object[]} normalized
 * @property {object[]} companies
 * @property {object[]} evidenceStored
 * @property {object[]} evidenceRejected
 * @property {object[]} inboxItems
 * @property {StageLogEntry[]} logs
 * @property {boolean} ok
 */

/**
 * Run a single pipeline stage helper for tests.
 */
export const stages = {
  async discoverySource(kind, input) {
    return runAdapter(kind, input);
  },
  parse: parseRawDocument,
  normalize: normalizeRecord,
  matchCompany: matchOrCreateCompany,
  extractEvidence,
  validateEvidence,
  triggerInbox: triggerInboxCandidate,
};

/**
 * @param {Object} options
 * @param {AdapterKind} options.adapterKind
 * @param {AdapterInput} options.adapterInput
 * @param {DiscoveryRepos} options.repos
 * @param {PipelineLogger} [options.logger]
 * @param {number} [options.confidenceThreshold]
 * @returns {Promise<PipelineResult>}
 */
export async function runDiscoveryPipeline(options) {
  const logger = options.logger || new PipelineLogger();
  const repos = options.repos;

  /** @type {PipelineResult} */
  const result = {
    rawDocument: null,
    parsed: [],
    normalized: [],
    companies: [],
    evidenceStored: [],
    evidenceRejected: [],
    inboxItems: [],
    logs: [],
    ok: true,
  };

  // Stage 1–2: Discovery Source → Raw Document
  let raw;
  try {
    raw = await stages.discoverySource(options.adapterKind, options.adapterInput);
    result.rawDocument = raw;
    logger.log({
      stage: 'discovery_source',
      source: raw.source.source_id,
      result: 'ok',
      message: `adapter=${raw.source.adapter_kind}`,
    });
    logger.log({
      stage: 'raw_document',
      source: raw.source.source_id,
      result: 'ok',
      message: `id=${raw.id}`,
    });
  } catch (err) {
    result.ok = false;
    logger.log({
      stage: 'discovery_source',
      result: 'error',
      message: String(err?.message || err),
      error: err,
    });
    result.logs = logger.entries;
    return result;
  }

  // Stage 3: Parser
  let parsed = [];
  try {
    parsed = stages.parse(raw);
    result.parsed = parsed;
    logger.log({
      stage: 'parser',
      source: raw.source.source_id,
      result: parsed.length ? 'ok' : 'skip',
      message: `records=${parsed.length}`,
    });
  } catch (err) {
    result.ok = false;
    logger.log({
      stage: 'parser',
      source: raw.source.source_id,
      result: 'error',
      message: String(err?.message || err),
      error: err,
    });
    result.logs = logger.entries;
    return result;
  }

  for (const record of parsed) {
    // Stage 4: Normalization
    let normalized;
    try {
      normalized = stages.normalize(record, raw.source);
      if (!normalized) {
        logger.log({
          stage: 'normalization',
          source: raw.source.source_id,
          result: 'reject',
          message: 'missing_company_name',
        });
        continue;
      }
      result.normalized.push(normalized);
      logger.log({
        stage: 'normalization',
        source: raw.source.source_id,
        company: normalized.company_name,
        result: 'ok',
        message: `domain=${normalized.domain || 'none'}`,
      });
    } catch (err) {
      logger.log({
        stage: 'normalization',
        source: raw.source.source_id,
        result: 'error',
        message: String(err?.message || err),
        error: err,
      });
      continue;
    }

    // Stage 5: Company Match
    let companyResult;
    try {
      companyResult = await stages.matchCompany(repos.companies, normalized);
      result.companies.push(companyResult);
      logger.log({
        stage: 'company_match',
        source: raw.source.source_id,
        company: companyResult.company.name,
        result: 'ok',
        message: `${companyResult.created ? 'created' : 'matched'}:${companyResult.reason}`,
      });
    } catch (err) {
      logger.log({
        stage: 'company_match',
        source: raw.source.source_id,
        company: normalized.company_name,
        result: 'error',
        message: String(err?.message || err),
        error: err,
      });
      continue;
    }

    // Stage 6: Evidence Extraction
    let evidenceDraft;
    try {
      evidenceDraft = stages.extractEvidence(normalized, companyResult.company);
      if (!evidenceDraft) {
        logger.log({
          stage: 'evidence_extraction',
          source: raw.source.source_id,
          company: companyResult.company.name,
          result: 'reject',
          message: 'no_provenance',
        });
        continue;
      }
      logger.log({
        stage: 'evidence_extraction',
        source: raw.source.source_id,
        company: companyResult.company.name,
        evidence: evidenceDraft.claim.slice(0, 80),
        result: 'ok',
        message: `event=${evidenceDraft.discovery_event_type}`,
      });
    } catch (err) {
      logger.log({
        stage: 'evidence_extraction',
        source: raw.source.source_id,
        company: companyResult.company.name,
        result: 'error',
        message: String(err?.message || err),
        error: err,
      });
      continue;
    }

    // Stage 7: Evidence Validation
    const existing = await repos.evidence.list({ company_id: companyResult.company.id });
    const validation = stages.validateEvidence(evidenceDraft, existing, {
      confidenceThreshold: options.confidenceThreshold,
    });

    if (!validation.accepted) {
      result.evidenceRejected.push({ evidence: evidenceDraft, reason: validation.reason, status: validation.status });
      // Persist expired/quarantined for audit when status set
      if (validation.evidence && (validation.status === 'expired' || validation.status === 'quarantined')) {
        if (validation.reason === 'duplicate_evidence') {
          // do not store duplicates
        } else if (
          validation.reason === 'confidence_below_threshold' ||
          validation.reason === 'expired_evidence'
        ) {
          const storedBad = await repos.evidence.create(validation.evidence);
          result.evidenceRejected[result.evidenceRejected.length - 1].stored = storedBad;
        }
      }
      logger.log({
        stage: 'evidence_validation',
        source: raw.source.source_id,
        company: companyResult.company.name,
        evidence: evidenceDraft.claim.slice(0, 80),
        result: 'reject',
        message: validation.reason,
      });
      continue;
    }

    logger.log({
      stage: 'evidence_validation',
      source: raw.source.source_id,
      company: companyResult.company.name,
      evidence: evidenceDraft.claim.slice(0, 80),
      result: 'ok',
      message: 'active',
    });

    // Stage 8: Store Evidence
    let stored;
    try {
      stored = await repos.evidence.create(validation.evidence);
      result.evidenceStored.push(stored);
      logger.log({
        stage: 'store_evidence',
        source: raw.source.source_id,
        company: companyResult.company.name,
        evidence: stored.id || stored.claim?.slice(0, 80),
        result: 'ok',
        message: `status=${stored.status}`,
      });
    } catch (err) {
      logger.log({
        stage: 'store_evidence',
        source: raw.source.source_id,
        company: companyResult.company.name,
        result: 'error',
        message: String(err?.message || err),
        error: err,
      });
      continue;
    }

    // Stage 9: Trigger Inbox Candidate (pending only — no Opportunity)
    try {
      const inbox = await stages.triggerInbox(repos.inbox, companyResult.company, stored);
      if (inbox.item) result.inboxItems.push(inbox.item);
      logger.log({
        stage: 'inbox_candidate',
        source: raw.source.source_id,
        company: companyResult.company.name,
        evidence: stored.id || stored.claim?.slice(0, 80),
        result: inbox.created ? 'ok' : 'skip',
        message: inbox.reason,
      });
    } catch (err) {
      logger.log({
        stage: 'inbox_candidate',
        source: raw.source.source_id,
        company: companyResult.company.name,
        result: 'error',
        message: String(err?.message || err),
        error: err,
      });
    }
  }

  result.logs = logger.entries;
  result.ok = !logger.entries.some((e) => e.result === 'error');
  return result;
}
