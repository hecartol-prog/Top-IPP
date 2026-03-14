import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const HUBSPOT_BASE = 'https://api.hubapi.com';

async function hubspotGet(accessToken, path, params = {}) {
  const url = new URL(`${HUBSPOT_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error(`HubSpot GET ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function hubspotPost(accessToken, path, body) {
  const res = await fetch(`${HUBSPOT_BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`HubSpot POST ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// Map HubSpot contact → CRM Lead
function hsContactToLead(c) {
  const p = c.properties || {};
  return {
    first_name: p.firstname || '',
    last_name: p.lastname || '',
    email: p.email || '',
    phone: p.phone || '',
    job_title: p.jobtitle || '',
    company_name: p.company || '',
    notes: p.hs_lead_status ? `HubSpot lead status: ${p.hs_lead_status}` : '',
    source: 'other',
    status: 'new',
  };
}

// Map HubSpot company → CRM Company
function hsCompanyToCompany(c) {
  const p = c.properties || {};
  return {
    name: p.name || '',
    website: p.website || '',
    industry: p.industry || '',
    description: p.description || '',
    location: p.city ? `${p.city}, ${p.country || ''}`.trim().replace(/,\s*$/, '') : (p.country || ''),
  };
}

// Map CRM Lead → HubSpot contact properties
function leadToHsContact(lead) {
  return {
    properties: {
      firstname: lead.first_name || '',
      lastname: lead.last_name || '',
      email: lead.email || '',
      phone: lead.phone || '',
      jobtitle: lead.job_title || '',
      company: lead.company_name || '',
    }
  };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const action = body.action || 'import_contacts';

  const { accessToken } = await base44.asServiceRole.connectors.getConnection('hubspot');

  if (action === 'import_contacts') {
    // Pull contacts from HubSpot and create leads in CRM (skip existing emails)
    const data = await hubspotGet(accessToken, '/crm/v3/objects/contacts', {
      limit: 100,
      properties: 'firstname,lastname,email,phone,jobtitle,company,hs_lead_status'
    });

    const existingLeads = await base44.asServiceRole.entities.Lead.list();
    const existingEmails = new Set(existingLeads.map(l => l.email).filter(Boolean));

    const toCreate = (data.results || [])
      .map(hsContactToLead)
      .filter(l => l.email && !existingEmails.has(l.email));

    let created = 0;
    for (const lead of toCreate) {
      await base44.asServiceRole.entities.Lead.create(lead);
      created++;
    }

    return Response.json({
      success: true,
      total_fetched: (data.results || []).length,
      created,
      skipped: (data.results || []).length - created
    });
  }

  if (action === 'import_companies') {
    const data = await hubspotGet(accessToken, '/crm/v3/objects/companies', {
      limit: 100,
      properties: 'name,website,industry,description,city,country'
    });

    const existingCompanies = await base44.asServiceRole.entities.Company.list();
    const existingNames = new Set(existingCompanies.map(c => c.name?.toLowerCase()).filter(Boolean));

    const toCreate = (data.results || [])
      .map(hsCompanyToCompany)
      .filter(c => c.name && !existingNames.has(c.name.toLowerCase()));

    let created = 0;
    for (const company of toCreate) {
      await base44.asServiceRole.entities.Company.create(company);
      created++;
    }

    return Response.json({
      success: true,
      total_fetched: (data.results || []).length,
      created,
      skipped: (data.results || []).length - created
    });
  }

  if (action === 'export_leads') {
    // Push all CRM leads to HubSpot as contacts (skip if email already exists)
    const leads = await base44.asServiceRole.entities.Lead.list();

    // Get existing HubSpot contacts to avoid duplicates
    const existing = await hubspotGet(accessToken, '/crm/v3/objects/contacts', {
      limit: 100,
      properties: 'email'
    });
    const existingHsEmails = new Set(
      (existing.results || []).map(c => c.properties?.email).filter(Boolean)
    );

    let created = 0, skipped = 0;
    for (const lead of leads) {
      if (!lead.email || existingHsEmails.has(lead.email)) { skipped++; continue; }
      await hubspotPost(accessToken, '/crm/v3/objects/contacts', leadToHsContact(lead));
      created++;
    }

    return Response.json({ success: true, created, skipped });
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 });
});