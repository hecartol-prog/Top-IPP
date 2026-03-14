import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = Deno.env.get('LEADIQ_API_KEY');
    const apiSecret = Deno.env.get('LEADIQ_API_SECRET');

    if (!apiKey || !apiSecret) {
      return Response.json({ error: 'LeadIQ credentials not configured' }, { status: 500 });
    }

    // Decode the base64 secret
    const decodedSecret = atob(apiSecret);

    // Fetch all lists from LeadIQ
    const listsRes = await fetch('https://api.leadiq.io/v2/lists', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-API-Secret': decodedSecret,
        'Content-Type': 'application/json',
      },
    });

    if (!listsRes.ok) {
      return Response.json({ error: `LeadIQ API error: ${listsRes.statusText}` }, { status: 500 });
    }

    const listsData = await listsRes.json();
    const lists = listsData.data || [];

    // Fetch prospects from all lists
    let allProspects = [];
    for (const list of lists) {
      let offset = 0;
      let hasMore = true;
      
      while (hasMore) {
        const prospectRes = await fetch(`https://api.leadiq.io/v2/lists/${list.id}/prospects?offset=${offset}&limit=100`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'X-API-Secret': decodedSecret,
            'Content-Type': 'application/json',
          },
        });

        if (!prospectRes.ok) break;

        const prospectData = await prospectRes.json();
        const prospects = prospectData.data || [];
        
        if (prospects.length === 0) {
          hasMore = false;
        } else {
          allProspects = allProspects.concat(prospects);
          offset += 100;
        }
      }
    }

    let syncedCount = 0;
    const errors = [];

    // Check existing leads to avoid duplicates
    const existingLeads = await base44.entities.Lead.list();
    const existingEmails = new Set(existingLeads.map(l => l.email?.toLowerCase()));

    // Create leads from LeadIQ prospects
    for (const prospect of prospects) {
      if (!prospect.email || existingEmails.has(prospect.email.toLowerCase())) {
        continue;
      }

      try {
        await base44.entities.Lead.create({
          first_name: prospect.firstName || '',
          last_name: prospect.lastName || '',
          email: prospect.email,
          phone: prospect.phone || '',
          job_title: prospect.jobTitle || '',
          company_name: prospect.company || '',
          linkedin_url: prospect.linkedInUrl || '',
          source: 'leadiq',
          status: 'new',
        });
        syncedCount++;
        existingEmails.add(prospect.email.toLowerCase());
      } catch (e) {
        errors.push(`Failed to create lead ${prospect.email}: ${e.message}`);
      }
    }

    return Response.json({
      success: true,
      synced: syncedCount,
      total: prospects.length,
      errors: errors.length > 0 ? errors : null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});