import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Patterns for obvious fake/placeholder data
    const fakePatterns = [
      /example\.com/i,
      /test@/i,
      /sample\./i,
      /placeholder/i,
      /xyz company/i,
      /www\.example/i,
      /555-\d{4}/,  // fake US phone pattern
      /contact@example/i,
      /info@test/i,
      /no\s+data/i,
      /unknown/i,
      /na\./i,
      /^\.$/,
      /^-$/,
    ];

    const leads = await base44.asServiceRole.entities.Lead.list();
    let cleaned = 0;
    const errors = [];

    for (const lead of leads) {
      const updates = {};
      let hasFakeData = false;

      // Check each field for fake patterns
      if (lead.email && fakePatterns.some(p => p.test(lead.email))) {
        updates.email = '';
        hasFakeData = true;
      }
      if (lead.phone && fakePatterns.some(p => p.test(lead.phone))) {
        updates.phone = '';
        hasFakeData = true;
      }
      if (lead.website && fakePatterns.some(p => p.test(lead.website))) {
        updates.website = '';
        hasFakeData = true;
      }
      if (lead.company_name && fakePatterns.some(p => p.test(lead.company_name))) {
        updates.company_name = '';
        hasFakeData = true;
      }
      if (lead.address && fakePatterns.some(p => p.test(lead.address))) {
        updates.address = '';
        hasFakeData = true;
      }

      if (hasFakeData) {
        try {
          await base44.asServiceRole.entities.Lead.update(lead.id, updates);
          cleaned++;
        } catch (e) {
          errors.push(`Failed to clean ${lead.id}: ${e.message}`);
        }
      }
    }

    return Response.json({
      success: true,
      cleaned,
      total: leads.length,
      errors: errors.length > 0 ? errors : null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});