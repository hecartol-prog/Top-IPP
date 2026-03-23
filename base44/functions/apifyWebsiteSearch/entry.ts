import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const APIFY_TOKEN = Deno.env.get("APIFY_API_TOKEN");
const ACTOR_ID = "apify~google-search-scraper";

async function runApifyActor(queries) {
  // Start actor run
  const startRes = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${APIFY_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        queries: queries.join("\n"),
        resultsPerPage: 3,
        maxPagesPerQuery: 1,
        languageCode: "",
        mobileResults: false,
        includeUnfilteredResults: false,
        saveHtml: false,
        saveHtmlToKeyValueStore: false,
      }),
    }
  );

  if (!startRes.ok) {
    throw new Error(`Apify start failed: ${startRes.status}`);
  }

  const { data: runData } = await startRes.json();
  const runId = runData.id;

  // Poll until finished (max 60s)
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const statusRes = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR_ID}/runs/${runId}?token=${APIFY_TOKEN}`
    );
    const { data: status } = await statusRes.json();
    if (status.status === "SUCCEEDED") break;
    if (status.status === "FAILED" || status.status === "ABORTED") {
      throw new Error(`Apify run ${status.status}`);
    }
  }

  // Get results
  const resultsRes = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR_ID}/runs/${runId}/dataset/items?token=${APIFY_TOKEN}&clean=true`
  );
  return await resultsRes.json();
}

function extractWebsite(items, companyName) {
  const nameLower = companyName.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const item of items || []) {
    for (const result of item.organicResults || []) {
      const url = result.url || "";
      const urlLower = url.toLowerCase();
      // Skip social/directory sites
      if (/linkedin|facebook|twitter|yelp|wikipedia|bloomberg|crunchbase|dnb\.com|manta\.com/.test(urlLower)) continue;
      // Prefer if company name appears in domain
      const domain = urlLower.replace(/https?:\/\//, "").split("/")[0];
      const domainClean = domain.replace(/[^a-z0-9]/g, "");
      if (domainClean.includes(nameLower.slice(0, 5)) || nameLower.includes(domainClean.slice(0, 5))) {
        return url.startsWith("http") ? url : `https://${url}`;
      }
    }
  }
  // Fallback: first non-social result
  for (const item of items || []) {
    for (const result of item.organicResults || []) {
      const url = result.url || "";
      if (!/linkedin|facebook|twitter|yelp|wikipedia|bloomberg|crunchbase/.test(url.toLowerCase())) {
        return url.startsWith("http") ? url : `https://${url}`;
      }
    }
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { companies } = await req.json();
    if (!Array.isArray(companies) || companies.length === 0) {
      return Response.json({ error: "companies array required" }, { status: 400 });
    }

    // Build search queries
    const queries = companies.map(c => `${c} official website`);
    const items = await runApifyActor(queries);

    // Map results back to companies
    const results = {};
    companies.forEach((company, i) => {
      const companyItems = items.filter(it => it.searchQuery?.term === queries[i]);
      results[company] = extractWebsite(companyItems, company);
    });

    return Response.json({ results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});