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

    // ── PUSH: Export selected leads to HubSpot contacts ──────────────────
    if (action === 'push') {
      const leads = await base44.entities.Lead.list();
      const toSync = leadIds ? leads.filter(l => leadIds.includes(l.id)) : leads;

      const results = { created: 0, updated: 0, errors: [] };

      for (const lead of toSync) {
        const properties = {
          firstname: lead.first_name || '',
          lastname: lead.last_name || '',
          email: lead.email || '',
          phone: lead.phone || '',
          jobtitle: lead.job_title || '',
          company: lead.company_name || '',
          website: lead.website || '',
          hs_lead_status: lead.status || 'new',
          lifecyclestage: lead.status === 'won' ? 'customer' : 'lead',
          notes_last_updated: lead.notes || '',
          linkedin_bio: lead.linkedin_url || '',
        };

        // Check if contact already exists by email
        if (lead.email) {
          const searchRes = await fetch(
            `https://api.hubapi.com/crm/v3/objects/contacts/search`,
            {
              method: 'POST',
              headers,
              body: JSON.stringify({
                filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: lead.email }] }],
                properties: ['email', 'hs_object_id'],
                limit: 1,
              }),
            }
          );
          const searchData = await searchRes.json();

          if (searchData.results?.length > 0) {
            const contactId = searchData.results[0].id;
            const patchRes = await fetch(
              `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
              { method: 'PATCH', headers, body: JSON.stringify({ properties }) }
            );
            if (patchRes.ok) results.updated++;
            else results.errors.push(`Update failed for ${lead.email}`);
          } else {
            const createRes = await fetch(
              `https://api.hubapi.com/crm/v3/objects/contacts`,
              { method: 'POST', headers, body: JSON.stringify({ properties }) }
            );
            if (createRes.ok) results.created++;
            else results.errors.push(`Create failed for ${lead.email}`);
          }
        }
      }

      return Response.json({ success: true, action: 'push', ...results });
    }

    // ── PULL: Import HubSpot contacts into CRM leads ──────────────────────
    if (action === 'pull') {
      const res = await fetch(
        `https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=firstname,lastname,email,phone,jobtitle,company,website,linkedin_bio,hs_lead_status`,
        { headers }
      );
      const data = await res.json();
      const contacts = data.results || [];

      const existing = await base44.asServiceRole.entities.Lead.list();
      const existingEmails = new Set(existing.map(l => l.email).filter(Boolean));

      let imported = 0;
      for (const contact of contacts) {
        const p = contact.properties;
        if (!p.email || existingEmails.has(p.email)) continue;

        await base44.asServiceRole.entities.Lead.create({
          first_name: p.firstname || 'Unknown',
          last_name: p.lastname || '',
          email: p.email,
          phone: p.phone || '',
          job_title: p.jobtitle || '',
          company_name: p.company || 'Unknown',
          website: p.website || '',
          linkedin_url: p.linkedin_bio || '',
          status: 'new',
          source: 'other',
        });
        imported++;
      }

      return Response.json({ success: true, action: 'pull', imported, total: contacts.length });
    }

    // ── STATUS: Check connection & counts ─────────────────────────────────
    if (action === 'status') {
      const res = await fetch(
        `https://api.hubapi.com/crm/v3/objects/contacts?limit=1`,
        { headers }
      );
      const data = await res.json();
      return Response.json({ success: true, connected: true, hubspotTotal: data.total || 0 });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});