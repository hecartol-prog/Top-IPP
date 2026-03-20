import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// --- Validation helpers ---
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

// --- Step 1: Try to scrape the company website directly ---
async function fetchWebsiteText(website) {
  try {
    const url = website.startsWith('http') ? website : 'https://' + website;
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' });
    if (!resp.ok) return null;
    let html = await resp.text();
    // Strip tags, collapse whitespace
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 8000);
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

    // Determine which fields to enrich
    const fieldsToEnrich = targetFields.filter(f => {
      if (only_missing === false) return true; // force-refresh all
      return !lead[f]; // default: only missing
    });

    if (fieldsToEnrich.length === 0) {
      return Response.json({ success: true, message: 'Nothing to enrich', fields_updated: [] });
    }

    const contactName = [lead.first_name, lead.last_name].filter(Boolean).join(' ');
    const companyDomain = lead.website
      ? (() => { try { return new URL(lead.website.startsWith('http') ? lead.website : 'https://' + lead.website).hostname; } catch { return null; } })()
      : null;

    // --- Step 1: Extract directly from website if available ---
    let websiteData = {};
    if (lead.website && fieldsToEnrich.some(f => ['email','phone','location','industry','company_size','notes'].includes(f))) {
      const siteText = await fetchWebsiteText(lead.website);
      if (siteText) {
        const siteResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Extract factual company information ONLY from the following website text for a company in the plastic injection mold / manufacturing / packaging industry.
Do NOT guess or invent anything. If a field is not explicitly present in the text, return null.

Company: ${lead.company_name}
Contact: ${contactName || 'Unknown'}
Expected industry: plastic injection molds, packaging, manufacturing

Website text:
${siteText}

Extract ONLY what is explicitly stated in the text above.
- email: company contact email (must contain @, must match domain ${companyDomain || 'of the company'}, not a generic provider)
- phone: company phone number (must be a real number with digits, explicitly listed on the page)
- location: city/country where the company is headquartered (only if explicitly stated)
- industry: the business sector/industry (only if explicitly stated)
- company_size: employee count (use ONLY: "1-10","11-50","51-200","201-500","501-1000","1000+")
- notes: 2-3 sentence factual summary of what the company does and their manufacturing capabilities, based strictly on the website text

Return null for anything not explicitly present. Do not infer or construct data.`,
          response_json_schema: {
            type: "object",
            properties: {
              email: { type: "string" },
              phone: { type: "string" },
              location: { type: "string" },
              industry: { type: "string" },
              company_size: { type: "string" },
              notes: { type: "string" }
            }
          }
        });
        // Only accept fields from website that pass validation
        if (siteResult.email && isValidEmail(siteResult.email)) websiteData.email = siteResult.email.trim();
        if (siteResult.phone && isValidPhone(siteResult.phone)) websiteData.phone = siteResult.phone.trim();
        if (siteResult.location && siteResult.location.length > 2) websiteData.location = siteResult.location.trim();
        if (siteResult.industry && siteResult.industry.length > 2) websiteData.industry = siteResult.industry.trim();
        if (siteResult.company_size && isValidCompanySize(siteResult.company_size)) websiteData.company_size = siteResult.company_size;
        if (siteResult.notes && siteResult.notes.length > 20) websiteData.notes = siteResult.notes.trim();
      }
    }

    // --- Step 2: Internet search for fields still missing ---
    const stillMissing = fieldsToEnrich.filter(f => !websiteData[f]);

    let searchData = {};
    if (stillMissing.length > 0) {
      const searchResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        model: "gemini_3_flash",
        add_context_from_internet: true,
        prompt: `You are a B2B data researcher specializing in the plastic injection mold and manufacturing industry. Find VERIFIED information about this company/person from the web.

ANTI-HOMONYM RULES — CRITICAL:
- This company operates in: plastics, injection molds, packaging, or related manufacturing.
- There may be OTHER companies or people with the same name in different industries. IGNORE them entirely.
- Only return data you can confirm belongs to "${lead.company_name}" in the plastics/manufacturing industry.
- For LinkedIn: only accept a profile where the person's employer is "${lead.company_name}" and their industry/role relates to plastics or manufacturing.
- For email: must belong to the domain of ${lead.website ? lead.website : `"${lead.company_name}"`}, not a generic provider like gmail.
- If the data could belong to a namesake company or person, return null — do not guess.

ACCURACY RULES:
1. ONLY return data you found on a real, publicly accessible web page.
2. For each sensitive field (email, phone, linkedin_url), you MUST provide the source_url where you found it.
3. If you are not at least 85% confident the field belongs to THIS exact company and person, return null.
4. Do NOT guess, infer, or construct data. Only report what you actually found and confirmed.
5. Email: must be from a verifiable source. Do NOT construct email patterns (e.g. firstname@company.com).
6. Phone: must be explicitly listed on a website. Do NOT guess area codes.
7. LinkedIn URL: must be a real linkedin.com/in/ or linkedin.com/company/ URL where the company or person is confirmed.
8. Website: must be the official company domain, confirmed to be for this plastics/manufacturing company.

Lead to research:
- Company: ${lead.company_name}
- Contact: ${contactName || 'None known'}
- Job Title: ${lead.job_title || 'Unknown'}
- Known website: ${lead.website || 'Unknown'}
- Known location: ${lead.location || 'Unknown'}
- Known industry: ${lead.industry || 'plastic injection molds, manufacturing'}

Fields needed: ${stillMissing.join(', ')}

Search queries to use:
1. "${lead.company_name} ${lead.location || ''} plastic injection mold official website contact"
2. "${contactName ? contactName + ' ' + lead.company_name + ' LinkedIn plastic' : lead.company_name + ' plastic injection LinkedIn company'}"
3. "${lead.company_name} ${lead.location || ''} employees industry manufacturing"

Return the found data plus source_urls for sensitive fields, and explain how you confirmed this is the right company (not a namesake).`,
        response_json_schema: {
          type: "object",
          properties: {
            email: { type: "string" },
            email_source_url: { type: "string" },
            phone: { type: "string" },
            phone_source_url: { type: "string" },
            website: { type: "string" },
            linkedin_url: { type: "string" },
            linkedin_source_url: { type: "string" },
            job_title: { type: "string" },
            industry: { type: "string" },
            company_size: { type: "string" },
            location: { type: "string" },
            country: { type: "string" },
            notes: { type: "string" }
          }
        }
      });

      // Validate each field strictly before accepting
      if (stillMissing.includes('email') && isValidEmail(searchResult.email)) {
        // Extra check: if company domain known, email should match it
        const emailDomain = searchResult.email.split('@')[1]?.toLowerCase();
        if (!companyDomain || emailDomain === companyDomain || (searchResult.email_source_url && isValidUrl(searchResult.email_source_url))) {
          searchData.email = searchResult.email.trim().toLowerCase();
        }
      }
      if (stillMissing.includes('phone') && isValidPhone(searchResult.phone) && searchResult.phone_source_url) {
        searchData.phone = searchResult.phone.trim();
      }
      if (stillMissing.includes('website') && isValidUrl(searchResult.website)) {
        searchData.website = normalizeUrl(searchResult.website);
      }
      if (stillMissing.includes('linkedin_url') && isValidLinkedIn(searchResult.linkedin_url)) {
        searchData.linkedin_url = searchResult.linkedin_url.trim();
      }
      if (stillMissing.includes('job_title') && searchResult.job_title?.length > 1) {
        searchData.job_title = searchResult.job_title.trim();
      }
      if (stillMissing.includes('industry') && searchResult.industry?.length > 2) {
        searchData.industry = searchResult.industry.trim();
      }
      if (stillMissing.includes('company_size') && isValidCompanySize(searchResult.company_size)) {
        searchData.company_size = searchResult.company_size;
      }
      if (stillMissing.includes('location') && searchResult.location?.length > 2) {
        searchData.location = searchResult.location.trim();
      }
      if (stillMissing.includes('country') && searchResult.country?.length > 1) {
        searchData.country = searchResult.country.trim();
      }
      if (stillMissing.includes('notes') && searchResult.notes?.length > 20) {
        searchData.notes = searchResult.notes.trim();
      }
    }

    // Merge: website data takes priority over search data for overlapping fields
    const updates = {};
    for (const f of fieldsToEnrich) {
      const val = websiteData[f] || searchData[f];
      if (val) updates[f] = val;
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