import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, direction } = await req.json();
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('hubspot');

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    // ── FETCH HUBSPOT CONTACTS ──────────────────────────────────────────────
    if (action === 'fetch_contacts') {
      const res = await fetch(
        'https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=firstname,lastname,email,phone,jobtitle,company,hs_lead_status,lifecyclestage',
        { headers }
      );
      const data = await res.json();
      if (!res.ok) return Response.json({ error: data.message }, { status: res.status });

      const contacts = (data.results || []).map(c => ({
        hubspot_id: c.id,
        first_name: c.properties.firstname || '',
        last_name: c.properties.lastname || '',
        email: c.properties.email || '',
        phone: c.properties.phone || '',
        job_title: c.properties.jobtitle || '',
        company_name: c.properties.company || '',
        status: 'new',
        source: 'other',
      }));

      return Response.json({ contacts, total: data.results?.length || 0 });
    }

    // ── IMPORT CONTACTS INTO CRM ────────────────────────────────────────────
    if (action === 'import_contacts') {
      const { contacts } = await req.json().catch(() => ({ contacts: [] }));
      // contacts already parsed above — re-read body not possible; contacts passed in payload
      return Response.json({ error: 'Use fetch_contacts first, then import via import_leads action' }, { status: 400 });
    }

    // ── IMPORT SELECTED LEADS INTO CRM ─────────────────────────────────────
    if (action === 'import_leads') {
      const body = await req.json().catch(() => ({}));
      const leads = body.leads || [];
      let imported = 0;
      for (const lead of leads) {
        await base44.entities.Lead.create({
          first_name: lead.first_name || 'Unknown',
          last_name: lead.last_name || '',
          email: lead.email || '',
          phone: lead.phone || '',
          job_title: lead.job_title || '',
          company_name: lead.company_name || '',
          status: 'new',
          source: 'other',
        });
        imported++;
      }
      return Response.json({ imported });
    }

    // ── PUSH LEAD TO HUBSPOT ────────────────────────────────────────────────
    if (action === 'push_lead') {
      const body = await req.json().catch(() => ({}));
      const lead = body.lead;
      if (!lead) return Response.json({ error: 'No lead provided' }, { status: 400 });

      const payload = {
        properties: {
          firstname: lead.first_name || '',
          lastname: lead.last_name || '',
          email: lead.email || '',
          phone: lead.phone || '',
          jobtitle: lead.job_title || '',
          company: lead.company_name || '',
          website: lead.website || '',
          lifecyclestage: 'lead',
        }
      };

      const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) return Response.json({ error: data.message }, { status: res.status });
      return Response.json({ success: true, hubspot_id: data.id });
    }

    // ── SYNC ALL LEADS TO HUBSPOT ───────────────────────────────────────────
    if (action === 'sync_to_hubspot') {
      const leads = await base44.entities.Lead.list();
      let synced = 0;
      let errors = 0;
      for (const lead of leads) {
        const payload = {
          properties: {
            firstname: lead.first_name || '',
            lastname: lead.last_name || '',
            email: lead.email || '',
            phone: lead.phone || '',
            jobtitle: lead.job_title || '',
            company: lead.company_name || '',
            website: lead.website || '',
          }
        };
        const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        if (res.ok) synced++;
        else errors++;
      }
      return Response.json({ synced, errors, total: leads.length });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});