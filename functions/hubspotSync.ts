import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('hubspot');
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'fetch_contacts';

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    // Fetch HubSpot contacts
    if (action === 'fetch_contacts') {
      const res = await fetch(
        'https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=firstname,lastname,email,phone,jobtitle,company,hs_lead_status,lifecyclestage',
        { headers }
      );
      if (!res.ok) {
        const err = await res.text();
        return Response.json({ error: `HubSpot API error: ${err}` }, { status: res.status });
      }
      const data = await res.json();
      return Response.json({ contacts: data.results || [], total: data.total || 0 });
    }

    // Fetch HubSpot deals
    if (action === 'fetch_deals') {
      const res = await fetch(
        'https://api.hubapi.com/crm/v3/objects/deals?limit=100&properties=dealname,amount,dealstage,closedate,pipeline',
        { headers }
      );
      if (!res.ok) {
        const err = await res.text();
        return Response.json({ error: `HubSpot API error: ${err}` }, { status: res.status });
      }
      const data = await res.json();
      return Response.json({ deals: data.results || [], total: data.total || 0 });
    }

    // Import HubSpot contacts as leads into CRM
    if (action === 'import_contacts') {
      const contacts = body.contacts || [];
      let imported = 0;
      for (const c of contacts) {
        const p = c.properties || {};
        await base44.entities.Lead.create({
          first_name: p.firstname || 'Unknown',
          last_name: p.lastname || '',
          email: p.email || '',
          phone: p.phone || '',
          job_title: p.jobtitle || '',
          company_name: p.company || 'Unknown',
          status: mapLifecycle(p.lifecyclestage),
          source: 'other',
        });
        imported++;
      }
      return Response.json({ imported });
    }

    // Push a lead to HubSpot as a contact
    if (action === 'push_lead') {
      const lead = body.lead || {};
      const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          properties: {
            firstname: lead.first_name || '',
            lastname: lead.last_name || '',
            email: lead.email || '',
            phone: lead.phone || '',
            jobtitle: lead.job_title || '',
            company: lead.company_name || '',
          }
        })
      });
      if (!res.ok) {
        const err = await res.text();
        return Response.json({ error: `HubSpot API error: ${err}` }, { status: res.status });
      }
      const data = await res.json();
      return Response.json({ contact: data });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function mapLifecycle(stage) {
  const map = {
    lead: 'new',
    marketingqualifiedlead: 'qualified',
    salesqualifiedlead: 'qualified',
    opportunity: 'proposal',
    customer: 'won',
    subscriber: 'new',
  };
  return map[stage] || 'new';
}