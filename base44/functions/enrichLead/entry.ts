import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { lead_id, event } = await req.json();

    // Support being called directly (lead_id) or from entity automation (event.entity_id)
    const id = lead_id || event?.entity_id;
    if (!id) return Response.json({ error: 'lead_id is required' }, { status: 400 });

    const lead = await base44.asServiceRole.entities.Lead.get(id);
    if (!lead) return Response.json({ error: 'Lead not found' }, { status: 404 });

    // Determine which fields are missing
    const fieldsToEnrich = [];
    if (!lead.linkedin_url) fieldsToEnrich.push('linkedin_url');
    if (!lead.phone) fieldsToEnrich.push('phone');
    if (!lead.email) fieldsToEnrich.push('email');
    if (!lead.industry) fieldsToEnrich.push('industry');
    if (!lead.company_size) fieldsToEnrich.push('company_size');
    if (!lead.location) fieldsToEnrich.push('location');
    if (!lead.website) fieldsToEnrich.push('website');
    if (!lead.job_title) fieldsToEnrich.push('job_title');
    if (!lead.notes) fieldsToEnrich.push('notes');

    // Nothing to enrich
    if (fieldsToEnrich.length === 0) {
      return Response.json({ success: true, message: 'Lead already fully enriched', updated: {} });
    }

    const contactName = [lead.first_name, lead.last_name].filter(Boolean).join(' ');

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a B2B sales intelligence researcher. Research this lead online and fill in the missing fields.

Lead info:
- Name: ${contactName || 'Unknown'}
- Job Title: ${lead.job_title || 'Unknown'}
- Company: ${lead.company_name}
- Website: ${lead.website || 'Unknown'}
- Industry: ${lead.industry || 'Unknown'}
- Location: ${lead.location || 'Unknown'}
- Email: ${lead.email || 'Unknown'}
- Phone: ${lead.phone || 'Unknown'}
- Company Size: ${lead.company_size || 'Unknown'}
- LinkedIn: ${lead.linkedin_url || 'Unknown'}

Fields to find: ${fieldsToEnrich.join(', ')}

Search for:
1. "${lead.company_name}${contactName ? ' ' + contactName : ''} LinkedIn"
2. "${lead.company_name} contact phone email"
3. "${lead.company_name} company revenue employees size industry"

Rules:
- Only return fields you found with reasonable confidence (skip uncertain ones entirely)
- For linkedin_url: must be a real linkedin.com/in/ or linkedin.com/company/ URL
- For phone: include country code if detectable
- For company_size: use ONLY one of: "1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"
- For notes: write 2-3 sentences summarizing the company, what they do, and their potential manufacturing/procurement needs
- Return null for any field you cannot find with confidence`,
      add_context_from_internet: true,
      model: "gemini_3_flash",
      response_json_schema: {
        type: "object",
        properties: {
          linkedin_url: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          industry: { type: "string" },
          company_size: { type: "string" },
          location: { type: "string" },
          website: { type: "string" },
          job_title: { type: "string" },
          notes: { type: "string" }
        }
      }
    });

    // Build update object — only include fields that were missing AND found
    const updates = {};
    for (const field of fieldsToEnrich) {
      const val = result[field];
      if (val && val !== 'null' && val !== 'Unknown' && val.trim() !== '') {
        updates[field] = val;
      }
    }

    if (Object.keys(updates).length > 0) {
      await base44.asServiceRole.entities.Lead.update(id, updates);
    }

    return Response.json({
      success: true,
      lead_id: id,
      fields_checked: fieldsToEnrich,
      fields_updated: Object.keys(updates),
      updated: updates
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});