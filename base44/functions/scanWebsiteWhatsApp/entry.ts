import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Normalize a raw phone number to international format +XXXXXXXXXXX
function normalizePhone(raw, countryCode = null) {
  if (!raw) return null;
  // Remove everything except digits and leading +
  let digits = raw.replace(/[^\d+]/g, '');
  if (!digits) return null;
  if (digits.startsWith('+')) return digits.length >= 8 ? digits : null;
  if (digits.startsWith('00')) return digits.length >= 10 ? '+' + digits.slice(2) : null;
  if (digits.length >= 10) return '+' + digits;
  // Short number with known country code
  if (countryCode && digits.length >= 8) return '+' + countryCode + digits;
  return null;
}

// Detect likely country code from URL/content
function detectCountryCode(url, html) {
  const u = url.toLowerCase();
  if (u.includes('.mx')) return '52';
  if (u.includes('.br')) return '55';
  if (u.includes('.ar')) return '54';
  if (u.includes('.co')) return '57';
  if (u.includes('.cl')) return '56';
  if (u.includes('.pe')) return '51';
  if (u.includes('.ve')) return '58';
  if (u.includes('.es')) return '34';
  if (u.includes('.pt')) return '351';
  if (u.includes('.in')) return '91';
  if (html) {
    if (html.includes('México') || html.includes('Mexico') || html.includes('CDMX')) return '52';
    if (html.includes('Brasil') || html.includes('Brazil')) return '55';
    if (html.includes('España')) return '34';
    if (html.includes('Colombia')) return '57';
  }
  return null;
}

// Extract all WhatsApp numbers from HTML using comprehensive patterns
function extractFromHtml(html, pageUrl, countryCode) {
  const found = [];
  let m;

  // 1. wa.me/NUMBER
  const waMeRe = /wa\.me\/(\+?[\d]{7,15})/gi;
  while ((m = waMeRe.exec(html)) !== null) {
    const n = normalizePhone(m[1], countryCode);
    if (n) found.push({ number: n, source: pageUrl, method: 'wa.me' });
  }

  // 2. api.whatsapp.com/send?phone=NUMBER
  const apiRe = /api\.whatsapp\.com\/send[?&][^"'\s<>]*phone=([\d+%]+)/gi;
  while ((m = apiRe.exec(html)) !== null) {
    const n = normalizePhone(decodeURIComponent(m[1]), countryCode);
    if (n) found.push({ number: n, source: pageUrl, method: 'api.whatsapp.com' });
  }

  // 3. whatsapp://send?phone=NUMBER
  const protoRe = /whatsapp:\/\/send[?&][^"'\s<>]*phone=([\d+%]+)/gi;
  while ((m = protoRe.exec(html)) !== null) {
    const n = normalizePhone(decodeURIComponent(m[1]), countryCode);
    if (n) found.push({ number: n, source: pageUrl, method: 'whatsapp://' });
  }

  // 4. href="tel:+NUMBER" — tel links (WhatsApp icon often wraps these)
  const telRe = /href=["']tel:([\d+\-\s().]+)["']/gi;
  while ((m = telRe.exec(html)) !== null) {
    const n = normalizePhone(m[1], countryCode);
    if (n) found.push({ number: n, source: pageUrl, method: 'tel_href' });
  }

  // 5. Phone number adjacent to WhatsApp keyword/icon (within 300 chars)
  const waContextRe = /(?:whatsapp|whatsapp\s*:|\bwa\b[\s:]+|icon[_-]?whatsapp|fa[_-]whatsapp|whatsapp[_-]?(?:icon|logo|btn|float|chat|widget|bubble)|class="[^"]*whatsapp[^"]*")[\s\S]{0,300}?(\+?[\d][\d\s\-().]{5,17}[\d])/gi;
  while ((m = waContextRe.exec(html)) !== null) {
    const n = normalizePhone(m[1], countryCode);
    if (n) found.push({ number: n, source: pageUrl, method: 'near_keyword' });
  }

  // 6. Phone number BEFORE WhatsApp keyword (reversed — header pattern)
  const beforeWaRe = /(\+?[\d][\d\s\-().]{5,17}[\d])[\s\S]{0,300}?(?:whatsapp|icon[_-]?whatsapp|fa[_-]whatsapp)/gi;
  while ((m = beforeWaRe.exec(html)) !== null) {
    const n = normalizePhone(m[1], countryCode);
    if (n) found.push({ number: n, source: pageUrl, method: 'before_keyword' });
  }

  // 7. WhatsApp image/SVG file name near a phone number
  const imgRe = /whatsapp\.(?:png|svg|jpg|webp|ico)[\s\S]{0,400}?(\+?[\d][\d\s\-().]{5,17}[\d])/gi;
  while ((m = imgRe.exec(html)) !== null) {
    const n = normalizePhone(m[1], countryCode);
    if (n) found.push({ number: n, source: pageUrl, method: 'near_img' });
  }

  // 8. data-phone or data-whatsapp attributes
  const dataRe = /data-(?:phone|whatsapp|number)=["']([\d+\-\s().]+)["']/gi;
  while ((m = dataRe.exec(html)) !== null) {
    const n = normalizePhone(m[1], countryCode);
    if (n) found.push({ number: n, source: pageUrl, method: 'data_attr' });
  }

  // Deduplicate — prefer explicit wa.me/api over inferred
  const priority = { 'wa.me': 0, 'api.whatsapp.com': 1, 'whatsapp://': 2, 'tel_href': 3, 'data_attr': 4, 'near_keyword': 5, 'near_img': 6, 'before_keyword': 7 };
  const seen = new Map();
  for (const f of found) {
    const p = priority[f.method] ?? 99;
    const existing = seen.get(f.number);
    if (!existing || p < (priority[existing.method] ?? 99)) {
      seen.set(f.number, f);
    }
  }
  return Array.from(seen.values());
}

// Use Apify to get JS-rendered HTML (handles dynamic sites, headers, floating buttons)
async function fetchWithApify(url) {
  const APIFY_TOKEN = Deno.env.get('APIFY_API_TOKEN');
  if (!APIFY_TOKEN) return null;

  try {
    // Start Cheerio scraper (fast, gets full rendered HTML)
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/apify~cheerio-scraper/runs?token=${APIFY_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: [{ url }],
          pageFunction: `async function pageFunction(context) {
            const { $, request } = context;
            return { html: $.html(), url: request.url };
          }`,
          maxRequestsPerCrawl: 1,
        }),
      }
    );
    if (!runRes.ok) return null;
    const run = await runRes.json();
    const runId = run?.data?.id;
    if (!runId) return null;

    // Poll for completion (max 30s)
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
      const status = await statusRes.json();
      if (status?.data?.status === 'SUCCEEDED') {
        const datasetId = status.data.defaultDatasetId;
        const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`);
        const items = await itemsRes.json();
        return items?.[0]?.html || null;
      }
      if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status?.data?.status)) return null;
    }
    return null;
  } catch {
    return null;
  }
}

// Simple fetch (fast, works for static sites)
async function fetchSimple(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// AI extraction — last resort, uses 1 credit
async function aiExtract(html, pageUrl, base44) {
  try {
    const snippet = html.slice(0, 10000);
    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Extract the WhatsApp phone number from this website HTML.

Look for ALL of these:
- wa.me/NUMBER links
- api.whatsapp.com links
- Numbers next to WhatsApp icons, logos, images (whatsapp.png, whatsapp.svg, etc.)
- Numbers labeled "WhatsApp" or next to a WhatsApp button
- Floating WhatsApp chat buttons
- Numbers in header/navigation near a WhatsApp icon
- tel: links that might be WhatsApp numbers
- Any phone number associated with WhatsApp messaging

Page URL: ${pageUrl}

HTML snippet:
${snippet}

Return the WhatsApp phone number in international format (e.g. +525577679032).
If multiple numbers found, return the most likely WhatsApp one.
Return null if no WhatsApp number exists.`,
      response_json_schema: {
        type: 'object',
        properties: {
          whatsapp_number: { type: 'string' },
        }
      }
    });
    if (result?.whatsapp_number && result.whatsapp_number !== 'null' && result.whatsapp_number !== '') {
      const n = normalizePhone(result.whatsapp_number);
      if (n) return { number: n, source: pageUrl, method: 'ai' };
    }
    return null;
  } catch (e) {
    console.log('AI extraction error:', e.message);
    return null;
  }
}

// Build prioritized list of URLs to check
function buildUrls(baseUrl) {
  const url = baseUrl.startsWith('http') ? baseUrl : 'https://' + baseUrl;
  const origin = new URL(url).origin;
  const paths = [
    '', '/contacto', '/contact', '/contact-us', '/contactanos',
    '/contactenos', '/about', '/nosotros', '/quienes-somos', '/home'
  ];
  const all = [url, ...paths.map(p => origin + p)];
  return [...new Set(all)].slice(0, 5);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { lead_id, force } = await req.json();
    if (!lead_id) return Response.json({ error: 'lead_id is required' }, { status: 400 });

    const lead = await base44.entities.Lead.get(lead_id);
    if (!lead) return Response.json({ error: `Lead not found` }, { status: 404 });
    if (!lead.website) return Response.json({ error: 'No website on this lead', skipped: true });

    // Skip if recently scanned (unless forced)
    if (!force && lead.website_scanned_date && lead.website_scan_status === 'completed') {
      const daysSince = (Date.now() - new Date(lead.website_scanned_date).getTime()) / 86400000;
      if (daysSince < 7) {
        return Response.json({ skipped: true, message: `Already scanned ${Math.floor(daysSince)} days ago`, whatsapp_number: lead.whatsapp_number || null, whatsapp_detected: lead.whatsapp_detected || false });
      }
    }

    // Don't overwrite existing number unless forced
    if (!force && lead.whatsapp_number && lead.website_scan_status === 'completed') {
      return Response.json({ skipped: true, message: 'Number already exists, use force=true to override', whatsapp_number: lead.whatsapp_number, whatsapp_detected: true });
    }

    await base44.entities.Lead.update(lead_id, { website_scan_status: 'scanning' });

    const urls = buildUrls(lead.website);
    let result = null;
    let pagesScanned = 0;
    let countryCode = null;

    // === PASS 1: Simple fetch + regex (fast, free) ===
    for (const pageUrl of urls) {
      if (pagesScanned >= 3) break;
      console.log('[Pass1] Fetching:', pageUrl);
      const html = await fetchSimple(pageUrl);
      if (!html) continue;
      pagesScanned++;

      if (!countryCode) countryCode = detectCountryCode(pageUrl, html);

      const matches = extractFromHtml(html, pageUrl, countryCode);
      console.log(`[Pass1] ${matches.length} matches on ${pageUrl}:`, matches.map(m => `${m.number}(${m.method})`).join(', '));

      if (matches.length > 0) {
        // Prefer explicit URL matches
        result = matches.find(m => ['wa.me', 'api.whatsapp.com', 'whatsapp://', 'tel_href', 'data_attr'].includes(m.method)) || matches[0];
        break;
      }
    }

    // === PASS 2: Apify JS rendering on homepage (handles dynamic headers, floating buttons) ===
    if (!result) {
      const homeUrl = urls[0];
      console.log('[Pass2] Apify render:', homeUrl);
      const renderedHtml = await fetchWithApify(homeUrl);
      if (renderedHtml) {
        pagesScanned++;
        if (!countryCode) countryCode = detectCountryCode(homeUrl, renderedHtml);
        const matches = extractFromHtml(renderedHtml, homeUrl, countryCode);
        console.log(`[Pass2] Apify found ${matches.length} matches:`, matches.map(m => `${m.number}(${m.method})`).join(', '));
        if (matches.length > 0) {
          result = matches.find(m => ['wa.me', 'api.whatsapp.com', 'whatsapp://', 'tel_href', 'data_attr'].includes(m.method)) || matches[0];
        }

        // === PASS 3: AI extraction on rendered HTML (most accurate, uses 1 credit) ===
        if (!result) {
          console.log('[Pass3] AI extraction on rendered HTML');
          result = await aiExtract(renderedHtml, homeUrl, base44);
        }
      } else {
        // No Apify — try AI on simple-fetched homepage
        const homeHtml = await fetchSimple(urls[0]);
        if (homeHtml) {
          console.log('[Pass3] AI extraction on simple HTML');
          result = await aiExtract(homeHtml, urls[0], base44);
        }
      }
    }

    const now = new Date().toISOString();
    const updateData = {
      website_scanned_date: now,
      website_scan_status: 'completed',
      whatsapp_detected: !!result,
    };

    if (result) {
      updateData.whatsapp_number = result.number;
      updateData.whatsapp_source_url = result.source;
    }

    await base44.entities.Lead.update(lead_id, updateData);

    const activityDesc = result
      ? `WhatsApp Found: ${result.number} (via ${result.method} on ${result.source})`
      : `No WhatsApp found after scanning ${pagesScanned} page(s) of ${lead.website}`;

    await base44.entities.Activity.create({
      lead_id,
      type: 'note',
      title: result ? 'Website Scan — WhatsApp Found' : 'Website Scan — No WhatsApp Found',
      description: activityDesc,
      outcome: result ? 'positive' : 'neutral',
      completed: true,
    });

    return Response.json({
      success: true,
      whatsapp_number: result?.number || null,
      whatsapp_detected: !!result,
      whatsapp_source_url: result?.source || null,
      method: result?.method || null,
      pages_scanned: pagesScanned,
    });

  } catch (error) {
    console.error('Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});