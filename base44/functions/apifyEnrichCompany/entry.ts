import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const APIFY_TOKEN = Deno.env.get("APIFY_API_TOKEN");

async function runActor(actorId, input) {
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

  // Poll until finished (max 90s)
  for (let i = 0; i < 45; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const statusRes = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs/${runId}?token=${APIFY_TOKEN}`
    );
    const { data: status } = await statusRes.json();
    if (status.status === "SUCCEEDED") break;
    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(status.status)) {
      throw new Error(`Apify run ${status.status}`);
    }
  }

  const resultsRes = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/runs/${runId}/dataset/items?token=${APIFY_TOKEN}&clean=true`
  );
  return await resultsRes.json();
}

function extractFromCrawlResults(items, companyName) {
  const emails = new Set();
  const phones = new Set();
  let description = "";

  for (const item of items || []) {
    const text = (item.text || item.markdown || "").slice(0, 5000);

    // Extract emails
    const emailMatches = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [];
    emailMatches
      .filter(e => !e.includes("example") && !e.includes("domain") && !e.includes("test"))
      .slice(0, 3)
      .forEach(e => emails.add(e.toLowerCase()));

    // Extract phones (international format or common patterns)
    const phoneMatches = text.match(/(\+?[\d\s\-().]{10,18})/g) || [];
    phoneMatches
      .map(p => p.replace(/\s+/g, " ").trim())
      .filter(p => p.replace(/\D/g, "").length >= 7)
      .slice(0, 2)
      .forEach(p => phones.add(p));

    // Extract description from meta or first paragraph
    if (!description && item.description) {
      description = item.description.slice(0, 200);
    } else if (!description && text.length > 50) {
      const sentences = text.split(/[.\n]/).filter(s => s.trim().length > 30);
      description = (sentences[0] || "").trim().slice(0, 200);
    }
  }

  return {
    email: [...emails][0] || null,
    phone: [...phones][0] || null,
    description: description || null,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { company, website } = await req.json();
    if (!website) return Response.json({ error: "website is required" }, { status: 400 });

    // Use website-content-crawler to scrape the homepage only
    const items = await runActor("apify~website-content-crawler", {
      startUrls: [{ url: website }],
      maxCrawlPages: 3,
      crawlerType: "cheerio",
      maxCrawlDepth: 1,
      includeUrlGlobs: [],
      excludeUrlGlobs: [],
    });

    const enriched = extractFromCrawlResults(items, company);

    return Response.json({ enriched });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});