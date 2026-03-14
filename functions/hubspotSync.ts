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

    // ─── Pull contacts from HubSpot → local Leads ───────────────────────────
    if (action === 'pull_contacts') {
      const res = await fetch(
        'https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=firstname,lastname,email,phone,jobtitle,company,hs_lead_status,lifecyclestage',
        { headers }
      );
      if (!res.ok) throw new Error(`HubSpot contacts error: ${await res.text()}`);
      const data = await res.json();

      const existingLeads = await base44.asServiceRole.entities.Lead.list();
      const existingEmails = new Set(existingLeads.map(l => l.email?.toLowerCase()).filter(Boolean));

      let created = 0;
      let skipped = 0;

      for (const contact of data.results || []) {
        const p = contact.properties;
        const email = p.email?.toLowerCase();
        if (!email || existingEmails.has(email)) { skipped++; continue; }

        const stageMap = {
          lead: 'new', subscriber: 'new', customer: 'won', opportunity: 'qualified',
          salesqualifiedlead: 'qualified', marketingqualifiedlead: 'contacted',
          evangelist: 'won', other: 'new'
        };
        const hsStage = (p.lifecyclestage || 'lead').toLowerCase();

        await base44.asServiceRole.entities.Lead.create({
          first_name: p.firstname || '',
          last_name: p.lastname || '',
          email: p.email,
          phone: p.phone || '',
          job_title: p.jobtitle || '',
          company_name: p.company || '',
          status: stageMap[hsStage] || 'new',
          source: 'other',
        });
        existingEmails.add(email);
        created++;
      }

      return Response.json({ success: true, created, skipped, total: data.results?.length || 0 });
    }

    // ─── Push local Leads → HubSpot contacts ────────────────────────────────
    if (action === 'push_contacts') {
      const leads = await base44.asServiceRole.entities.Lead.list();

      // Fetch existing HubSpot emails
      const hsRes = await fetch(
        'https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=email',
        { headers }
      );
      if (!hsRes.ok) throw new Error(`HubSpot error: ${await hsRes.text()}`);
      const hsData = await hsRes.json();
      const hsEmails = new Set(
        (hsData.results || []).map(c => c.properties?.email?.toLowerCase()).filter(Boolean)
      );

      let pushed = 0;
      let skipped = 0;

      for (const lead of leads) {
        if (!lead.email || hsEmails.has(lead.email.toLowerCase())) { skipped++; continue; }

        const stageReverseMap = {
          new: 'lead', contacted: 'marketingqualifiedlead', qualified: 'salesqualifiedlead',
          proposal: 'opportunity', negotiation: 'opportunity', won: 'customer', lost: 'other'
        };

        await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            properties: {
              firstname: lead.first_name,
              lastname: lead.last_name,
              email: lead.email,
              phone: lead.phone || '',
              jobtitle: lead.job_title || '',
              company: lead.company_name || '',
              lifecyclestage: stageReverseMap[lead.status] || 'lead',
            }
          })
        });
        pushed++;
      }

      return Response.json({ success: true, pushed, skipped });
    }

    // ─── Pull deals from HubSpot ─────────────────────────────────────────────
    if (action === 'pull_deals') {
      const res = await fetch(
        'https://api.hubapi.com/crm/v3/objects/deals?limit=100&properties=dealname,amount,dealstage,closedate',
        { headers }
      );
      if (!res.ok) throw new Error(`HubSpot deals error: ${await res.text()}`);
      const data = await res.json();
      return Response.json({ success: true, deals: data.results || [] });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});