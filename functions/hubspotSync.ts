import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('hubspot');
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'fetch_contacts';

    if (action === 'fetch_contacts') {
      // Fetch contacts from HubSpot
      const res = await fetch(
        'https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=firstname,lastname,email,phone,jobtitle,company,hs_lead_status,lifecyclestage',
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) {
        const err = await res.text();
        return Response.json({ error: `HubSpot API error: ${err}` }, { status: res.status });
      }
      const data = await res.json();
      return Response.json({ contacts: data.results || [], total: data.total || 0 });
    }

    if (action === 'push_lead') {
      // Push a single lead to HubSpot as a contact
      const { lead } = body;
      if (!lead) return Response.json({ error: 'Missing lead data' }, { status: 400 });

      const properties = {
        firstname: lead.first_name || '',
        lastname: lead.last_name || '',
        email: lead.email || '',
        phone: lead.phone || '',
        jobtitle: lead.job_title || '',
        company: lead.company_name || '',
        website: lead.website || '',
        hs_lead_status: lead.status || 'NEW',
      };

      const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ properties }),
      });

      if (!res.ok) {
        const err = await res.text();
        return Response.json({ error: `HubSpot API error: ${err}` }, { status: res.status });
      }
      const data = await res.json();
      return Response.json({ success: true, hubspot_id: data.id });
    }

    if (action === 'import_contacts') {
      // Import HubSpot contacts into local Lead entity
      const res = await fetch(
        'https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=firstname,lastname,email,phone,jobtitle,company,hs_lead_status,lifecyclestage',
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) {
        const err = await res.text();
        return Response.json({ error: `HubSpot API error: ${err}` }, { status: res.status });
      }
      const data = await res.json();
      const contacts = data.results || [];

      let imported = 0;
      let skipped = 0;
      for (const contact of contacts) {
        const p = contact.properties;
        if (!p.firstname && !p.lastname && !p.company) { skipped++; continue; }
        await base44.asServiceRole.entities.Lead.create({
          first_name: p.firstname || 'Unknown',
          last_name: p.lastname || '',
          email: p.email || '',
          phone: p.phone || '',
          job_title: p.jobtitle || '',
          company_name: p.company || 'Unknown',
          status: 'new',
          source: 'other',
        });
        imported++;
      }
      return Response.json({ success: true, imported, skipped });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});