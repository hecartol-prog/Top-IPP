/**
 * Discovery Engine public API (Sprint 2.1 + 2.2)
 */

export * from './types.js';
export * from './adapters/index.js';
export * from './parser/index.js';
export * from './normalization/index.js';
export { findCompanyMatch, matchOrCreateCompany, companyRegistrationNumber } from './verification/companyMatch.js';
export { validateEvidence, isValidArtifactUrl } from './verification/validateEvidence.js';
export {
  markDuplicateCompanies,
  markDuplicateEvidence,
  markDuplicateDocuments,
  dedupeSourceUrls,
} from './verification/dedupe.js';
export { extractEvidence, hashClaim } from './pipeline/extractEvidence.js';
export { runDiscoveryPipeline, stages } from './pipeline/index.js';
export { PipelineLogger } from './pipeline/logger.js';
export { DiscoveryScheduler } from './scheduler/index.js';
export { triggerInboxCandidate, buildInboxCandidate } from './services/inboxCandidate.js';
export {
  createMemoryCompanyRepo,
  createMemoryEvidenceRepo,
  createMemoryInboxRepo,
} from './services/memoryRepos.js';
export {
  createBase44CompanyRepo,
  createBase44EvidenceRepo,
  createBase44InboxRepo,
} from './services/persistence.js';

// Sprint 2.2 — Production connectors
export {
  CONNECTORS,
  SUPPORTED_CONNECTORS,
  getConnector,
  runConnector,
  rssConnector,
  sitemapConnector,
  jsonApiConnector,
  csvConnector,
  manualUrlConnector,
  manualPdfConnector,
} from './connectors/index.js';
export { fetchText } from './connectors/http.js';
export { SourceRegistry, createSourceRegistry, normalizeSourceEntry } from './registry/index.js';
export { CONNECTOR_TYPES, COMPANY_MATCH_CONFIDENCE_THRESHOLD } from './registry/types.js';
export { PRODUCTION_SOURCES } from './config/sources.js';
export {
  PRODUCTION_VERTICAL_PACKS,
  getVerticalPack,
  toVerticalPackEntity,
} from './config/verticalPacks.js';
export { runProductionConnectors } from './runner/index.js';
