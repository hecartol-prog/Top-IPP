/**
 * Inbox candidate — queue pending IntelligenceInboxItem only.
 * Does NOT create Opportunity, scores, or product recommendations.
 */

/**
 * @typedef {import('../types.js').EvidenceRecord} EvidenceRecord
 * @typedef {import('../types.js').CompanyRecord} CompanyRecord
 * @typedef {import('../types.js').InboxItemRecord} InboxItemRecord
 */

/**
 * @typedef {Object} InboxRepository
 * @property {(filter?: { company_id?: string, status?: string }) => Promise<InboxItemRecord[]>} list
 * @property {(data: InboxItemRecord) => Promise<InboxItemRecord>} create
 */

/**
 * @param {CompanyRecord} company
 * @param {EvidenceRecord} evidence
 * @returns {InboxItemRecord}
 */
export function buildInboxCandidate(company, evidence) {
  const event = evidence.discovery_event_type || evidence.type;
  return {
    company_id: company.id,
    status: 'pending',
    path: 'B',
    priority_index: 0,
    recommendation_summary: `Evidence queued for review: ${event} — ${String(evidence.claim).slice(0, 180)}`,
  };
}

/**
 * Create pending inbox item if none already pending for same company+claim cluster.
 * @param {InboxRepository} repo
 * @param {CompanyRecord} company
 * @param {EvidenceRecord} evidence
 * @returns {Promise<{ item: InboxItemRecord|null, created: boolean, reason: string }>}
 */
export async function triggerInboxCandidate(repo, company, evidence) {
  if (!company?.id || !evidence) {
    return { item: null, created: false, reason: 'missing_inputs' };
  }

  const pending = await repo.list({ company_id: company.id, status: 'pending' });
  const claimSnippet = String(evidence.claim).slice(0, 80);
  const dup = pending.find((p) =>
    String(p.recommendation_summary || '').includes(claimSnippet)
  );
  if (dup) {
    return { item: dup, created: false, reason: 'pending_already_exists' };
  }

  const item = await repo.create(buildInboxCandidate(company, evidence));
  return { item, created: true, reason: 'created_pending' };
}
