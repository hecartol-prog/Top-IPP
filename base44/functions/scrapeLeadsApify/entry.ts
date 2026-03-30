import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const APIFY_TOKEN = Deno.env.get("APIFY_API_TOKEN");

// Run an Apify actor and poll until done, then return dataset items
async function runActor(actorId, input, maxWaitSecs = 120) {
  const startRes = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  );
  if (!startRes.ok) throw new Error(`Apify start failed: ${startRes.status} ${await startRes.text()}`);
  const { data: runData } = await startRes.json();
  const runId = runData.id;

  const polls = Math.ceil(maxWaitSecs / 3);
  for (let i = 0; i < polls; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const statusRes = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs/${runId}?token=${APIFY_TOKEN}`
    );
    const { data: status } = await statusRes.json();
    if (status.status === "SUCCEEDED") break;
    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(status.status)) {
      throw new Error(`Apify run ${status.status}`);
    }
  }

  // Fetch dataset items using the run's defaultDatasetId
  const runInfoRes = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
  );
  const runInfo = await runInfoRes.json();
  const datasetId = runInfo?.data?.defaultDatasetId;
  if (!datasetId) return [];

  const resultsRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&clean=true&limit=100`
  );
  const body = await resultsRes.text();
  console.log("Apify dataset response (first 300 chars):", body.slice(0, 300));
  try { return JSON.parse(body); } catch { return []; }
}

// Crawl pages via Apify — tries cheerio first (fast/cheap), falls back to playwright for JS-rendered sites
async function crawlPages(startUrl, maxPages, depth) {
  // Try cheerio first (fast, no JS rendering)
  let raw = await runActor("apify~website-content-crawler", {
    startUrls: [{ url: startUrl }],
    maxCrawlPages: maxPages,
    crawlerType: "cheerio",
    maxCrawlDepth: depth,
  });

  let items = Array.isArray(raw) ? raw : [];

  // If cheerio got nothing useful, retry with playwright (handles JS-rendered sites)
  const hasContent = items.some(i => (i.text || i.markdown || "").length > 100);
  if (!hasContent) {
    raw = await runActor("apify~website-content-crawler", {
      startUrls: [{ url: startUrl }],
      maxCrawlPages: maxPages,
      crawlerType: "playwright:firefox",
      maxCrawlDepth: depth,
    });
    items = Array.isArray(raw) ? raw : [];
  }

  return items.map(item => ({
    url: item.url,
    text: (item.text || item.markdown || "").slice(0, 3000),
  }));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { url, mode } = await req.json();
    if (!url) return Response.json({ error: "url is required" }, { status: 400 });

    let allText = "";
    let pageCount = 0;

    if (mode === "simple") {
      // Single page — depth 0, max 1 page
      const pages = await crawlPages(url, 1, 0);
      allText = pages.map(p => p.text).join("\n\n").slice(0, 10000);
      pageCount = pages.length;
    } else {
      // Deep crawl — follow links one level, up to 30 pages
      const pages = await crawlPages(url, 30, 1);
      pageCount = pages.length;
      allText = pages
        .map(p => `--- Page: ${p.url} ---\n${p.text}`)
        .join("\n\n")
        .slice(0, 60000);
    }

    if (!allText.trim()) {
      return Response.json({ leads: [], pages_scraped: 0, message: "No content found at URL" });
    }

    // ONE LLM call to extract all leads from all scraped content
    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are extracting B2B lead data from scraped website content below.

Extract every distinct company or contact you can find. For each one return as many fields as available.
Be thorough — scan the entire text carefully.

Scraped content (${pageCount} page${pageCount !== 1 ? 's' : ''}):
---
${allText}
---

Return a JSON array of leads. Only include leads where you found at least a company name or a person's name.`,
      response_json_schema: {
        type: "object",
        properties: {
          leads: {
            type: "array",
            items: {
              type: "object",
              properties: {
                first_name: { type: "string" },
                last_name: { type: "string" },
                job_title: { type: "string" },
                company_name: { type: "string" },
                email: { type: "string" },
                phone: { type: "string" },
                website: { type: "string" },
                location: { type: "string" },
                industry: { type: "string" },
                notes: { type: "string" }
              }
            }
          }
        }
      }
    });

    const leads = (result?.leads || []).filter(l => l.company_name || l.first_name);

    return Response.json({ leads, pages_scraped: pageCount });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});