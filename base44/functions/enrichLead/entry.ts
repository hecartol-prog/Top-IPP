import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function isValidEmail(v) {
  if (!v || typeof v !== 'string') return false;
  var banned = ['example','test','domain','yourname','sentry','wix','schema','png','jpg','css','js'];
  for (var i = 0; i < banned.length; i++) {
    if (v.toLowerCase().indexOf(banned[i]) >= 0) return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}

function isValidPhone(v) {
  return typeof v === 'string' && v.replace(/[\s\-().+]/g, '').length >= 7;
}

function isValidUrl(v) {
  if (!v || typeof v !== 'string') return false;
  try {
    new URL(v.startsWith('http') ? v : 'https://' + v);
    return true;
  } catch (e) { return false; }
}

function isValidLinkedIn(v) {
  return typeof v === 'string' && /linkedin\.com\/(in|company)\/[a-zA-Z0-9\-_%]+/.test(v);
}

function isValidCompanySize(v) {
  var sizes = ["1-10","11-50","51-200","201-500","501-1000","1000+"];
  return sizes.indexOf(v) >= 0;
}

function normalizeUrl(v) {
  if (!v) return null;
  v = v.trim();
  if (!v.startsWith('http')) v = 'https://' + v;
  try { return new URL(v).href; } catch (e) { return null; }
}

function cleanField(v) {
  if (!v || typeof v !== 'string') return v;
  return v.replace(/^(website|email|phone|telephone|tel|url|linkedin)\s*:\s*/i, '').trim();
}

async function fetchUrl(url, timeoutMs) {
  if (!timeoutMs) timeoutMs = 12000;
  var controller = new AbortController();
  var timer = setTimeout(function() { controller.abort(); }, timeoutMs);
  try {
    var resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept': 'text/html,*/*;q=0.9',
        'Accept-Language': 'en-US,en;q=0.9,es;q=0.8'
      },
      signal: controller.signal,
      redirect: 'follow'
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    return await resp.text();
  } catch (e) {
    clearTimeout(timer);
    return null;
  }
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

async function scrapeWebsite(website) {
  if (!website) return null;
  website = cleanField(website);
  var url = website.startsWith('http') ? website : 'https://' + website;
  var html = await fetchUrl(url, 12000);
  if (!html) return null;
  var text = htmlToText(html);
  var contactText = '';
  try {
    var baseUrl = new URL(url);
    var paths = ['/contact', '/contact-us', '/contacto', '/about', '/about-us'];
    for (var i = 0; i < paths.length; i++) {
      var cHtml = await fetchUrl(baseUrl.protocol + '//' + baseUrl.host + paths[i], 8000);
      if (cHtml && cHtml.length > 500) {
        contactText = htmlToText(cHtml).slice(0, 3000);
        break;
      }
    }
  } catch (e) {}
  var output = '=== WEBSITE: ' + url + ' ===\n' + text.slice(0, 4000);
  if (contactText) output += '\n=== CONTACT PAGE ===\n' + contactText;
  return output;
}

async function searchDuckDuckGo(query) {
  var url = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query);
  var html = await fetchUrl(url, 10000);
  if (!html) return null;
  return '=== DUCKDUCKGO ===\n' + htmlToText(html).slice(0, 4000);
}

async function searchBing(query) {
  var url = 'https://www.bing.com/search?q=' + encodeURIComponent(query) + '&count=5';
  var html = await fetchUrl(url, 10000);
  if (!html) return null;
  return '=== BING ===\n' + htmlToText(html).slice(0, 3000);
}

async function clearbitLookup(companyName) {
  try {
    var resp = await fetchUrl('https://autocomplete.clearbit.com/v1/companies/suggest?query=' + encodeURIComponent(companyName), 5000);
    if (!resp) return null;
    var data = JSON.parse(resp);
    if (!data || !data.length) return null;
    return '=== CLEARBIT: ' + data[0].name + ' | Domain: ' + data[0].domain + ' ===';
  } catch (e) { return null; }
}

async function tryApollo(lead) {
  var key = Deno.env.get('APOLLO_API_KEY');
  if (!key) return null;
  try {
    var body = {};
    if (lead.email) {
      body.email = lead.email;
    } else if (lead.first_name && lead.last_name) {
      body.first_name = lead.first_name;
      body.last_name = lead.last_name;
      if (lead.company_name) {
        body.organization_name = lead.company_name;
      }
    }
    if (Object.keys(body).length === 0) return null;
    var payload = Object.assign({}, body, { reveal_personal_emails: true });
    var res = await fetch('https://api.apollo.io/v1/people/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': key },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) return null;
    var data = await res.json();
    return (data && data.person) ? data.person : null;
  } catch (e) { return null; }
}

async function tryHunter(domain, firstName, lastName) {
  var key = Deno.env.get('HUNTER_API_KEY');
  if (!key || !domain || !firstName || !lastName) return null;
  try {
    var url = 'https://api.hunter.io/v2/email-finder'
      + '?domain=' + encodeURIComponent(domain)
      + '&first_name=' + encodeURIComponent(firstName)
      + '&last_name=' + encodeURIComponent(lastName)
      + '&api_key=' + key;
    var resp = await fetchUrl(url, 8000);
    if (!resp) return null;
    var data = JSON.parse(resp);
    return (data && data.data && data.data.email) ? data.data.email : null;
  } catch (e) { return null; }
}

Deno.serve(async function(req) {
  try {
    var base44 = createClientFromRequest(req);
    var body = await req.json();
    var lead_id = body.lead_id || (body.event && body.event.entity_id);
    var requestedFields = body.fields;
    var only_missing = body.only_missing;

    if (!lead_id) return Response.json({ error: 'lead_id is required' }, { status: 400 });

    var lead = await base44.asServiceRole.entities.Lead.get(lead_id);
    if (!lead) return Response.json({ error: 'Lead not found' }, { status: 404 });

    var allFields = ['email','phone','website','linkedin_url','job_title','industry','company_size','location','country','notes'];
    var targetFields = (requestedFields && requestedFields.length > 0) ? requestedFields : allFields;

    function isMissing(val) {
      return !val || (typeof val === 'string' && val.trim() === '');
    }

    var fieldsToEnrich = targetFields.filter(function(f) {
      return only_missing === false ? true : isMissing(lead[f]);
    });

    if (fieldsToEnrich.length === 0) {
      return Response.json({ success: true, message: 'Nothing to enrich', fields_updated: [] });
    }

    var contactName = [lead.first_name, lead.last_name].filter(Boolean).join(' ');
    var cleanWebsite = lead.website ? cleanField(lead.website) : null;
    var companyDomain = null;

    if (cleanWebsite) {
      try {
        var wu = cleanWebsite.startsWith('http') ? cleanWebsite : 'https://' + cleanWebsite;
        companyDomain = new URL(wu).hostname;
      } catch (e) {}
    }

    var companyCountry = lead.country || lead.location || '';
    var searchQuery = lead.company_name + ' ' + companyCountry + ' email contact phone';
    var searchQuery2 = lead.company_name + ' official email contact';

    var settled = await Promise.allSettled([
      scrapeWebsite(cleanWebsite),
      searchDuckDuckGo(searchQuery),
      searchBing(searchQuery2),
      clearbitLookup(lead.company_name || ''),
      tryApollo(lead)
    ]);

    var contextParts = [
      settled[0].status === 'fulfilled' ? settled[0].value : null,
      settled[1].status === 'fulfilled' ? settled[1].value : null,
      settled[2].status === 'fulfilled' ? settled[2].value : null,
      settled[3].status === 'fulfilled' ? settled[3].value : null
    ].filter(Boolean);

    var apollo = settled[4].status === 'fulfilled' ? settled[4].value : null;
    var combinedContext = contextParts.join('\n\n');
    var updates = {};

    if (apollo) {
      if (fieldsToEnrich.indexOf('email') >= 0 && apollo.email && isValidEmail(apollo.email)) {
        updates.email = apollo.email;
      }
      if (fieldsToEnrich.indexOf('phone') >= 0 && apollo.phone_numbers && apollo.phone_numbers[0]) {
        updates.phone = apollo.phone_numbers[0].sanitized_number;
      }
      if (fieldsToEnrich.indexOf('job_title') >= 0 && apollo.title) {
        updates.job_title = apollo.title;
      }
      if (fieldsToEnrich.indexOf('linkedin_url') >= 0 && apollo.linkedin_url) {
        updates.linkedin_url = apollo.linkedin_url;
      }
    }

    if (fieldsToEnrich.indexOf('email') >= 0 && !updates.email && companyDomain && lead.first_name && lead.last_name) {
      var hunterEmail = await tryHunter(companyDomain, lead.first_name, lead.last_name);
      if (hunterEmail && isValidEmail(hunterEmail)) {
        updates.email = hunterEmail;
      }
    }

    var stillNeeded = fieldsToEnrich.filter(function(f) { return !updates[f] && isMissing(lead[f]); });

    if (stillNeeded.length > 0 && combinedContext.length > 100) {
      try {
        var companyInfo = lead.company_name;
        if (contactName) companyInfo += ' (Contact: ' + contactName + ')';
        var domainHint = companyDomain || 'unknown';

        var result = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: 'You are a B2B data extractor for a plastic injection mold CRM.\n\nExtract info about: ' + companyInfo + '\n\nFields needed: ' + stillNeeded.join(', ') + '\n\nRules:\n- email: must have @, prefer company domain (' + domainHint + '), NOT gmail/yahoo/hotmail\n- phone: real international number\n- linkedin_url: must contain linkedin.com/in/ or linkedin.com/company/\n- website: official domain only\n- company_size: EXACTLY one of: 1-10, 11-50, 51-200, 201-500, 501-1000, 1000+\n- notes: 2-3 sentences about what the company does\n- country: full name e.g. Mexico, Colombia\n- Return null if not found\n\nSource data:\n' + combinedContext.slice(0, 12000),
          response_json_schema: {
            type: 'object',
            properties: {
              email: { type: 'string' },
              phone: { type: 'string' },
              website: { type: 'string' },
              linkedin_url: { type: 'string' },
              job_title: { type: 'string' },
              industry: { type: 'string' },
              company_size: { type: 'string' },
              location: { type: 'string' },
              country: { type: 'string' },
              notes: { type: 'string' }
            }
          }
        });

        if (stillNeeded.indexOf('email') >= 0 && !updates.email && isValidEmail(result.email)) updates.email = result.email.trim().toLowerCase();
        if (stillNeeded.indexOf('phone') >= 0 && !updates.phone && isValidPhone(result.phone)) updates.phone = result.phone.trim();
        if (stillNeeded.indexOf('website') >= 0 && !updates.website && isValidUrl(result.website)) updates.website = normalizeUrl(result.website);
        if (stillNeeded.indexOf('linkedin_url') >= 0 && !updates.linkedin_url && isValidLinkedIn(result.linkedin_url)) updates.linkedin_url = result.linkedin_url.trim();
        if (stillNeeded.indexOf('job_title') >= 0 && !updates.job_title && result.job_title && result.job_title.length > 1) updates.job_title = result.job_title.trim();
        if (stillNeeded.indexOf('industry') >= 0 && result.industry && result.industry.length > 2) updates.industry = result.industry.trim();
        if (stillNeeded.indexOf('company_size') >= 0 && isValidCompanySize(result.company_size)) updates.company_size = result.company_size;
        if (stillNeeded.indexOf('location') >= 0 && result.location && result.location.length > 2) updates.location = result.location.trim();
        if (stillNeeded.indexOf('country') >= 0 && result.country && result.country.length > 1) updates.country = result.country.trim();
        if (stillNeeded.indexOf('notes') >= 0 && result.notes && result.notes.length > 20) updates.notes = result.notes.trim();
      } catch (e) { console.error('LLM error:', e.message); }
    }

    if (Object.keys(updates).length > 0) {
      await base44.asServiceRole.entities.Lead.update(lead_id, updates);
    }

    try {
      var updatedList = Object.keys(updates).join(', ');
      await base44.asServiceRole.entities.Activity.create({
        lead_id: lead_id,
        type: 'note',
        title: Object.keys(updates).length > 0 ? 'Lead enriched via AI + Web Search' : 'Enrichment - no new data found',
        description: Object.keys(updates).length > 0
          ? 'Updated: ' + updatedList + ' | Sources: website+DDG+Bing' + (apollo ? '+Apollo' : '')
          : 'Searched ' + contextParts.length + ' sources, no data extracted.',
        outcome: Object.keys(updates).length > 0 ? 'positive' : 'neutral',
        completed: true
      });
    } catch (e) {}

    return Response.json({
      success: true,
      lead_id: lead_id,
      fields_checked: fieldsToEnrich,
      fields_updated: Object.keys(updates),
      sources_used: contextParts.length,
      apollo_used: !!apollo,
      updated: updates
    });

  } catch (error) {
    console.error('enrichLead error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});