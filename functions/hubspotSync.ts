import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, leadIds } = await req.json();
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('hubspot');

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    // --- PUSH: Export leads to HubSpot as contacts ---
    if (action === 'push') {
      const leads = leadIds?.length
        ? await Promise.all(leadIds.map(id => base44.entities.Lead.get(id)))
        : await base44.entities.Lead.list();

      let created = 0, updated = 0, failed = 0;

      for (const lead of leads) {
        const props = {
          email: lead.email || '',
          firstname: lead.first_name || '',
          lastname: lead.last_name || '',
          jobtitle: lead.job_title || '',
          company: lead.company_name || '',
          phone: lead.phone || '',
          website: lead.website || '',
          hs_lead_status: lead.status || 'new',
          notes_last_updated: lead.notes || '',
        };

        // Check if contact exists by email
        if (lead.email) {
          const searchRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: lead.email }] }],
              limit: 1,
            }),
          });
          const searchData = await searchRes.json();

          if (searchData.total > 0) {
            const contactId = searchData.results[0].id;
            await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`, {
              method: 'PATCH',
              headers,
              body: JSON.stringify({ properties: props }),
            });
            updated++;
          } else {
            const createRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
              method: 'POST',
              headers,
              body: JSON.stringify({ properties: props }),
            });
            if (createRes.ok) created++; else failed++;
          }
        } else {
          // No email — create anyway
          const createRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
            method: 'POST',
            headers,
            body: JSON.stringify({ properties: props }),
          });
          if (createRes.ok) created++; else failed++;
        }
      }

      return Response.json({ success: true, created, updated, failed, total: leads.length });
    }

    // --- PULL: Import HubSpot contacts into Moldwise CRM ---
    if (action === 'pull') {
      const res = await fetch(
        'https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=firstname,lastname,email,jobtitle,company,phone,website,hs_lead_status',
        { headers }
      );
      const data = await res.json();
      const contacts = data.results || [];

      let imported = 0;
      for (const contact of contacts) {
        const p = contact.properties;
        if (!p.firstname && !p.lastname && !p.company) continue;
        await base44.entities.Lead.create({
          first_name: p.firstname || 'Unknown',
          last_name: p.lastname || '',
          email: p.email || '',
          job_title: p.jobtitle || '',
          company_name: p.company || 'Unknown',
          phone: p.phone || '',
          website: p.website || '',
          status: 'new',
          source: 'other',
        });
        imported++;
      }

      return Response.json({ success: true, imported, total: contacts.length });
    }

    // --- STATUS: Get HubSpot account info ---
    if (action === 'status') {
      const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', { headers });
      const data = await res.json();
      return Response.json({ success: true, connected: res.ok, contactsAvailable: data.total ?? 0 });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});