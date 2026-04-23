import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

async function fetchWebsiteText(url) {
  try {
    const clean = url.startsWith('http') ? url : 'https://' + url;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const resp = await fetch(clean, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36' },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const html = await resp.text();
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 5000);
  } catch {
    return null;
  }
}

async function fetchSearchSnippets(query) {
  // Try DuckDuckGo first (free, no API key, not rate-limited like Google)
  try {
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(ddgUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120' },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (resp.ok) {
      const html = await resp.text();
      const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 5000);
      if (text.length > 200) return text;
    }
  } catch {}

  // Fallback: Bing
  try {
    const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=5`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(bingUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120' },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const html = await resp.text();
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 5000);
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { lead_id } = await req.json();
    if (!lead_id) return Response.json({ error: 'lead_id is required' }, { status: 400 });

    const lead = await base44.asServiceRole.entities.Lead.get(lead_id);
    if (!lead) return Response.json({ error: 'Lead not found' }, { status: 404 });

    const companyName = lead.company_name;
    const website = lead.website ? lead.website.replace(/^(website|url)\s*:\s*/i, '').trim() : null;
    const location = lead.location || lead.country || '';

    // Gather context
    const websiteText = website ? await fetchWebsiteText(website) : null;
    const searchQuery = `"${companyName}" ${location} decision maker procurement manager director contact LinkedIn`;
    const searchText = await fetchSearchSnippets(searchQuery);

    const context = [
      websiteText ? `=== WEBSITE (${website}) ===\n${websiteText}` : null,
      searchText ? `=== GOOGLE SEARCH ===\n${searchText}` : null,
    ].filter(Boolean).join('\n\n');

    if (!context) {
      return Response.json({ success: true, decision_makers: [], message: 'No context found' });
    }

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a B2B lead researcher for a plastic injection mold manufacturer.
      
Find REAL decision makers / key contacts at this company: "${companyName}" (${location})
Company website: ${website || 'unknown'}

Focus on roles that matter for procurement of plastic injection molds:
- Procurement Manager / Director
- Engineering Manager / Director  
- Operations Manager / Director
- General Manager / CEO / President
- Supply Chain Manager
- Plant Manager
- VP Manufacturing
- Product Development Manager

From the sources below, extract ALL real people you can find with their names, titles, emails, phones, and LinkedIn URLs.
Only include people you can actually confirm from the text — do NOT invent names.
Return between 1 and 5 decision makers maximum.

Source text:
${context}`,
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
                phone: { type: "string" },
                linkedin_url: { type: "string" },
                confidence: { type: "string", description: "high / medium / low" },
                source_note: { type: "string", description: "where this person was found" }
              }
            }
          }
        }
      }
    });

    const decisionMakers = (result?.decision_makers || []).filter(dm => dm.first_name || dm.last_name);

    return Response.json({
      success: true,
      lead_id,
      company_name: companyName,
      decision_makers: decisionMakers
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});