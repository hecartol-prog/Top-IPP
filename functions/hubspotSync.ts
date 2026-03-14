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

    // Push leads to HubSpot as contacts
    if (action === 'push') {
      const leads = await base44.entities.Lead.list();
      const targetLeads = leadIds ? leads.filter(l => leadIds.includes(l.id)) : leads;

      const results = { created: 0, updated: 0, errors: [] };

      for (const lead of targetLeads) {
        const properties = {
          firstname: lead.first_name || '',
          lastname: lead.last_name || '',
          email: lead.email || '',
          phone: lead.phone || '',
          jobtitle: lead.job_title || '',
          company: lead.company_name || '',
          website: lead.website || '',
          hs_lead_status: lead.status || 'new',
          city: lead.location || '',
          country: lead.country || '',
          linkedin_bio: lead.linkedin_url || '',
          notes_last_updated: lead.notes || '',
        };

        // Search for existing contact by email
        let existingId = null;
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
          if (searchData.results?.length > 0) existingId = searchData.results[0].id;
        }

        if (existingId) {
          await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${existingId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ properties }),
          });
          results.updated++;
        } else {
          const createRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
            method: 'POST',
            headers,
            body: JSON.stringify({ properties }),
          });
          if (!createRes.ok) {
            const err = await createRes.json();
            results.errors.push(`${lead.first_name} ${lead.last_name}: ${err.message}`);
          } else {
            results.created++;
          }
        }
      }

      return Response.json({ success: true, ...results });
    }

    // Pull contacts from HubSpot into leads
    if (action === 'pull') {
      const res = await fetch(
        'https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=firstname,lastname,email,phone,jobtitle,company,website,hs_lead_status,city,country,linkedin_bio',
        { headers }
      );
      const data = await res.json();
      const contacts = data.results || [];

      let imported = 0;
      for (const contact of contacts) {
        const p = contact.properties;
        if (!p.firstname && !p.lastname && !p.company) continue;
        await base44.entities.Lead.create({
          first_name: p.firstname || '',
          last_name: p.lastname || '',
          email: p.email || '',
          phone: p.phone || '',
          job_title: p.jobtitle || '',
          company_name: p.company || '',
          website: p.website || '',
          location: p.city || '',
          country: p.country || '',
          linkedin_url: p.linkedin_bio || '',
          source: 'other',
          status: 'new',
        });
        imported++;
      }

      return Response.json({ success: true, imported });
    }

    // Test connection
    if (action === 'test') {
      const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', { headers });
      const data = await res.json();
      return Response.json({ success: res.ok, total: data.total ?? 0 });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});