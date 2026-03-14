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

    // ── PUSH: Export selected leads to HubSpot contacts ──────────────────────
    if (action === 'push') {
      const leads = await base44.entities.Lead.list();
      const targets = leadIds?.length ? leads.filter(l => leadIds.includes(l.id)) : leads;

      const results = { created: 0, updated: 0, errors: [] };

      for (const lead of targets) {
        const props = {
          firstname: lead.first_name || '',
          lastname: lead.last_name || '',
          email: lead.email || '',
          phone: lead.phone || '',
          jobtitle: lead.job_title || '',
          company: lead.company_name || '',
          website: lead.website || '',
          country: lead.country || '',
          hs_lead_status: lead.status || 'new',
          linkedin_bio: lead.linkedin_url || '',
          notes_last_updated: lead.notes || '',
        };

        // Search if contact already exists by email
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

          if (searchData.results?.length > 0) {
            const contactId = searchData.results[0].id;
            await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`, {
              method: 'PATCH',
              headers,
              body: JSON.stringify({ properties: props }),
            });
            results.updated++;
            continue;
          }
        }

        const createRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
          method: 'POST',
          headers,
          body: JSON.stringify({ properties: props }),
        });
        if (createRes.ok) {
          results.created++;
        } else {
          const err = await createRes.json();
          results.errors.push(err.message || 'Unknown error');
        }
      }

      return Response.json({ success: true, ...results });
    }

    // ── PULL: Import HubSpot contacts as leads ────────────────────────────────
    if (action === 'pull') {
      const res = await fetch(
        'https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=firstname,lastname,email,phone,jobtitle,company,website,country,hs_lead_status,linkedin_bio',
        { headers }
      );
      const data = await res.json();

      if (!res.ok) return Response.json({ error: data.message || 'HubSpot error' }, { status: 400 });

      const contacts = data.results || [];
      let imported = 0;

      for (const c of contacts) {
        const p = c.properties;
        if (!p.firstname && !p.lastname && !p.company) continue;

        await base44.asServiceRole.entities.Lead.create({
          first_name: p.firstname || 'Unknown',
          last_name: p.lastname || '',
          email: p.email || '',
          phone: p.phone || '',
          job_title: p.jobtitle || '',
          company_name: p.company || 'Unknown',
          website: p.website || '',
          country: p.country || '',
          linkedin_url: p.linkedin_bio || '',
          source: 'other',
          status: 'new',
        });
        imported++;
      }

      return Response.json({ success: true, imported });
    }

    // ── STATUS: Check connection ──────────────────────────────────────────────
    if (action === 'status') {
      const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', { headers });
      const data = await res.json();
      if (!res.ok) return Response.json({ connected: false, error: data.message });
      return Response.json({ connected: true, total: data.total || 0 });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});