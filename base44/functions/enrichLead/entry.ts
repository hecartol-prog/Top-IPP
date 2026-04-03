import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function isValidEmail(v) {
  return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}
function isValidUrl(v) {
  if (!v || typeof v !== 'string') return false;
  try { new URL(v.startsWith('http') ? v : 'https://' + v); return true; } catch { return false; }
}
function isValidLinkedIn(v) {
  return typeof v === 'string' && /linkedin\.com\/(in|company)\/[a-zA-Z0-9\-_%]+/.test(v);
}
function isValidPhone(v) {
  return typeof v === 'string' && v.replace(/[\s\-().+]/g, '').length >= 7;
}
function isValidCompanySize(v) {
  return ["1-10","11-50","51-200","201-500","501-1000","1000+"].includes(v);
}
function normalizeUrl(v) {
  if (!v) return null;
  v = v.trim();
  if (!v.startsWith('http')) v = 'https://' + v;
  try { return new URL(v).href; } catch { return null; }
}

// Clean a raw field value that may have label prefixes like "Website: ...", "Email: ..."
function cleanFieldValue(v) {
  if (!v || typeof v !== 'string') return v;
  // Strip common label prefixes
  return v.replace(/^(website|email|phone|telephone|tel|url|linkedin)\s*:\s*/i, '').trim();
}

// Fetch website text with a hard 10s timeout
async function fetchWebsiteText(website) {
  try {
    website = cleanFieldValue(website);
    const url = website.startsWith('http') ? website : 'https://' + website;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      redirect: 'follow',
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

// Fetch a Google search result page and return raw text snippets
async function fetchSearchSnippets(query) {
  try {
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=5`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
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
    // Extract visible text from search result snippets
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 5000);
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { lead_id, event, fields: requestedFields, only_missing } = body;

    const id = lead_id || event?.entity_id;
    if (!id) return Response.json({ error: 'lead_id is required' }, { status: 400 });

    const lead = await base44.asServiceRole.entities.Lead.get(id);
    if (!lead) return Response.json({ error: 'Lead not found' }, { status: 404 });

    const allFields = ['email','phone','website','linkedin_url','job_title','industry','company_size','location','country','notes'];
    const targetFields = requestedFields?.length > 0 ? requestedFields : allFields;

    const isMissing = (val) => {
      if (!val) return true;
      if (typeof val === 'string' && val.trim() === '') return true;
      return false;
    };

    const fieldsToEnrich = targetFields.filter(f => {
      if (only_missing === false) return true;
      return isMissing(lead[f]);
    });

    if (fieldsToEnrich.length === 0) {
      return Response.json({ success: true, message: 'Nothing to enrich', fields_updated: [] });
    }

    const contactName = [lead.first_name, lead.last_name].filter(Boolean).join(' ');
    const cleanWebsite = lead.website ? cleanFieldValue(lead.website) : null;
    const companyDomain = cleanWebsite
      ? (() => { try { return new URL(cleanWebsite.startsWith('http') ? cleanWebsite : 'https://' + cleanWebsite).hostname; } catch { return null; } })()
      : null;

    // STEP 1: Scrape the company website if available
    let websiteText = null;
    if (cleanWebsite) {
      websiteText = await fetchWebsiteText(cleanWebsite);
    }

    // STEP 2: Fetch Google search snippets for extra context
    const searchQuery = `${lead.company_name} ${lead.location || ''} plastic injection mold contact email phone`;
    const searchText = await fetchSearchSnippets(searchQuery);

    // Combine all context
    const combinedContext = [
      websiteText ? `=== WEBSITE CONTENT (${lead.website}) ===\n${websiteText}` : null,
      searchText ? `=== GOOGLE SEARCH RESULTS ===\n${searchText}` : null
    ].filter(Boolean).join('\n\n');

    if (!combinedContext) {
      return Response.json({ success: true, message: 'No context available to enrich', fields_updated: [] });
    }

    // STEP 3: Single fast LLM call (no internet = no timeout risk)
    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a B2B data extractor for a plastic injection mold / manufacturing company CRM.

Extract information about: ${lead.company_name} (${contactName || 'no contact name'})

Fields needed: ${fieldsToEnrich.join(', ')}

Rules:
- email: must contain @, must match company domain (${companyDomain || 'unknown'}), NOT gmail/yahoo/hotmail
- phone: real phone number from the text
- linkedin_url: real linkedin.com/in/ or linkedin.com/company/ URL from the text  
- website: official company domain
- company_size: MUST be exactly one of: "1-10","11-50","51-200","201-500","501-1000","1000+"
- notes: write a 2-3 sentence summary of what the company does based on the text
- country: infer from location/address if present (e.g. "United Kingdom", "USA")
- Return null for fields you cannot determine

Source text:
${combinedContext}`,
      response_json_schema: {
        type: "object",
        properties: {
          email: { type: "string" },
          phone: { type: "string" },
          website: { type: "string" },
          linkedin_url: { type: "string" },
          job_title: { type: "string" },
          industry: { type: "string" },
          company_size: { type: "string" },
          location: { type: "string" },
          country: { type: "string" },
          notes: { type: "string" }
        }
      }
    });

    // Validate and collect updates
    const updates = {};

    if (fieldsToEnrich.includes('email') && isValidEmail(result.email)) {
      const emailDomain = result.email.split('@')[1]?.toLowerCase();
      if (!companyDomain || emailDomain === companyDomain) {
        updates.email = result.email.trim().toLowerCase();
      }
    }
    if (fieldsToEnrich.includes('phone') && isValidPhone(result.phone)) {
      updates.phone = result.phone.trim();
    }
    if (fieldsToEnrich.includes('website') && isValidUrl(result.website)) {
      updates.website = normalizeUrl(result.website);
    }
    if (fieldsToEnrich.includes('linkedin_url') && isValidLinkedIn(result.linkedin_url)) {
      updates.linkedin_url = result.linkedin_url.trim();
    }
    if (fieldsToEnrich.includes('job_title') && result.job_title?.length > 1) {
      updates.job_title = result.job_title.trim();
    }
    if (fieldsToEnrich.includes('industry') && result.industry?.length > 2) {
      updates.industry = result.industry.trim();
    }
    if (fieldsToEnrich.includes('company_size') && isValidCompanySize(result.company_size)) {
      updates.company_size = result.company_size;
    }
    if (fieldsToEnrich.includes('location') && result.location?.length > 2) {
      updates.location = result.location.trim();
    }
    if (fieldsToEnrich.includes('country') && result.country?.length > 1) {
      updates.country = result.country.trim();
    }
    if (fieldsToEnrich.includes('notes') && result.notes?.length > 20) {
      updates.notes = result.notes.trim();
    }

    if (Object.keys(updates).length > 0) {
      await base44.asServiceRole.entities.Lead.update(id, updates);
    }

    return Response.json({
      success: true,
      lead_id: id,
      fields_checked: fieldsToEnrich,
      fields_updated: Object.keys(updates),
      updated: updates
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});