import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const APIFY_TOKEN = Deno.env.get('APIFY_API_TOKEN');

// Fetch LinkedIn profile via Apify (handles JS rendering and auth walls)
async function fetchLinkedInViaApify(profileUrl) {
  if (!APIFY_TOKEN) return null;
  try {
    const startResp = await fetch(
      'https://api.apify.com/v2/acts/apify~website-content-crawler/runs?token=' + APIFY_TOKEN,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: [{ url: profileUrl }],
          maxCrawlPages: 1,
          crawlerType: 'playwright:firefox',
          maxCrawlDepth: 0,
          pageLoadTimeoutSecs: 30
        })
      }
    );
    if (!startResp.ok) return null;
    const startData = await startResp.json();
    const runId = startData.data.id;

    // Poll up to 60s
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 4000));
      const statusResp = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
      const statusData = await statusResp.json();
      const status = statusData.data.status;
      if (status === 'SUCCEEDED') break;
      if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') return null;
    }

    const infoResp = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
    const infoData = await infoResp.json();
    const dsId = infoData.data?.defaultDatasetId;
    if (!dsId) return null;

    const itemsResp = await fetch(`https://api.apify.com/v2/datasets/${dsId}/items?token=${APIFY_TOKEN}&clean=true&limit=1`);
    const items = await itemsResp.json();
    if (items && items.length > 0) {
      return (items[0].text || items[0].markdown || '').slice(0, 8000);
    }
    return null;
  } catch (e) {
    console.log('Apify LinkedIn fetch failed:', e.message);
    return null;
  }
}

// Try direct fetch (usually blocked by LinkedIn, but worth trying)
async function fetchLinkedInDirect(profileUrl) {
  try {
    const resp = await fetch(profileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,es;q=0.8'
      },
      signal: AbortSignal.timeout(15000),
      redirect: 'follow'
    });
    if (!resp.ok) return null;
    const html = await resp.text();
    // Check if we actually got profile content (not login wall)
    if (html.includes('authwall') || html.includes('login') || html.length < 5000) return null;
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 8000);
    return text;
  } catch (e) {
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { urls } = await req.json();
    if (!Array.isArray(urls) || urls.length === 0) {
      return Response.json({ error: "urls array is required" }, { status: 400 });
    }

    const results = [];

    for (const profileUrl of urls) {
      try {
        console.log("Extracting LinkedIn profile:", profileUrl);
        const cleanUrl = profileUrl.split("?")[0].replace(/\/$/, "");
        const username = cleanUrl.split("/in/")[1] || cleanUrl;

        // Step 1: Try to get actual page content
        let pageContent = null;

        console.log("Trying direct fetch...");
        pageContent = await fetchLinkedInDirect(cleanUrl);

        if (!pageContent && APIFY_TOKEN) {
          console.log("Direct fetch blocked, trying Apify...");
          pageContent = await fetchLinkedInViaApify(cleanUrl);
        }

        let result;

        if (pageContent && pageContent.length > 500) {
          // We have actual page content — extract from it directly
          console.log(`Got ${pageContent.length} chars of page content, extracting...`);
          result = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: `Extract the professional information of the LinkedIn profile owner from this page content.

IMPORTANT: Extract ONLY what is explicitly stated in the content below. Do NOT guess or add information not present in the content.

LinkedIn profile URL: ${cleanUrl}

Page content:
---
${pageContent}
---

Extract:
- first_name: their first name
- last_name: their last name  
- job_title: their CURRENT job title
- company_name: their CURRENT employer/company (the most recent/current one listed)
- location: city and country
- industry: their industry
- email: email address if shown
- phone: phone number if shown

Return only what you can confirm from the content above. If a value is not in the content, omit the field.`,
            response_json_schema: {
              type: "object",
              properties: {
                first_name: { type: "string" },
                last_name: { type: "string" },
                job_title: { type: "string" },
                company_name: { type: "string" },
                location: { type: "string" },
                industry: { type: "string" },
                email: { type: "string" },
                phone: { type: "string" }
              }
            }
          });
        } else {
          // Fallback: use internet search but be very specific about the URL
          console.log("No page content, using targeted internet search...");
          result = await base44.asServiceRole.integrations.Core.InvokeLLM({
            model: "gemini_3_flash",
            prompt: `Find the current professional information for this EXACT LinkedIn profile: ${cleanUrl}

The LinkedIn username is: ${username}

Search specifically for this profile URL and extract:
- Their full name
- Their CURRENT job title and CURRENT employer (the most recent position, NOT past jobs)
- Their location
- Their industry
- Email or phone if publicly available

CRITICAL: Only return their CURRENT/PRESENT employer and job title. Ignore past positions.
If you cannot find reliable current information for this specific profile, return empty fields rather than guessing.`,
            add_context_from_internet: true,
            response_json_schema: {
              type: "object",
              properties: {
                first_name: { type: "string" },
                last_name: { type: "string" },
                job_title: { type: "string" },
                company_name: { type: "string" },
                location: { type: "string" },
                industry: { type: "string" },
                email: { type: "string" },
                phone: { type: "string" }
              }
            }
          });
        }

        console.log("LLM result:", JSON.stringify(result));

        // Clean null/placeholder values
        const cleaned = {};
        for (const [k, v] of Object.entries(result || {})) {
          if (v && v !== "null" && v !== "N/A" && v !== "n/a" && String(v).trim() !== "") {
            cleaned[k] = v;
          }
        }

        if (cleaned.first_name || cleaned.last_name || cleaned.company_name) {
          results.push({ ...cleaned, linkedin_url: profileUrl });
          console.log(`Extracted: ${cleaned.first_name} ${cleaned.last_name} @ ${cleaned.company_name}`);
        } else {
          console.log("No data extracted for:", profileUrl);
          results.push({ linkedin_url: profileUrl, _failed: true });
        }
      } catch (err) {
        console.error("Failed for", profileUrl, ":", err.message);
        results.push({ linkedin_url: profileUrl, _failed: true, _error: err.message });
      }
    }

    return Response.json({ results });
  } catch (error) {
    console.error("extractLinkedInProfile error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});