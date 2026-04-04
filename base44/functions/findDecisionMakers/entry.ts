import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function cleanFieldValue(v) {
  if (!v || typeof v !== 'string') return v;
  return v.replace(/^(website|email|phone|telephone|tel|url|linkedin)\s*:\s*/i, '').trim();
}

async function fetchSearchSnippets(query) {
  try {
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=8`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const html = await resp.text();
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 6000);
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { lead_id } = body;

    if (!lead_id) return Response.json({ error: 'lead_id is required' }, { status: 400 });

    const lead = await base44.asServiceRole.entities.Lead.get(lead_id);
    if (!lead) return Response.json({ error: 'Lead not found' }, { status: 404 });

    const cleanWebsite = lead.website ? cleanFieldValue(lead.website) : null;
    const companyDomain = cleanWebsite
      ? (() => { try { return new URL(cleanWebsite.startsWith('http') ? cleanWebsite : 'https://' + cleanWebsite).hostname; } catch { return null; } })()
      : null;

    // Search for decision makers at this company
    const searchQuery = `${lead.company_name} ${lead.country || lead.location || ''} CEO procurement director manager contact LinkedIn`;
    const searchText = await fetchSearchSnippets(searchQuery);
    const searchQuery2 = `"${lead.company_name}" purchasing manager engineering director email contact`;
    const searchText2 = await fetchSearchSnippets(searchQuery2);

    const combinedContext = [
      searchText ? `=== SEARCH 1 ===\n${searchText}` : null,
      searchText2 ? `=== SEARCH 2 ===\n${searchText2}` : null,
    ].filter(Boolean).join('\n\n');

    if (!combinedContext) {
      return Response.json({ success: true, decision_makers: [], message: 'No context found' });
    }

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a B2B lead researcher for a plastic injection mold / manufacturing company.

Find decision makers at: ${lead.company_name} (${lead.country || lead.location || 'unknown location'})
Company website: ${cleanWebsite || 'unknown'}
Company domain: ${companyDomain || 'unknown'}

From the search results below, extract up to 5 real decision makers who could be involved in purchasing plastic molds or manufacturing components.

Target roles: CEO, Managing Director, Procurement Manager, Purchasing Manager, Engineering Director, Operations Director, COO, Founder, Head of Supply Chain, Head of Manufacturing.

For each person found, extract:
- first_name, last_name (real names only, no generic titles)
- job_title (their actual title)
- email (if found - prefer @${companyDomain || 'company domain'}, NOT gmail/yahoo)
- linkedin_url (only real linkedin.com/in/ URLs)
- phone (if found)

Only include people you are reasonably confident work at ${lead.company_name}.
Return an empty array if no real contacts are found.

Source text:
${combinedContext}`,
      response_json_schema: {
        type: "object",
        properties: {
          decision_makers: {
            type: "array",
            items: {
              type: "object",
              properties: {
                first_name: { type: "string" },
                last_name: { type: "string" },
                job_title: { type: "string" },
                email: { type: "string" },
                linkedin_url: { type: "string" },
                phone: { type: "string" }
              }
            }
          }
        }
      }
    });

    // Filter out bad results
    const makers = (result?.decision_makers || []).filter(p =>
      p.first_name && p.last_name && p.job_title &&
      p.first_name.length > 1 && p.last_name.length > 1
    );

    return Response.json({
      success: true,
      lead_id,
      company_name: lead.company_name,
      company_size: lead.company_size,
      website: cleanWebsite,
      country: lead.country || lead.location,
      decision_makers: makers
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});