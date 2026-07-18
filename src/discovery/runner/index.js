/**
 * Production connector runner — registry → connector → discovery pipeline.
 * Survives per-source failures; continues remaining sources.
 * Logs connector metrics every run.
 */

import { runConnector } from '../connectors/index.js';
import { runDiscoveryPipeline } from '../pipeline/index.js';
import { PipelineLogger } from '../pipeline/logger.js';
import { markDuplicateCompanies, markDuplicateEvidence, dedupeSourceUrls } from '../verification/dedupe.js';
import { createSourceRegistry } from '../registry/index.js';

/**
 * @typedef {import('../registry/types.js').SourceRegistryEntry} SourceRegistryEntry
 * @typedef {import('../pipeline/index.js').DiscoveryRepos} DiscoveryRepos
 * @typedef {import('../registry/index.js').SourceRegistry} SourceRegistry
 */

/**
 * @typedef {Object} SourceRunMetrics
 * @property {string} connector
 * @property {string} source
 * @property {number} duration_ms
 * @property {number} records_read
 * @property {number} companies_created
 * @property {number} companies_matched
 * @property {number} evidence_created
 * @property {number} duplicates
 * @property {number} errors
 * @property {string|null} error
 * @property {boolean} ok
 */

/**
 * @typedef {Object} ConnectorRunReport
 * @property {boolean} ok
 * @property {SourceRunMetrics[]} sources
 * @property {object} totals
 * @property {object[]} inboxItems
 * @property {number} duration_ms
 */

/**
 * Map connector type → pipeline adapter kind for RawDocument already fetched.
 * Pipeline stage 1 is skipped when rawDocument is provided.
 * @param {import('../types.js').RawDocument} doc
 * @param {DiscoveryRepos} repos
 * @param {PipelineLogger} logger
 */
async function pipelineFromDocument(doc, repos, logger) {
  return runDiscoveryPipeline({
    adapterKind: doc.source.adapter_kind,
    adapterInput: {
      source_id: doc.source.source_id,
      source_type: doc.source.source_type,
      source_weight: doc.source.source_weight,
      label: doc.source.label,
      url: doc.url,
      payload: doc.content,
      content_type: doc.content_type,
    },
    repos,
    logger,
  });
}

/**
 * @param {Object} options
 * @param {DiscoveryRepos} options.repos
 * @param {SourceRegistry} [options.registry]
 * @param {SourceRegistryEntry[]} [options.sources] - explicit subset
 * @param {Record<string, import('../connectors/index.js').ConnectorContext>} [options.payloads] - source_id → ctx
 * @param {string} [options.vertical_pack]
 * @returns {Promise<ConnectorRunReport>}
 */
export async function runProductionConnectors(options) {
  const started = Date.now();
  const registry = options.registry || createSourceRegistry();
  const sources =
    options.sources ||
    registry.list({
      enabledOnly: true,
      vertical_pack: options.vertical_pack,
    });

  /** @type {SourceRunMetrics[]} */
  const sourceMetrics = [];
  /** @type {object[]} */
  const allInbox = [];
  let totalErrors = 0;

  for (const source of sources) {
    const t0 = Date.now();
    /** @type {SourceRunMetrics} */
    const metrics = {
      connector: source.type,
      source: source.id,
      duration_ms: 0,
      records_read: 0,
      companies_created: 0,
      companies_matched: 0,
      evidence_created: 0,
      duplicates: 0,
      errors: 0,
      error: null,
      ok: false,
    };

    try {
      const ctx = (options.payloads && options.payloads[source.id]) || {};
      const fetched = await runConnector(source, ctx);

      if (!fetched.ok || !fetched.document) {
        metrics.errors = 1;
        metrics.error = fetched.error || 'connector_failed';
        totalErrors += 1;
        try {
          registry.markError(source.id, metrics.error);
        } catch {
          /* registry may be read-only snapshot */
        }
        metrics.duration_ms = Date.now() - t0;
        sourceMetrics.push(metrics);
        continue;
      }

      const logger = new PipelineLogger();
      const result = await pipelineFromDocument(fetched.document, options.repos, logger);

      metrics.records_read = result.parsed.length;
      metrics.companies_created = result.companies.filter((c) => c.created).length;
      metrics.companies_matched = result.companies.filter((c) => !c.created).length;
      metrics.evidence_created = result.evidenceStored.length;
      metrics.duplicates = result.evidenceRejected.filter((r) => r.reason === 'duplicate_evidence').length;
      metrics.errors = result.logs.filter((l) => l.result === 'error').length;
      metrics.ok = result.ok && metrics.errors === 0;
      if (!metrics.ok && metrics.errors === 0 && result.parsed.length === 0 && result.evidenceStored.length === 0) {
        // Empty parse is not a crash — ok if connector succeeded
        metrics.ok = fetched.ok;
      }

      allInbox.push(...result.inboxItems);

      if (metrics.ok || result.evidenceStored.length > 0) {
        try {
          registry.markSuccess(source.id);
        } catch {
          /* ignore */
        }
      } else if (metrics.error || metrics.errors) {
        try {
          registry.markError(source.id, metrics.error || 'pipeline_errors');
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      // Survive unexpected crashes — continue remaining sources
      metrics.errors = 1;
      metrics.error = String(err?.message || err);
      metrics.ok = false;
      totalErrors += 1;
      try {
        registry.markError(source.id, metrics.error);
      } catch {
        /* ignore */
      }
    }

    metrics.duration_ms = Date.now() - t0;
    sourceMetrics.push(metrics);
  }

  // Post-run dedupe mark (do not delete)
  const companies = await options.repos.companies.list();
  const companyDedupe = markDuplicateCompanies(companies);
  const evidence = await options.repos.evidence.list({});
  const evidenceDedupe = markDuplicateEvidence(evidence);
  const urlDedupe = dedupeSourceUrls(sources.map((s) => s.url));

  const totals = {
    sources_run: sourceMetrics.length,
    sources_ok: sourceMetrics.filter((s) => s.ok).length,
    sources_failed: sourceMetrics.filter((s) => !s.ok).length,
    records_read: sourceMetrics.reduce((a, s) => a + s.records_read, 0),
    companies_created: sourceMetrics.reduce((a, s) => a + s.companies_created, 0),
    companies_matched: sourceMetrics.reduce((a, s) => a + s.companies_matched, 0),
    evidence_created: sourceMetrics.reduce((a, s) => a + s.evidence_created, 0),
    duplicates:
      sourceMetrics.reduce((a, s) => a + s.duplicates, 0) +
      companyDedupe.marks.length +
      evidenceDedupe.marks.length +
      urlDedupe.duplicates.length,
    errors: sourceMetrics.reduce((a, s) => a + s.errors, 0) + totalErrors,
    company_duplicates_marked: companyDedupe.marks.length,
    evidence_duplicates_marked: evidenceDedupe.marks.length,
    source_url_duplicates: urlDedupe.duplicates.length,
  };

  return {
    ok: totals.errors === 0 || totals.evidence_created > 0 || totals.sources_ok > 0,
    sources: sourceMetrics,
    totals,
    inboxItems: allInbox,
    duration_ms: Date.now() - started,
    dedupe: {
      companies: companyDedupe.marks,
      evidence: evidenceDedupe.marks,
      source_urls: urlDedupe.duplicates,
    },
  };
}
