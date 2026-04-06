import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

var APOLLO_API_KEY = Deno.env.get('APOLLO_API_KEY');
var APOLLO_BASE = 'https://api.apollo.io/v1';

function mapEmployeeCount(count) {
  if (!count) return null;
  if (count <= 10) return '1-10';
  if (count <= 50) return '11-50';
  if (count <= 200) return '51-200';
  if (count <= 500) return '201-500';
  if (count <= 1000) return '501-1000';
  return '1000+';
}

function mapRevenue(r) {
  if (!r) return null;
  if (r < 1000000) return '<$1M';
  if (r < 10000000) return '$1M-$10M';
  if (r < 50000000) return '$10M-$50M';
  if (r < 100000000) return '$50M-$100M';
  if (r < 500000000) return '$100M-$500M';
  return '$500M+';
}

async function freeEnrichFallback(lead) {
  var results = {};

  if (lead.company_name) {
    try {
      var cbUrl = 'https://autocomplete.clearbit.com/v1/companies/suggest?query=' + encodeURIComponent(lead.company_name);
      var cbResp = await fetch(cbUrl, { signal: AbortSignal.timeout(5000) });
      if (cbResp.ok) {
        var cbData = await cbResp.json();
        if (cbData && cbData[0] && cbData[0].domain) {
          results.domain = cbData[0].domain;
        }
      }
    } catch (e) {}
  }

  var website = lead.website || (results.domain ? 'https://' + results.domain : null);
  if (website) {
    try {
      var siteUrl = website.startsWith('http') ? website : 'https://' + website;
      var siteResp = await fetch(siteUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(10000),
        redirect: 'follow'
      });
      if (siteResp.ok) {
        var siteHtml = await siteResp.text();
        var siteText = siteHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
        try {
          var domain = results.domain || new URL(siteUrl).hostname;
          var safeDomain = domain.replace('.', '\\.');
          var emailRe = new RegExp('[a-zA-Z0-9._%+\\-]+@' + safeDomain, 'g');
          var emails = siteText.match(emailRe);
          if (emails && emails.length > 0) {
            results.email = emails[0].toLowerCase();
          }
        } catch (e) {}
        var phones = siteText.match(/[\+]?[\d][\d\s\-\(\)\.]{8,18}[\d]/g);
        if (phones && phones.length > 0) {
          results.phone = phones[0].trim();
        }
        results.website_text = siteText.slice(0, 2000);
      }
    } catch (e) {}
  }

  try {
    var ddgQuery = lead.company_name + ' ' + (lead.country || '') + ' contact email phone';
    var ddgResp = await fetch(
      'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(ddgQuery),
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) }
    );
    if (ddgResp.ok) {
      var ddgHtml = await ddgResp.text();
      results.search_text = ddgHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 3000);
    }
  } catch (e) {}

  return results;
}

Deno.serve(async function(req) {
  try {
    var base44 = createClientFromRequest(req);
    var user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    var body = await req.json();
    var lead_id = body.lead_id;
    var only_missing = body.only_missing !== false;

    if (!lead_id) return Response.json({ error: 'lead_id required' }, { status: 400 });

    var leads = await base44.entities.Lead.filter({ id: lead_id });
    var lead = leads[0];
    if (!lead) return Response.json({ error: 'Lead not found' }, { status: 404 });

    var updatedFields = [];
    var updates = {};
    var source = 'free_web';

    function fill(field, value) {
      if (!value) return;
      if (only_missing && lead[field]) return;
      updates[field] = value;
      updatedFields.push(field);
    }

    if (APOLLO_API_KEY) {
      try {
        source = 'apollo';
        var contactData = null;
        var orgData = null;

        var peopleBody = {};
        if (lead.email) {
          peopleBody.email = lead.email;
        }
        if (lead.linkedin_url) {
          peopleBody.linkedin_url = lead.linkedin_url;
        }
        if (!peopleBody.email && !peopleBody.linkedin_url && lead.first_name && lead.last_name) {
          peopleBody.first_name = lead.first_name;
          peopleBody.last_name = lead.last_name;
          if (lead.company_name) {
            peopleBody.organization_name = lead.company_name;
          }
        }

        if (Object.keys(peopleBody).length > 0) {
          var apolloPayload = Object.assign({}, peopleBody, { reveal_personal_emails: true });
          var pr = await fetch(APOLLO_BASE + '/people/match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Api-Key': APOLLO_API_KEY },
            body: JSON.stringify(apolloPayload),
            signal: AbortSignal.timeout(10000)
          });
          if (pr.ok) {
            var prData = await pr.json();
            contactData = (prData && prData.person) ? prData.person : null;
          }
        }

        var orgDomain = null;
        if (lead.website) {
          orgDomain = lead.website.replace(/https?:\/\//i, '').replace(/\/.*/, '');
        }
        var orgBody = orgDomain ? { domain: orgDomain } : (lead.company_name ? { name: lead.company_name } : {});

        if (Object.keys(orgBody).length > 0) {
          var or = await fetch(APOLLO_BASE + '/organizations/enrich', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Api-Key': APOLLO_API_KEY },
            body: JSON.stringify(orgBody),
            signal: AbortSignal.timeout(10000)
          });
          if (or.ok) {
            var orData = await or.json();
            orgData = (orData && orData.organization) ? orData.organization : null;
          }
        }

        if (contactData || orgData) {
          if (contactData) {
            fill('email', contactData.email);
            var phone = (contactData.phone_numbers && contactData.phone_numbers[0])
              ? contactData.phone_numbers[0].sanitized_number
              : contactData.direct_dial_number;
            fill('phone', phone);
            fill('job_title', contactData.title);
            fill('linkedin_url', contactData.linkedin_url);
            fill('first_name', contactData.first_name);
            fill('last_name', contactData.last_name);
            if (contactData.email_status) fill('apollo_email_status', contactData.email_status);
            if (contactData.id && !lead.apollo_contact_id) {
              updates.apollo_contact_id = contactData.id;
              updatedFields.push('apollo_contact_id');
            }
          }
          if (orgData) {
            fill('company_name', orgData.name);
            fill('website', orgData.website_url);
            fill('industry', orgData.industry);
            var loc = [orgData.city, orgData.country].filter(Boolean).join(', ');
            fill('location', loc);
            fill('country', orgData.country);
            fill('company_size', mapEmployeeCount(orgData.estimated_num_employees));
            fill('revenue_range', mapRevenue(orgData.annual_revenue));
            if (orgData.linkedin_url && !lead.company_linkedin) {
              updates.company_linkedin = orgData.linkedin_url;
              updatedFields.push('company_linkedin');
            }
            if (orgData.short_description && !lead.company_description) {
              updates.company_description = orgData.short_description;
              updatedFields.push('company_description');
            }
            if (orgData.id && !lead.apollo_org_id) {
              updates.apollo_org_id = orgData.id;
              updatedFields.push('apollo_org_id');
            }
          }
        } else {
          source = 'free_web_fallback';
        }
      } catch (e) {
        console.log('Apollo error, using free fallback:', e.message);
        source = 'free_web_fallback';
      }
    }

    var checkFields = ['email','phone','website','industry','location','country','company_size','notes'];
    var stillMissing = checkFields.filter(function(f) {
      return !updates[f] && (only_missing ? !lead[f] : true);
    });

    if (stillMissing.length > 0) {
      var freeData = await freeEnrichFallback(lead);
      if (source.indexOf('apollo') < 0) source = 'free_web';

      if (stillMissing.indexOf('email') >= 0 && freeData.email) fill('email', freeData.email);
      if (stillMissing.indexOf('phone') >= 0 && freeData.phone) fill('phone', freeData.phone);
      if (stillMissing.indexOf('website') >= 0 && freeData.domain && !lead.website) {
        fill('website', 'https://' + freeData.domain);
      }

      var context = [freeData.website_text, freeData.search_text].filter(Boolean).join('\n\n');
      var llmFields = stillMissing.filter(function(f) { return !updates[f]; });

      if (llmFields.length > 0 && context.length > 100) {
        try {
          var companyLabel = lead.company_name + (lead.country ? ' (' + lead.country + ')' : '');
          var llmResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: 'Extract B2B info about: ' + companyLabel + '\n\nFields needed: ' + llmFields.join(', ') + '\n\nRules:\n- email: company domain only, NOT gmail/yahoo/hotmail\n- company_size: EXACTLY one of 1-10, 11-50, 51-200, 201-500, 501-1000, 1000+\n- country: full name e.g. Mexico, Colombia\n- Return null if not found\n\nContext:\n' + context.slice(0, 8000),
            response_json_schema: {
              type: 'object',
              properties: {
                email: { type: 'string' },
                phone: { type: 'string' },
                industry: { type: 'string' },
                company_size: { type: 'string' },
                location: { type: 'string' },
                country: { type: 'string' },
                notes: { type: 'string' }
              }
            }
          });

          var validSizes = ["1-10","11-50","51-200","201-500","501-1000","1000+"];
          if (llmFields.indexOf('email') >= 0 && !updates.email && llmResult.email && llmResult.email.indexOf('@') >= 0 && llmResult.email.indexOf('gmail') < 0 && llmResult.email.indexOf('yahoo') < 0) {
            fill('email', llmResult.email.trim().toLowerCase());
          }
          if (llmFields.indexOf('phone') >= 0 && !updates.phone && llmResult.phone) fill('phone', llmResult.phone.trim());
          if (llmFields.indexOf('industry') >= 0 && llmResult.industry && llmResult.industry.length > 2) fill('industry', llmResult.industry.trim());
          if (llmFields.indexOf('company_size') >= 0 && validSizes.indexOf(llmResult.company_size) >= 0) fill('company_size', llmResult.company_size);
          if (llmFields.indexOf('location') >= 0 && llmResult.location && llmResult.location.length > 2) fill('location', llmResult.location.trim());
          if (llmFields.indexOf('country') >= 0 && llmResult.country && llmResult.country.length > 1) fill('country', llmResult.country.trim());
          if (llmFields.indexOf('notes') >= 0 && llmResult.notes && llmResult.notes.length > 20) fill('notes', llmResult.notes.trim());
        } catch (e) { console.log('LLM error:', e.message); }
      }
    }

    updates.apollo_enrichment_status = APOLLO_API_KEY ? 'enriched' : 'free_enriched';
    updates.apollo_last_enriched = new Date().toISOString();
    if (Object.keys(updates).length > 0) {
      await base44.entities.Lead.update(lead.id, updates);
    }

    try {
      var cleanFields = updatedFields.filter(function(f) { return f.indexOf('apollo_') !== 0; });
      await base44.entities.Activity.create({
        lead_id: lead.id,
        type: 'note',
        title: updatedFields.length > 0 ? 'Lead enriched (' + source + ')' : 'Enrichment - no new data',
        description: updatedFields.length > 0
          ? 'Updated: ' + cleanFields.join(', ') + ' via ' + source
          : 'Ran enrichment but found no new data.',
        outcome: updatedFields.length > 0 ? 'positive' : 'neutral',
        completed: true
      });
    } catch (e) {}

    return Response.json({
      success: true,
      source: source,
      fields_updated: updatedFields,
      message: updatedFields.length > 0
        ? 'Enriched ' + updatedFields.length + ' field(s) via ' + source
        : 'No new data found'
    });

  } catch (error) {
    console.error('apolloEnrich error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
