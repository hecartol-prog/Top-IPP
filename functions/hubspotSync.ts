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

    // ── PUSH: Export leads from Moldwise → HubSpot ──────────────────────────
    if (action === 'push') {
      const leads = leadIds
        ? await Promise.all(leadIds.map(id => base44.asServiceRole.entities.Lead.get(id)))
        : await base44.asServiceRole.entities.Lead.list();

      const results = { created: 0, updated: 0, errors: [] };

      for (const lead of leads) {
        if (!lead) continue;
        const props = {
          firstname: lead.first_name || '',
          lastname: lead.last_name || '',
          email: lead.email || '',
          phone: lead.phone || '',
          jobtitle: lead.job_title || '',
          company: lead.company_name || '',
          country: lead.country || '',
          website: lead.website || '',
          hs_lead_status: lead.status || 'new',
          lifecyclestage: lead.status === 'won' ? 'customer' : 'lead',
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
          const res = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${existingId}`, {
            method: 'PATCH', headers,
            body: JSON.stringify({ properties: props }),
          });
          if (res.ok) results.updated++; else results.errors.push(`Update failed for ${lead.email}`);
        } else {
          const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
            method: 'POST', headers,
            body: JSON.stringify({ properties: props }),
          });
          if (res.ok) results.created++; else results.errors.push(`Create failed for ${lead.email || lead.first_name}`);
        }
      }

      return Response.json({ success: true, action: 'push', ...results });
    }

    // ── PULL: Import contacts from HubSpot → Moldwise ───────────────────────
    if (action === 'pull') {
      const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=firstname,lastname,email,phone,jobtitle,company,country,website,hs_lead_status', {
        headers,
      });
      const data = await res.json();
      const contacts = data.results || [];

      let imported = 0;
      let skipped = 0;

      for (const contact of contacts) {
        const p = contact.properties;
        if (!p.firstname && !p.lastname && !p.company) { skipped++; continue; }

        // Check if already exists by email
        if (p.email) {
          const existing = await base44.asServiceRole.entities.Lead.filter({ email: p.email });
          if (existing.length > 0) { skipped++; continue; }
        }

        await base44.asServiceRole.entities.Lead.create({
          first_name: p.firstname || '',
          last_name: p.lastname || '',
          email: p.email || '',
          phone: p.phone || '',
          job_title: p.jobtitle || '',
          company_name: p.company || '',
          country: p.country || '',
          website: p.website || '',
          status: 'new',
          source: 'other',
        });
        imported++;
      }

      return Response.json({ success: true, action: 'pull', imported, skipped, total: contacts.length });
    }

    // ── STATUS: Get HubSpot contact count ────────────────────────────────────
    if (action === 'status') {
      const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', { headers });
      const data = await res.json();
      return Response.json({ success: true, total: data.total || 0 });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});