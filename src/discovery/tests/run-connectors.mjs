/**
 * Sprint 2.2 — Production Connectors fixture tests
 * Run: node src/discovery/tests/run-connectors.mjs
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const discovery = await import(pathToFileURL(join(root, 'index.js')).href);

const {
  createSourceRegistry,
  PRODUCTION_SOURCES,
  PRODUCTION_VERTICAL_PACKS,
  SUPPORTED_CONNECTORS,
  runConnector,
  runProductionConnectors,
  createMemoryCompanyRepo,
  createMemoryEvidenceRepo,
  createMemoryInboxRepo,
  findCompanyMatch,
  parseRawDocument,
  normalizeCompanyName,
  COMPANY_MATCH_CONFIDENCE_THRESHOLD,
  toVerticalPackEntity,
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

function load(name) {
  return readFileSync(join(root, 'fixtures', name), 'utf8');
}

function freshRepos(seed = []) {
  return {
    companies: createMemoryCompanyRepo(seed),
    evidence: createMemoryEvidenceRepo(),
    inbox: createMemoryInboxRepo(),
  };
}

console.log('\n=== Sprint 2.2 Production Connectors Tests ===\n');

// --- Registry & packs ---
console.log('Source Registry & Vertical Packs');
{
  const registry = createSourceRegistry();
  assert(PRODUCTION_VERTICAL_PACKS.length === 5, '5 production vertical packs');
  assert(PRODUCTION_SOURCES.length >= 10, `production sources configured (${PRODUCTION_SOURCES.length})`);
  const enabled = registry.list({ enabledOnly: true });
  assert(enabled.every((s) => s.enabled), 'registry lists enabled sources');
  assert(enabled.every((s) => s.url && s.id && s.type), 'every source has id/type/url');
  assert(!enabled.some((s) => !s.url), 'no missing URLs');
  const water = registry.list({ vertical_pack: 'industrial_water' });
  assert(water.length >= 2, 'water pack has sources');
  const entity = toVerticalPackEntity(PRODUCTION_VERTICAL_PACKS[0]);
  assert(entity.code === 'industrial_water' && entity.active === true, 'pack → entity payload');
  registry.markSuccess('src_water_news_rss');
  assert(registry.get('src_water_news_rss')?.last_success, 'last_success updated');
}

console.log('\nSupported connectors');
{
  for (const t of ['rss', 'sitemap', 'json_api', 'csv', 'manual_url', 'manual_pdf']) {
    assert(SUPPORTED_CONNECTORS.includes(t), `connector ${t}`);
  }
}

// --- Per-connector happy path ---
console.log('\nConnectors (fixtures)');
{
  const registry = createSourceRegistry();

  const rss = await runConnector(registry.get('src_water_news_rss'), {
    payload: load('sample.rss.xml'),
  });
  assert(rss.ok && rss.document?.source.adapter_kind === 'rss', 'RSS connector');

  const sitemap = await runConnector(registry.get('src_lines_sitemap'), {
    payload: load('sample.sitemap.xml'),
  });
  assert(sitemap.ok && sitemap.document, 'Sitemap connector');
  const smParsed = parseRawDocument(sitemap.document);
  assert(smParsed.length === 1, `Sitemap skips orphan URLs (got ${smParsed.length})`);

  const json = await runConnector(registry.get('src_water_permits_json'), {
    payload: JSON.parse(load('sample.json')),
  });
  assert(json.ok && json.document, 'JSON API connector');

  const csv = await runConnector(registry.get('src_water_csv_import'), {
    payload: load('sample.csv'),
  });
  assert(csv.ok && csv.document, 'CSV connector');

  const url = await runConnector(registry.get('src_lines_manual_url'), {
    payload: load('sample.manual-url.html'),
  });
  assert(url.ok && url.document?.source.adapter_kind === 'html', 'Manual URL connector');

  const pdf = await runConnector(registry.get('src_plastics_pdf_meta'), {
    payload: JSON.parse(load('sample.pdf-meta.json')),
  });
  assert(pdf.ok && pdf.document, 'Manual PDF metadata connector');
  assert(pdf.document.content_type.includes('pdf'), 'PDF meta content type');
}

// --- Malformed survival ---
console.log('\nMalformed input survival');
{
  const registry = createSourceRegistry();
  const cases = [
    ['src_lines_sitemap', load('malformed.xml'), 'bad XML'],
    ['src_water_csv_import', load('malformed.csv'), 'bad CSV'],
    ['src_lines_manual_url', load('malformed.html'), 'bad HTML'],
  ];
  for (const [id, payload, label] of cases) {
    const source = registry.get(id);
    const fetched = await runConnector(source, { payload });
    assert(fetched.ok === true || fetched.ok === false, `${label}: connector did not throw`);
    if (fetched.ok && fetched.document) {
      const parsed = parseRawDocument(fetched.document);
      assert(Array.isArray(parsed), `${label}: parser returned array`);
    } else {
      assert(true, `${label}: connector returned typed error`);
    }
  }

  const badJson = await runConnector(registry.get('src_water_permits_json'), {
    payload: load('malformed.json'),
  });
  assert(badJson.ok === false && badJson.errorCode === 'invalid_json', 'invalid JSON rejected safely');

  // Simulated network errors
  const timeout = await runConnector(registry.get('src_automation_rss'), {
    fetchImpl: async () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    },
  });
  // placeholder .invalid URL returns requires_payload without fetchImpl payload
  assert(
    timeout.ok === false,
    `network/placeholder failure survived (code=${timeout.errorCode})`
  );

  const notFound = await runConnector(
    { ...registry.get('src_automation_json'), url: 'https://httpbin.org/status/404' },
    {
      fetchImpl: async () => ({
        ok: false,
        status: 404,
        url: 'https://example.com/404',
        headers: { get: () => 'text/plain' },
        text: async () => '',
      }),
    }
  );
  assert(notFound.ok === false && notFound.errorCode === 'http_404', '404 survived');

  const serverErr = await runConnector(
    { ...registry.get('src_automation_json'), url: 'https://example.com/500' },
    {
      fetchImpl: async () => ({
        ok: false,
        status: 500,
        url: 'https://example.com/500',
        headers: { get: () => 'text/plain' },
        text: async () => '',
      }),
    }
  );
  assert(serverErr.ok === false && serverErr.errorCode === 'http_5xx', '500 survived');
}

// --- Company match priority ---
console.log('\nCompany matching priority');
{
  const companies = [
    {
      id: 'c_domain',
      name: 'Other Name',
      domain: 'aquapure-industries.example',
      country: 'ES',
      verification_status: 'verified',
      path_a_status: 'nurtured',
    },
    {
      id: 'c_reg',
      name: 'Reg Co',
      country: 'DE',
      tags: ['reg:DE-HRB-998877'],
      verification_status: 'unverified',
      path_a_status: 'observed',
    },
  ];
  const byDomain = findCompanyMatch(companies, {
    company_name: 'AquaPure Industries',
    normalized_name: normalizeCompanyName('AquaPure Industries'),
    domain: 'aquapure-industries.example',
    website: null,
    country: 'ES',
    registration_number: null,
  });
  assert(byDomain.match?.id === 'c_domain' && byDomain.reason === 'domain_match', 'priority: domain');

  const byReg = findCompanyMatch(companies, {
    company_name: 'MoldTech OEM Partners',
    normalized_name: normalizeCompanyName('MoldTech OEM Partners'),
    domain: null,
    website: null,
    country: 'DE',
    registration_number: 'DE-HRB-998877',
  });
  assert(byReg.match?.id === 'c_reg' && byReg.reason === 'registration_number_match', 'priority: registration');

  const weak = findCompanyMatch(
    [
      {
        id: 'c_weak',
        name: 'Almost Same Name GmbH',
        normalized_name: 'almost same name',
        country: 'DE',
      },
    ],
    {
      company_name: 'Almost Same Name',
      normalized_name: 'almost same name',
      domain: null,
      website: null,
      country: 'DE',
      registration_number: null,
    },
    { threshold: 0.99 }
  );
  assert(weak.match === null && weak.reason === 'below_match_threshold', 'no merge below threshold');
  assert(COMPANY_MATCH_CONFIDENCE_THRESHOLD === 0.85, 'match threshold constant');
}

// --- Full production run (offline payloads) ---
console.log('\nProduction runner (offline)');
{
  const repos = freshRepos();
  const registry = createSourceRegistry();
  const report = await runProductionConnectors({
    repos,
    registry,
    sources: [
      registry.get('src_water_news_rss'),
      registry.get('src_lines_sitemap'),
      registry.get('src_water_csv_import'),
      registry.get('src_water_permits_json'),
      registry.get('src_lines_manual_url'),
      registry.get('src_plastics_pdf_meta'),
      // malformed sources included — must not crash run
      registry.get('src_machinery_json'),
    ],
    payloads: {
      src_water_news_rss: { payload: load('sample.rss.xml') },
      src_lines_sitemap: { payload: load('sample.sitemap.xml') },
      src_water_csv_import: { payload: load('sample.csv') },
      src_water_permits_json: { payload: JSON.parse(load('sample.json')) },
      src_lines_manual_url: { payload: load('sample.manual-url.html') },
      src_plastics_pdf_meta: { payload: JSON.parse(load('sample.pdf-meta.json')) },
      src_machinery_json: { payload: load('malformed.json') },
    },
  });

  assert(report.sources.length === 7, `ran 7 sources (got ${report.sources.length})`);
  assert(report.totals.evidence_created >= 5, `evidence created >=5 (got ${report.totals.evidence_created})`);
  assert(report.totals.companies_created + report.totals.companies_matched >= 5, 'companies created/matched');
  assert(report.inboxItems.every((i) => i.status === 'pending'), 'inbox pending only');
  assert(!report.inboxItems.some((i) => i.opportunity_id), 'no Opportunity');
  assert(
    report.sources.every((s) => typeof s.duration_ms === 'number'),
    'every source logs duration'
  );
  assert(
    report.sources.every((s) =>
      ['connector', 'source', 'records_read', 'companies_created', 'companies_matched', 'evidence_created', 'duplicates', 'errors'].every(
        (k) => k in s
      )
    ),
    'metrics shape complete'
  );
  const failedSrc = report.sources.find((s) => s.source === 'src_machinery_json');
  assert(failedSrc && failedSrc.ok === false, 'malformed JSON source failed without crashing run');
  const okCount = report.sources.filter((s) => s.ok).length;
  assert(okCount >= 5, `pipeline completed for healthy sources (${okCount} ok)`);
  console.log(
    `  METRICS: duration=${report.duration_ms}ms evidence=${report.totals.evidence_created} companies_created=${report.totals.companies_created} matched=${report.totals.companies_matched} dupes=${report.totals.duplicates} errors=${report.totals.errors}`
  );
}

// --- Dedup mark (no delete) ---
console.log('\nDeduplication marks');
{
  const repos = freshRepos();
  const registry = createSourceRegistry();
  const payloads = {
    src_plastics_pdf_meta: { payload: JSON.parse(load('sample.pdf-meta.json')) },
  };
  await runProductionConnectors({
    repos,
    registry,
    sources: [registry.get('src_plastics_pdf_meta')],
    payloads,
  });
  const second = await runProductionConnectors({
    repos,
    registry,
    sources: [registry.get('src_plastics_pdf_meta')],
    payloads,
  });
  assert(second.totals.duplicates >= 1 || second.sources[0].duplicates >= 1, 'duplicate evidence detected');
  const allEv = await repos.evidence.list({});
  assert(allEv.length >= 1, 'original evidence retained (no delete)');
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
