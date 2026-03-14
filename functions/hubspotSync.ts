import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const HUBSPOT_API = "https://api.hubapi.com";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action } = await req.json();
    const { accessToken } = await base44.asServiceRole.connectors.getConnection("hubspot");

    const headers = {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    };

    // ── IMPORT: pull HubSpot contacts → Moldwise leads ──
    if (action === "import_contacts") {
      const res = await fetch(`${HUBSPOT_API}/crm/v3/objects/contacts?limit=100&properties=firstname,lastname,email,phone,jobtitle,company,hs_lead_status`, { headers });
      const data = await res.json();

      if (!res.ok) return Response.json({ error: data.message }, { status: res.status });

      const contacts = data.results || [];
      let imported = 0;

      for (const contact of contacts) {
        const p = contact.properties;
        if (!p.firstname && !p.lastname) continue;
        await base44.asServiceRole.entities.Lead.create({
          first_name: p.firstname || "Unknown",
          last_name: p.lastname || "",
          email: p.email || "",
          phone: p.phone || "",
          job_title: p.jobtitle || "",
          company_name: p.company || "Unknown",
          source: "other",
          status: "new",
        });
        imported++;
      }

      return Response.json({ success: true, imported, total: contacts.length });
    }

    // ── EXPORT: push Moldwise leads → HubSpot contacts ──
    if (action === "export_leads") {
      const leads = await base44.asServiceRole.entities.Lead.list();
      let exported = 0;
      let errors = 0;

      for (const lead of leads) {
        const body = {
          properties: {
            firstname: lead.first_name || "",
            lastname: lead.last_name || "",
            email: lead.email || "",
            phone: lead.phone || "",
            jobtitle: lead.job_title || "",
            company: lead.company_name || "",
          }
        };

        const res = await fetch(`${HUBSPOT_API}/crm/v3/objects/contacts`, {
          method: "POST",
          headers,
          body: JSON.stringify(body)
        });

        if (res.ok) exported++;
        else errors++;
      }

      return Response.json({ success: true, exported, errors, total: leads.length });
    }

    // ── FETCH STATS ──
    if (action === "get_stats") {
      const [contactsRes, dealsRes] = await Promise.all([
        fetch(`${HUBSPOT_API}/crm/v3/objects/contacts?limit=1`, { headers }),
        fetch(`${HUBSPOT_API}/crm/v3/objects/deals?limit=1`, { headers }),
      ]);

      const contacts = await contactsRes.json();
      const deals = await dealsRes.json();

      return Response.json({
        success: true,
        contacts_total: contacts.total || 0,
        deals_total: deals.total || 0,
      });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});