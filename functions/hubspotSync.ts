import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, leads } = await req.json();
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('hubspot');

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    if (action === 'push_contacts') {
      // Push Moldwise leads to HubSpot as contacts
      const results = { created: 0, updated: 0, failed: 0, errors: [] };

      for (const lead of leads) {
        const properties = {
          firstname: lead.first_name || '',
          lastname: lead.last_name || '',
          email: lead.email || '',
          phone: lead.phone || '',
          jobtitle: lead.job_title || '',
          company: lead.company_name || '',
          website: lead.website || '',
          linkedin: lead.linkedin_url || '',
          hs_lead_status: mapStatusToHubspot(lead.status),
          industry: lead.industry || '',
          country: lead.country || '',
          notes_last_contacted: lead.notes || '',
        };

        // Search if contact already exists by email
        let existingId = null;
        if (lead.email) {
          const searchRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: lead.email }] }],
              properties: ['id'],
              limit: 1,
            }),
          });
          const searchData = await searchRes.json();
          existingId = searchData.results?.[0]?.id;
        }

        if (existingId) {
          const updateRes = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${existingId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ properties }),
          });
          if (updateRes.ok) results.updated++;
          else { results.failed++; results.errors.push(`Update failed for ${lead.email}`); }
        } else {
          const createRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
            method: 'POST',
            headers,
            body: JSON.stringify({ properties }),
          });
          if (createRes.ok) results.created++;
          else { results.failed++; results.errors.push(`Create failed for ${lead.first_name} ${lead.last_name}`); }
        }
      }

      return Response.json({ success: true, action: 'push_contacts', results });
    }

    if (action === 'pull_contacts') {
      // Pull HubSpot contacts into Moldwise
      const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=firstname,lastname,email,phone,jobtitle,company,website,hs_lead_status,industry,country', {
        headers,
      });
      const data = await res.json();
      const contacts = data.results || [];

      const mappedLeads = contacts.map(c => ({
        first_name: c.properties.firstname || '',
        last_name: c.properties.lastname || '',
        email: c.properties.email || '',
        phone: c.properties.phone || '',
        job_title: c.properties.jobtitle || '',
        company_name: c.properties.company || '',
        website: c.properties.website || '',
        industry: c.properties.industry || '',
        country: c.properties.country || '',
        status: mapHubspotStatusToLocal(c.properties.hs_lead_status),
        source: 'other',
      })).filter(l => l.first_name || l.last_name || l.company_name);

      return Response.json({ success: true, action: 'pull_contacts', contacts: mappedLeads });
    }

    if (action === 'get_stats') {
      const [contactsRes, dealsRes, companiesRes] = await Promise.all([
        fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', { headers }),
        fetch('https://api.hubapi.com/crm/v3/objects/deals?limit=1', { headers }),
        fetch('https://api.hubapi.com/crm/v3/objects/companies?limit=1', { headers }),
      ]);
      const [contactsData, dealsData, companiesData] = await Promise.all([
        contactsRes.json(), dealsRes.json(), companiesRes.json()
      ]);
      return Response.json({
        success: true,
        stats: {
          contacts: contactsData.total || 0,
          deals: dealsData.total || 0,
          companies: companiesData.total || 0,
        }
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function mapStatusToHubspot(status) {
  const map = {
    new: 'NEW',
    contacted: 'OPEN',
    qualified: 'IN_PROGRESS',
    proposal: 'IN_PROGRESS',
    negotiation: 'IN_PROGRESS',
    won: 'CONNECTED',
    lost: 'UNQUALIFIED',
  };
  return map[status] || 'NEW';
}

function mapHubspotStatusToLocal(status) {
  const map = {
    NEW: 'new',
    OPEN: 'contacted',
    IN_PROGRESS: 'qualified',
    CONNECTED: 'won',
    UNQUALIFIED: 'lost',
  };
  return map[status] || 'new';
}