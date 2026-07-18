/**
 * Sprint 2.1 — Discovery pipeline fixture tests
 * Run: node src/discovery/tests/run-fixtures.mjs
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

/** Dynamic import discovery module */
const discovery = await import(pathToFileURL(join(root, 'index.js')).href);

const {
  runDiscoveryPipeline,
  DiscoveryScheduler,
  createMemoryCompanyRepo,
  createMemoryEvidenceRepo,
  createMemoryInboxRepo,
  stages,
  normalizeCompanyName,
  normalizeDomain,
  validateEvidence,
  extractEvidence,
  CONFIDENCE_THRESHOLD,
} = discovery;

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error(`  FAIL: ${msg}`);
    return false;
  }
  passed += 1;
  console.log(`  PASS: ${msg}`);
  return true;
}

function loadFixture(name) {
  return readFileSync(join(root, 'fixtures', name), 'utf8');
}

function freshRepos(seedCompanies = []) {
  return {
    companies: createMemoryCompanyRepo(seedCompanies),
    evidence: createMemoryEvidenceRepo(),
    inbox: createMemoryInboxRepo(),
  };
}

console.log('\n=== Sprint 2.1 Discovery Engine Fixture Tests ===\n');

// --- Unit: normalization ---
console.log('Normalization');
assert(normalizeCompanyName('AquaPure Industries, Inc.') === 'aquapure industries', 'company name strip suffix');
assert(normalizeDomain('https://www.Aquapure-Industries.example/path', null) === 'aquapure-industries.example', 'domain from website');
assert(normalizeDomain(null, null) === null, 'never invent domain');

// --- Unit: validation ---
console.log('\nEvidence validation');
{
  const bad = validateEvidence({
    company_id: 'c1',
    type: 'project_mention',
    claim: 'x',
    source_type: 'news',
    confidence: 0.1,
    observed_at: new Date().toISOString(),
    status: 'active',
    artifact_url: 'https://example.com/a',
  });
  assert(!bad.accepted && bad.reason === 'confidence_below_threshold', 'reject low confidence');
  assert(CONFIDENCE_THRESHOLD === 0.35, 'threshold constant');

  const noProv = validateEvidence({
    company_id: 'c1',
    type: 'media',
    claim: 'x',
    source_type: 'news',
    confidence: 0.9,
    observed_at: new Date().toISOString(),
    status: 'active',
  });
  assert(!noProv.accepted && noProv.reason === 'missing_provenance', 'reject missing provenance');
}

// --- Pipeline: RSS ---
console.log('\nPipeline: RSS');
{
  const repos = freshRepos();
  const rss = loadFixture('sample.rss.xml');
  const result = await runDiscoveryPipeline({
    adapterKind: 'rss',
    adapterInput: {
      source_id: 'fixture_rss_industrial',
      source_type: 'news',
      source_weight: 0.65,
      payload: rss,
    },
    repos,
  });
  assert(result.rawDocument?.source.adapter_kind === 'rss', 'RSS raw document');
  assert(result.parsed.length === 2, `RSS parsed 2 items (got ${result.parsed.length})`);
  assert(result.evidenceStored.length >= 1, `RSS stored evidence (got ${result.evidenceStored.length})`);
  assert(result.inboxItems.every((i) => i.status === 'pending'), 'RSS inbox pending only');
  assert(!result.inboxItems.some((i) => i.opportunity_id), 'RSS no Opportunity created');
  const stagesOk = ['discovery_source', 'raw_document', 'parser', 'normalization', 'company_match', 'evidence_extraction', 'evidence_validation', 'store_evidence', 'inbox_candidate'];
  for (const s of stagesOk) {
    assert(result.logs.some((l) => l.stage === s), `RSS logged stage ${s}`);
  }
}

// --- Pipeline: CSV ---
console.log('\nPipeline: CSV');
{
  const repos = freshRepos([
    {
      id: 'existing_helios',
      name: 'Helios Packaging GmbH',
      normalized_name: normalizeCompanyName('Helios Packaging GmbH'),
      domain: 'helios-packaging.example',
      country: 'DE',
      verification_status: 'verified',
      path_a_status: 'nurtured',
    },
  ]);
  const csv = loadFixture('sample.csv');
  const result = await runDiscoveryPipeline({
    adapterKind: 'csv',
    adapterInput: {
      source_id: 'fixture_csv_import',
      source_type: 'manual_import',
      source_weight: 0.7,
      payload: csv,
    },
    repos,
  });
  assert(result.parsed.length === 2, 'CSV parsed 2 rows');
  const helios = result.companies.find((c) => c.company.id === 'existing_helios');
  assert(helios && helios.created === false, 'CSV matched existing Helios — no overwrite create');
  const heliosRow = (await repos.companies.list()).find((c) => c.id === 'existing_helios');
  assert(heliosRow.path_a_status === 'nurtured', 'CSV never overwrote existing Company path_a_status');
  assert(result.evidenceStored.length === 2, `CSV stored 2 evidence (got ${result.evidenceStored.length})`);
  assert(result.inboxItems.length >= 1, 'CSV created inbox candidates');
}

// --- Pipeline: JSON API ---
console.log('\nPipeline: JSON API');
{
  const repos = freshRepos();
  const json = JSON.parse(loadFixture('sample.json'));
  const result = await runDiscoveryPipeline({
    adapterKind: 'json_api',
    adapterInput: {
      source_id: 'fixture_json_api',
      source_type: 'press_release',
      source_weight: 0.7,
      payload: json,
    },
    repos,
  });
  assert(result.parsed.length === 2, 'JSON parsed 2 items');
  assert(result.evidenceStored.length === 2, 'JSON stored 2 evidence');
  assert(result.companies.every((c) => c.company.verification_status === 'unverified'), 'JSON new companies unverified');
  assert(result.companies.every((c) => c.company.path_a_status === 'observed'), 'JSON new companies observed');
}

// --- Pipeline: Manual Upload ---
console.log('\nPipeline: Manual Upload');
{
  const repos = freshRepos();
  const manual = JSON.parse(loadFixture('manual-upload.json'));
  const result = await runDiscoveryPipeline({
    adapterKind: 'manual_upload',
    adapterInput: {
      source_id: 'fixture_manual_tradeshow',
      source_type: 'trade_show',
      source_weight: 0.65,
      payload: manual,
    },
    repos,
  });
  assert(result.evidenceStored.length === 1, 'Manual upload stored evidence via attestation');
  assert(result.evidenceStored[0].manual_attestation === true, 'Manual attestation flag');
  assert(result.inboxItems.length === 1 && result.inboxItems[0].status === 'pending', 'Manual inbox pending');
}

// --- Duplicate evidence rejection ---
console.log('\nDuplicate evidence');
{
  const repos = freshRepos();
  const manual = JSON.parse(loadFixture('manual-upload.json'));
  const input = {
    adapterKind: 'manual_upload',
    adapterInput: {
      source_id: 'dup_test',
      source_type: 'trade_show',
      source_weight: 0.65,
      payload: manual,
    },
    repos,
  };
  const first = await runDiscoveryPipeline(input);
  const second = await runDiscoveryPipeline(input);
  assert(first.evidenceStored.length === 1, 'first run stores');
  assert(second.evidenceStored.length === 0, 'second run rejects duplicate');
  assert(second.evidenceRejected.some((r) => r.reason === 'duplicate_evidence'), 'duplicate reason');
}

// --- Scheduler manual run ---
console.log('\nScheduler');
{
  const repos = freshRepos();
  const scheduler = new DiscoveryScheduler(repos);
  const json = JSON.parse(loadFixture('sample.json'));
  const out = await scheduler.runManual({
    adapterKind: 'json_api',
    adapterInput: {
      source_id: 'sched_manual',
      source_type: 'press_release',
      payload: { items: [json.items[0]] },
    },
  });
  assert(out.schedule.trigger === 'manual', 'scheduler manual trigger');
  assert(out.evidenceStored.length === 1, 'scheduler produced evidence');

  const cron = await scheduler.scheduleCron({
    id: 'cron_news',
    adapterKind: 'rss',
    adapterInput: { source_id: 'cron_rss', payload: '' },
    cronExpression: '0 6 * * *',
  });
  assert(cron.registered === true, 'cron interface registers without executing OS cron');
}

// --- Stage isolation smoke ---
console.log('\nStage isolation');
{
  const raw = await stages.discoverySource('csv', {
    source_id: 'iso',
    payload: 'company_name,claim,artifact_url,confidence\nX Co,claim,https://x.example/a,0.8\n',
  });
  const parsed = stages.parse(raw);
  assert(parsed.length === 1, 'isolated parse');
  const norm = stages.normalize(parsed[0], raw.source);
  assert(norm?.normalized_name === 'x', 'isolated normalize');
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
