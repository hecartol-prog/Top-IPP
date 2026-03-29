import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { domain, first_name, last_name, email } = await req.json();
    const apiKey = Deno.env.get('HUNTER_API_KEY');

    if (!apiKey) return Response.json({ error: 'HUNTER_API_KEY not configured' }, { status: 500 });

    // Mode 1: Verify a known email
    if (email) {
      const res = await fetch(`https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${apiKey}`);
      const data = await res.json();
      return Response.json({
        mode: 'verify',
        email,
        status: data.data?.status,
        score: data.data?.score,
        regexp: data.data?.regexp,
        gibberish: data.data?.gibberish,
        disposable: data.data?.disposable,
        webmail: data.data?.webmail,
        mx_records: data.data?.mx_records,
        smtp_server: data.data?.smtp_server,
        smtp_check: data.data?.smtp_check,
      });
    }

    // Mode 2: Find email by domain + name
    if (!domain) return Response.json({ error: 'domain or email is required' }, { status: 400 });

    // If we have name, use email-finder endpoint
    if (first_name && last_name) {
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
        sources: data.data?.sources?.slice(0, 3) || [],
      });
    }

    // Otherwise: domain search — get all emails for the company domain
    const res = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=10&api_key=${apiKey}`
    );
    const data = await res.json();
    return Response.json({
      mode: 'domain',
      domain: data.data?.domain,
      organization: data.data?.organization,
      emails: (data.data?.emails || []).map(e => ({
        value: e.value,
        type: e.type,
        confidence: e.confidence,
        first_name: e.first_name,
        last_name: e.last_name,
        position: e.position,
      })),
      pattern: data.data?.pattern,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});