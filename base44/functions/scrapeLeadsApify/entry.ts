import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const APIFY_TOKEN = Deno.env.get("APIFY_API_TOKEN");

// Direct HTTP fetch — fast, free, works for static/SSR pages
async function fetchPageDirect(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "es,en;q=0.5",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s{2,}/g, " ")
    .trim();
  return text;
}

// Run Apify actor and poll until done
async function runActor(actorId, input, maxWaitSecs = 180) {
  const startRes = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  );
  if (!startRes.ok) {
    const errText = await startRes.text();
    throw new Error(`Apify start failed: ${startRes.status} - ${errText.slice(0, 200)}`);
  }
  const { data: runData } = await startRes.json();
  const runId = runData.id;

  // Poll for completion
  const polls = Math.ceil(maxWaitSecs / 5);
  let succeeded = false;
  for (let i = 0; i < polls; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
    const { data: status } = await statusRes.json();
    console.log(`Apify poll ${i + 1}: status=${status.status}`);
    if (status.status === "SUCCEEDED") { succeeded = true; break; }
    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(status.status)) {
      throw new Error(`Apify run ${status.status}`);
    }
  }

  if (!succeeded) throw new Error("Apify run timed out waiting");

  // Get dataset items
  const infoRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
  const { data: runInfo } = await infoRes.json();
  const datasetId = runInfo?.defaultDatasetId;
  if (!datasetId) return [];

  const resultsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&clean=true&limit=100`);
  const body = await resultsRes.text();
  try { return JSON.parse(body); } catch { return []; }
}

// Fetch via Apify website-content-crawler with Playwright (handles JS/cookie walls)
async function fetchWithApify(url, maxPages, depth) {
  const items = await runActor("apify~website-content-crawler", {
    startUrls: [{ url }],
    maxCrawlPages: maxPages,
    crawlerType: "playwright:firefox",
    maxCrawlDepth: depth,
    // Increase timeout per page for slow sites
    pageLoadTimeoutSecs: 60,
  });
  return Array.isArray(items) ? items : [];
}

// Extract leads from text via LLM
async function extractLeadsFromText(text, pageCount, base44) {
  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    model: "gpt_5_mini",
    prompt: `You are extracting B2B company/contact leads from scraped website directory content.

This is a membership directory or company listing page. Extract EVERY distinct company or contact listed.
Be thorough — scan the entire text carefully, don't skip any entries.

For each entry extract all available fields: company name, website URL, email, phone, city/country, industry/sector.
If a person's name and title is listed, include that too.

IMPORTANT: 
- Extract ALL companies, not just a few samples
- Clean up phone numbers (keep the digits and + sign)
- If website is listed, include the full URL
- For location, use the city and country

Scraped content (${pageCount} page${pageCount !== 1 ? "s" : ""}):
---
${text.slice(0, 60000)}
---

Return ALL companies/contacts found.`,
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
  return (result?.leads || []).filter(l => l.company_name || l.first_name);
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
    let method = "unknown";

    // STRATEGY 1: Direct HTTP fetch (fast, free — works for static HTML)
    try {
      console.log("Strategy 1: Direct fetch for:", url);
      const text = await fetchPageDirect(url);
      console.log(`Direct fetch result: ${text.length} chars`);

      if (text.length > 800) {
        allText = text;
        pageCount = 1;
        method = "direct";
        console.log("Direct fetch succeeded");
      } else {
        console.log("Direct fetch: content too short, will try Apify");
      }
    } catch (e) {
      console.log("Direct fetch failed:", e.message, "— will use Apify");
    }

    // STRATEGY 2: Apify with Playwright (handles JS-rendered sites, cookie walls, 403s)
    if (!allText || allText.length < 800) {
      console.log("Strategy 2: Apify Playwright...");
      try {
        const maxPages = mode === "deep" ? 25 : 1;
        const depth = mode === "deep" ? 1 : 0;
        const pages = await fetchWithApify(url, maxPages, depth);
        console.log(`Apify returned ${pages.length} page(s)`);

        if (pages.length > 0) {
          pageCount = pages.length;
          if (pages.length === 1) {
            allText = (pages[0].text || pages[0].markdown || "").slice(0, 80000);
          } else {
            allText = pages
              .map(p => `--- ${p.url} ---\n${(p.text || p.markdown || "").slice(0, 4000)}`)
              .join("\n\n");
          }
          method = "apify_playwright";
          console.log(`Apify Playwright: ${allText.length} chars from ${pageCount} pages`);
        }
      } catch (e) {
        console.error("Apify Playwright failed:", e.message);
        return Response.json({ error: `Could not fetch content: ${e.message}` }, { status: 500 });
      }
    } else if (mode === "deep" && method === "direct") {
      // For deep mode with direct fetch working, also try sub-pages via Apify cheerio (faster)
      console.log("Deep mode: adding sub-page crawl...");
      try {
        const pages = await runActor("apify~website-content-crawler", {
          startUrls: [{ url }],
          maxCrawlPages: 20,
          crawlerType: "cheerio",
          maxCrawlDepth: 1,
        });
        if (Array.isArray(pages) && pages.length > 1) {
          pageCount = pages.length;
          allText = pages.map(p => `--- ${p.url} ---\n${(p.text || p.markdown || "").slice(0, 3000)}`).join("\n\n");
          method = "apify_deep";
          console.log(`Deep crawl: ${pageCount} pages`);
        }
      } catch (e) {
        console.log("Deep crawl failed, using single-page direct result:", e.message);
      }
    }

    if (!allText || allText.trim().length < 100) {
      return Response.json({ leads: [], pages_scraped: 0, message: "No content found at URL — the page may require login or is empty." });
    }

    console.log(`Calling LLM on ${allText.length} chars from ${pageCount} pages (method: ${method})`);
    const leads = await extractLeadsFromText(allText, pageCount, base44);
    console.log(`Extracted ${leads.length} leads`);

    return Response.json({ leads, pages_scraped: pageCount, method });

  } catch (error) {
    console.error("scrapeLeadsApify error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});