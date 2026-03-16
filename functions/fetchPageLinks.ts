import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const { url } = body;
    if (!url) return Response.json({ error: 'url is required' }, { status: 400 });

    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      }
    });

    const html = await resp.text();

    const baseOrigin = new URL(url).origin;
    const basePath = new URL(url).pathname.replace(/\/$/, '');
    const baseHostname = new URL(url).hostname;

    // Extract all hrefs from anchor tags
    const hrefRegex = /href=["']([^"'#][^"']*?)["']/gi;
    const allHrefs = [];
    let match;
    while ((match = hrefRegex.exec(html)) !== null) {
      allHrefs.push(match[1]);
    }

    // Normalize and filter to only sub-paths of the directory
    const seen = new Set();
    const detailLinks = [];
    for (const href of allHrefs) {
      let full;
      if (href.startsWith('http')) {
        full = href.split('?')[0].replace(/\/$/, '') + '/';
      } else if (href.startsWith('/')) {
        full = baseOrigin + href.split('?')[0].replace(/\/$/, '') + '/';
      } else {
        continue;
      }

      if (seen.has(full)) continue;

      try {
        const u = new URL(full);
        const slug = u.pathname.replace(basePath + '/', '').replace(/\/$/, '');
        if (
          u.hostname === baseHostname &&
          u.pathname.startsWith(basePath + '/') &&
          slug.length > 0 &&
          !slug.includes('/')
        ) {
          seen.add(full);
          detailLinks.push(full);
        }
      } catch {
        // skip
      }
    }

    return Response.json({ links: detailLinks, total: detailLinks.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});