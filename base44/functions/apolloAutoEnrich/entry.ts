import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Called by entity automation on lead create
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const leadId = body?.event?.entity_id || body?.data?.id;
    if (!leadId) return Response.json({ ok: true, skipped: "no lead_id" });

    // Small delay to ensure record is fully committed
    await new Promise(r => setTimeout(r, 5000));

    const leads = await base44.asServiceRole.entities.Lead.filter({ id: leadId });
    const lead = leads[0];
    if (!lead) return Response.json({ ok: true, skipped: "lead not found" });

    // Only enrich if email or company name present
    if (!lead.email && !lead.company_name) {
      return Response.json({ ok: true, skipped: "no email or company_name" });
    }

    // Don't re-enrich if already done
    if (lead.apollo_enrichment_status === "enriched") {
      return Response.json({ ok: true, skipped: "already enriched" });
    }

    const res = await base44.asServiceRole.functions.invoke("apolloEnrich", {
      lead_id: leadId,
      only_missing: true,
    });

    console.log(`Auto-enriched lead ${leadId}:`, res?.fields_updated);
    return Response.json({ ok: true, result: res });

  } catch (error) {
    console.error("apolloAutoEnrich error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});