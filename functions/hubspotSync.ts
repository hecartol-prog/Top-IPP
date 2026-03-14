import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, data } = await req.json();
    const { accessToken } = await base44.asServiceRole.connectors.getConnection("hubspot");

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    // --- CONTACTS ---
    if (action === 'getContacts') {
      const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=firstname,lastname,email,phone,jobtitle,company,hs_lead_status', { headers });
      const json = await res.json();
      return Response.json(json);
    }

    if (action === 'createContact') {
      const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
        method: 'POST',
        headers,
        body: JSON.stringify({ properties: data }),
      });
      const json = await res.json();
      return Response.json(json);
    }

    if (action === 'updateContact') {
      const { id, properties } = data;
      const res = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ properties }),
      });
      const json = await res.json();
      return Response.json(json);
    }

    // --- COMPANIES ---
    if (action === 'getCompanies') {
      const res = await fetch('https://api.hubapi.com/crm/v3/objects/companies?limit=100&properties=name,domain,industry,numberofemployees,annualrevenue,city,country', { headers });
      const json = await res.json();
      return Response.json(json);
    }

    if (action === 'createCompany') {
      const res = await fetch('https://api.hubapi.com/crm/v3/objects/companies', {
        method: 'POST',
        headers,
        body: JSON.stringify({ properties: data }),
      });
      const json = await res.json();
      return Response.json(json);
    }

    // --- DEALS ---
    if (action === 'getDeals') {
      const res = await fetch('https://api.hubapi.com/crm/v3/objects/deals?limit=100&properties=dealname,amount,dealstage,closedate,pipeline', { headers });
      const json = await res.json();
      return Response.json(json);
    }

    if (action === 'createDeal') {
      const res = await fetch('https://api.hubapi.com/crm/v3/objects/deals', {
        method: 'POST',
        headers,
        body: JSON.stringify({ properties: data }),
      });
      const json = await res.json();
      return Response.json(json);
    }

    // --- SYNC: Push leads to HubSpot as contacts ---
    if (action === 'syncLeadsToHubSpot') {
      const leads = data.leads;
      const results = { created: 0, failed: 0, errors: [] };

      for (const lead of leads) {
        const contactProps = {
          firstname: lead.first_name || '',
          lastname: lead.last_name || '',
          email: lead.email || '',
          phone: lead.phone || '',
          jobtitle: lead.job_title || '',
          company: lead.company_name || '',
          website: lead.website || '',
          hs_lead_status: lead.status === 'won' ? 'CUSTOMER' : lead.status === 'lost' ? 'UNQUALIFIED' : 'NEW',
        };

        const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
          method: 'POST',
          headers,
          body: JSON.stringify({ properties: contactProps }),
        });
        const json = await res.json();

        if (res.ok) {
          results.created++;
        } else if (json.category === 'CONFLICT') {
          // Contact already exists, skip
          results.created++;
        } else {
          results.failed++;
          results.errors.push(json.message || 'Unknown error');
        }
      }

      return Response.json(results);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});