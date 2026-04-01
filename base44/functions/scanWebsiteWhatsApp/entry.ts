import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Normalize a raw phone number to international format +XXXXXXXXXXX
function normalizePhone(raw, defaultCountryCode = null) {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits.length >= 8 ? digits : null;
  if (digits.startsWith('00')) return digits.length >= 10 ? '+' + digits.slice(2) : null;
  if (digits.length >= 10) {
    if (defaultCountryCode) return '+' + defaultCountryCode + digits;
    return '+' + digits;
  }
  return null;
}

// Detect likely country code from URL/content (helps normalize short numbers)
function detectCountryCode(url, html) {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('.mx') || (html && html.includes('México'))) return '52';
  if (urlLower.includes('.br') || (html && html.includes('Brasil'))) return '55';
  if (urlLower.includes('.ar') || (html && html.includes('Argentina'))) return '54';
  if (urlLower.includes('.co') || (html && html.includes('Colombia'))) return '57';
  if (urlLower.includes('.es') || (html && html.includes('España'))) return '34';
  return null;
}

// Extract WhatsApp numbers from HTML content — comprehensive patterns
function extractWhatsAppNumbers(html, pageUrl, countryCode) {
  const found = [];

  // Pattern 1: wa.me links  e.g. wa.me/5511999999999
  const waMeRegex = /wa\.me\/(\+?[\d]{7,15})/gi;
  let m;
  while ((m = waMeRegex.exec(html)) !== null) {
    const n = normalizePhone(m[1], countryCode);
    if (n) found.push({ number: n, source: pageUrl, method: 'wa.me' });
  }

  // Pattern 2: api.whatsapp.com/send?phone=
  const apiRegex = /api\.whatsapp\.com\/send[?&][^"'\s<>]*phone=([\d+%]+)/gi;
  while ((m = apiRegex.exec(html)) !== null) {
    const raw = decodeURIComponent(m[1]);
    const n = normalizePhone(raw, countryCode);
    if (n) found.push({ number: n, source: pageUrl, method: 'api.whatsapp.com' });
  }

  // Pattern 3: whatsapp: protocol links
  const waProtoRegex = /whatsapp:\/\/send[?&][^"'\s<>]*phone=([\d+%]+)/gi;
  while ((m = waProtoRegex.exec(html)) !== null) {
    const raw = decodeURIComponent(m[1]);
    const n = normalizePhone(raw, countryCode);
    if (n) found.push({ number: n, source: pageUrl, method: 'whatsapp:' });
  }

  // Pattern 4: href="tel:..." links — any tel: link (WhatsApp icon often wraps a tel: href)
  const telRegex = /href=["']tel:([\d+\-\s().]+)["']/gi;
  while ((m = telRegex.exec(html)) !== null) {
    const n = normalizePhone(m[1], countryCode);
    if (n) found.push({ number: n, source: pageUrl, method: 'tel_href' });
  }

  // Pattern 5: Text near "WhatsApp" or WA icon followed by phone number
  // Covers cases like "(55) 7767 9032" text sitting next to a whatsapp icon/mention
  const waTextRegex = /(?:whatsapp|watsapp|wa[\s:]+|icon-whatsapp|fa-whatsapp|whatsapp-icon|wp-icon)[\s\S]{0,200}?(\+?[\d][\d\s\-().]{6,18}[\d])/gi;
  while ((m = waTextRegex.exec(html)) !== null) {
    const n = normalizePhone(m[1], countryCode);
    if (n) found.push({ number: n, source: pageUrl, method: 'text_near_whatsapp' });
  }

  // Pattern 6: Phone number BEFORE a whatsapp mention (phone listed first, then icon)
  const beforeWaRegex = /(\+?[\d][\d\s\-().]{6,18}[\d])[\s\S]{0,200}?(?:whatsapp|icon-whatsapp|fa-whatsapp|whatsapp-icon)/gi;
  while ((m = beforeWaRegex.exec(html)) !== null) {
    const n = normalizePhone(m[1], countryCode);
    if (n) found.push({ number: n, source: pageUrl, method: 'phone_before_whatsapp' });
  }

  // Pattern 7: SVG/img whatsapp icon adjacent to number in header/nav
  // Look for whatsapp image/svg near a phone number in common header patterns
  const headerWaRegex = /(?:whatsapp\.(?:png|svg|jpg|webp|ico)|whatsapp[_-]?(?:icon|logo|btn|button))[\s\S]{0,300}?(\+?[\d][\d\s\-().]{6,18}[\d])/gi;
  while ((m = headerWaRegex.exec(html)) !== null) {
    const n = normalizePhone(m[1], countryCode);
    if (n) found.push({ number: n, source: pageUrl, method: 'img_near_phone' });
  }

  // Deduplicate by number (prefer wa.me > api > tel > others)
  const priority = { 'wa.me': 0, 'api.whatsapp.com': 1, 'whatsapp:': 2, 'tel_href': 3, 'text_near_whatsapp': 4, 'phone_before_whatsapp': 5, 'img_near_phone': 6 };
  const seen = new Map();
  for (const f of found) {
    if (!seen.has(f.number) || priority[f.method] < priority[seen.get(f.number).method]) {
      seen.set(f.number, f);
    }
  }
  return Array.from(seen.values());
}

// AI fallback: ask LLM to extract WhatsApp number from raw HTML
async function aiExtractWhatsApp(html, pageUrl, base44) {
  try {
    // Truncate HTML to avoid huge prompts — take first 8000 chars
    const snippet = html.slice(0, 8000);
    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Extract the WhatsApp contact phone number from this website HTML. 
Look for:
- Numbers next to WhatsApp icons or logos
- wa.me links
- api.whatsapp.com links  
- Phone numbers labeled as "WhatsApp"
- Numbers in the header/navigation area that have a WhatsApp icon nearby

Return ONLY the phone number in international format (e.g. +525577679032) if found.
If no WhatsApp number is found, return null.

Page URL: ${pageUrl}

HTML:
${snippet}`,
      response_json_schema: {
        type: "object",
        properties: {
          whatsapp_number: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] }
        }
      }
    });
    if (result?.whatsapp_number && result.whatsapp_number !== 'null') {
      const normalized = normalizePhone(result.whatsapp_number);
      if (normalized) return { number: normalized, source: pageUrl, method: 'ai_extraction', confidence: result.confidence };
    }
    return null;
  } catch (e) {
    console.log('AI extraction failed:', e.message);
    return null;
  }
}

// Fetch a page and return its HTML text (with timeout)
async function fetchPage(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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

// Build list of URLs to scan (homepage + common contact paths in Spanish and English)
function buildUrlsToScan(baseUrl) {
  const url = baseUrl.startsWith('http') ? baseUrl : 'https://' + baseUrl;
  const origin = new URL(url).origin;
  const paths = [
    '', '/contacto', '/contact', '/contact-us', '/contactanos',
    '/contactenos', '/about', '/nosotros', '/quienes-somos'
  ];
  // Start with the given URL, then homepage, then other paths
  const all = [url, origin, ...paths.map(p => origin + p)];
  return [...new Set(all)].slice(0, 6); // max 6 unique URLs
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { lead_id, force } = await req.json();
    if (!lead_id) return Response.json({ error: 'lead_id is required' }, { status: 400 });

    const lead = await base44.entities.Lead.get(lead_id);
    if (!lead) return Response.json({ error: `Entity Lead with ID ${lead_id} not found` }, { status: 404 });

    if (!lead.website) {
      return Response.json({ error: 'No website on this lead', skipped: true });
    }

    // Safety: don't rescan within 7 days unless forced
    if (!force && lead.website_scanned_date && lead.website_scan_status === 'completed') {
      const daysSince = (Date.now() - new Date(lead.website_scanned_date).getTime()) / 86400000;
      if (daysSince < 7) {
        return Response.json({
          skipped: true,
          message: `Already scanned ${Math.floor(daysSince)} days ago`,
          whatsapp_number: lead.whatsapp_number || null,
          whatsapp_detected: lead.whatsapp_detected || false,
        });
      }
    }

    // Don't overwrite a manually entered number unless forced
    if (!force && lead.whatsapp_number && lead.website_scan_status === 'completed') {
      return Response.json({
        skipped: true,
        message: 'WhatsApp number already exists (use force=true to override)',
        whatsapp_number: lead.whatsapp_number,
        whatsapp_detected: true,
      });
    }

    // Mark as scanning
    await base44.entities.Lead.update(lead_id, { website_scan_status: 'scanning' });

    const urlsToScan = buildUrlsToScan(lead.website);
    let bestResult = null;
    let pagesScanned = 0;
    let countryCode = null;

    for (const pageUrl of urlsToScan) {
      if (pagesScanned >= 4) break;
      console.log('Scanning:', pageUrl);
      const html = await fetchPage(pageUrl);
      if (!html) {
        console.log('Could not fetch:', pageUrl);
        continue;
      }
      pagesScanned++;

      // Detect country code from first page
      if (!countryCode) {
        countryCode = detectCountryCode(pageUrl, html);
        console.log('Detected country code:', countryCode);
      }

      // Try regex extraction first (free)
      const matches = extractWhatsAppNumbers(html, pageUrl, countryCode);
      console.log(`Found ${matches.length} matches on ${pageUrl}:`, matches.map(m => `${m.number} (${m.method})`));

      if (matches.length > 0) {
        // Prefer explicit wa.me/api matches over text-near matches
        const explicit = matches.find(m => ['wa.me', 'api.whatsapp.com', 'whatsapp:'].includes(m.method));
        bestResult = explicit || matches[0];
        break;
      }

      // If no regex match on homepage/first page, try AI extraction
      if (pagesScanned === 1 && !bestResult) {
        console.log('No regex match, trying AI extraction on:', pageUrl);
        const aiResult = await aiExtractWhatsApp(html, pageUrl, base44);
        if (aiResult) {
          console.log('AI found:', aiResult.number);
          bestResult = aiResult;
          break;
        }
      }
    }

    const now = new Date().toISOString();
    const updateData = {
      website_scanned_date: now,
      website_scan_status: 'completed',
    };

    let activityDescription;

    if (bestResult) {
      updateData.whatsapp_number = bestResult.number;
      updateData.whatsapp_detected = true;
      updateData.whatsapp_source_url = bestResult.source;
      activityDescription = `WhatsApp Found: ${bestResult.number} (via ${bestResult.method} on ${bestResult.source})`;
      console.log('WhatsApp found:', bestResult.number, 'on', bestResult.source);
    } else {
      updateData.whatsapp_detected = false;
      activityDescription = `No WhatsApp contact found after scanning ${pagesScanned} page(s) of ${lead.website}`;
      console.log('No WhatsApp found for', lead.website);
    }

    await base44.entities.Lead.update(lead_id, updateData);

    await base44.entities.Activity.create({
      lead_id,
      type: 'note',
      title: bestResult ? 'Website Scan — WhatsApp Found' : 'Website Scan — No WhatsApp Found',
      description: activityDescription,
      outcome: bestResult ? 'positive' : 'neutral',
      completed: true,
    });

    return Response.json({
      success: true,
      whatsapp_number: updateData.whatsapp_number || null,
      whatsapp_detected: updateData.whatsapp_detected,
      whatsapp_source_url: updateData.whatsapp_source_url || null,
      pages_scanned: pagesScanned,
      method: bestResult?.method || null,
    });

  } catch (error) {
    console.error('scanWebsiteWhatsApp error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});