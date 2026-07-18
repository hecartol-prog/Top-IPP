/**
 * Discovery Engine public API (Sprint 2.1)
 */

export * from './types.js';
export * from './adapters/index.js';
export * from './parser/index.js';
export * from './normalization/index.js';
export { findCompanyMatch, matchOrCreateCompany } from './verification/companyMatch.js';
export { validateEvidence, isValidArtifactUrl } from './verification/validateEvidence.js';
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
