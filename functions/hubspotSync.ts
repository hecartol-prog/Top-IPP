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

    // Push leads from Moldwise → HubSpot
    if (action === 'push') {
      const leads = leadIds
        ? await Promise.all(leadIds.map(id => base44.entities.Lead.get(id)))
        : await base44.entities.Lead.list();

      const results = { created: 0, updated: 0, errors: [] };

      for (const lead of leads) {
        if (!lead.email) continue;

        const properties = {
          firstname: lead.first_name || '',
          lastname: lead.last_name || '',
          email: lead.email,
          phone: lead.phone || '',
          jobtitle: lead.job_title || '',
          company: lead.company_name || '',
          website: lead.website || '',
          linkedinbio: lead.linkedin_url || '',
          city: lead.location || '',
          country: lead.country || '',
          hs_lead_status: lead.status || 'new',
          amount: lead.estimated_value ? String(lead.estimated_value) : '',
          description: lead.notes || '',
        };

        // Search for existing contact by email
        const searchRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: lead.email }] }],
            limit: 1,
          }),
        });
        const searchData = await searchRes.json();

        if (searchData.results && searchData.results.length > 0) {
          // Update existing
          const contactId = searchData.results[0].id;
          await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ properties }),
          });
          results.updated++;
        } else {
          // Create new
          const createRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
            method: 'POST',
            headers,
            body: JSON.stringify({ properties }),
          });
          if (!createRes.ok) {
            const err = await createRes.json();
            results.errors.push({ lead: lead.email, error: err.message });
          } else {
            results.created++;
          }
        }
      }

      return Response.json({ success: true, ...results });
    }

    // Pull contacts from HubSpot → Moldwise
    if (action === 'pull') {
      const res = await fetch(
        'https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=firstname,lastname,email,phone,jobtitle,company,website,city,country,hs_lead_status',
        { headers }
      );
      const data = await res.json();
      const contacts = data.results || [];

      let imported = 0;
      for (const contact of contacts) {
        const p = contact.properties;
        if (!p.email) continue;

        // Check if already exists
        const existing = await base44.entities.Lead.filter({ email: p.email });
        if (existing.length > 0) continue;

        await base44.entities.Lead.create({
          first_name: p.firstname || 'Unknown',
          last_name: p.lastname || '',
          email: p.email,
          phone: p.phone || '',
          job_title: p.jobtitle || '',
          company_name: p.company || 'Unknown',
          website: p.website || '',
          location: p.city || '',
          country: p.country || '',
          status: 'new',
          source: 'other',
        });
        imported++;
      }

      return Response.json({ success: true, imported });
    }

    // Get HubSpot stats
    if (action === 'stats') {
      const res = await fetch(
        'https://api.hubapi.com/crm/v3/objects/contacts?limit=1',
        { headers }
      );
      const data = await res.json();
      return Response.json({ success: true, total: data.total || 0 });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});