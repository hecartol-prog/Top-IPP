import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { mode, domain, first_name, last_name, email } = await req.json();
    const apiKey = Deno.env.get('HUNTER_API_KEY');
    if (!apiKey) return Response.json({ error: 'HUNTER_API_KEY not configured' }, { status: 500 });

    // Mode: combined enrichment — full person + company profile from email
    if (mode === 'combined') {
      if (!email) return Response.json({ error: 'email required for combined enrichment' }, { status: 400 });
      const res = await fetch(`https://api.hunter.io/v2/combined/find?email=${encodeURIComponent(email)}&api_key=${apiKey}`);
      const data = await res.json();
      const p = data.data?.person || {};
      const o = data.data?.company || {};
      return Response.json({
        mode: 'combined',
        person: {
          email: p.email,
          first_name: p.firstName,
          last_name: p.lastName,
          job_title: p.title,
          linkedin: p.linkedin,
          twitter: p.twitter,
          location: p.location?.city ? `${p.location.city}, ${p.location.country}` : (p.location?.country || null),
          phone: p.phone,
          avatar: p.avatar,
          bio: p.bio,
        },
        company: {
          name: o.name,
          domain: o.domain,
          website: o.website ? `https://${o.domain}` : null,
          industry: o.category?.industry,
          size: o.metrics?.employees,
          location: o.location,
          description: o.description,
          linkedin: o.linkedin,
        },
      });
    }

    // Mode: verify existing email
    if (mode === 'verify') {
      if (!email) return Response.json({ error: 'email required for verification' }, { status: 400 });
      const res = await fetch(`https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${apiKey}`);
      const data = await res.json();
      return Response.json({
        mode: 'verify',
        email,
        status: data.data?.status,
        score: data.data?.score,
        mx_records: data.data?.mx_records,
        smtp_server: data.data?.smtp_server,
        smtp_check: data.data?.smtp_check,
        disposable: data.data?.disposable,
        webmail: data.data?.webmail,
      });
    }

    // Mode: find email by domain + first/last name
    if (mode === 'finder' || (domain && first_name && last_name)) {
      if (!domain || !first_name || !last_name) return Response.json({ error: 'domain, first_name and last_name required' }, { status: 400 });
      const res = await fetch(
        `https://api.hunter.io/v2/email-finder?domain=${encodeURIComponent(domain)}&first_name=${encodeURIComponent(first_name)}&last_name=${encodeURIComponent(last_name)}&api_key=${apiKey}`
      );
      const data = await res.json();
      return Response.json({
        mode: 'finder',
        email: data.data?.email,
        score: data.data?.score,
        domain: data.data?.domain,
        position: data.data?.position,
        sources: (data.data?.sources || []).slice(0, 3).map(s => s.domain),
      });
    }

    // Mode: domain search — list all known emails for a domain
    if (domain) {
      const res = await fetch(
        `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=10&api_key=${apiKey}`
      );
      const data = await res.json();
      return Response.json({
        mode: 'domain',
        domain: data.data?.domain,
        organization: data.data?.organization,
        pattern: data.data?.pattern,
        emails: (data.data?.emails || []).map(e => ({
          value: e.value,
          confidence: e.confidence,
          first_name: e.first_name,
          last_name: e.last_name,
          position: e.position,
          type: e.type,
        })),
      });
    }

    return Response.json({ error: 'Invalid request. Provide mode + required params.' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});