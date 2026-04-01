import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Normalize a raw phone number to international format +XXXXXXXXXXX
function normalizePhone(raw) {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, '');
  // Already has + prefix
  if (digits.startsWith('+')) return digits;
  // Common: starts with 00 (international prefix)
  if (digits.startsWith('00')) return '+' + digits.slice(2);
  // If 10+ digits assume it needs a + prefix
  if (digits.length >= 10) return '+' + digits;
  return null;
}

// Extract WhatsApp numbers from HTML content
function extractWhatsAppNumbers(html, pageUrl) {
  const found = [];

  // Pattern 1: wa.me links  e.g. wa.me/5511999999999
  const waMeRegex = /wa\.me\/(\+?[\d]{7,15})/gi;
  let m;
  while ((m = waMeRegex.exec(html)) !== null) {
    const n = normalizePhone(m[1]);
    if (n) found.push({ number: n, source: pageUrl, method: 'wa.me' });
  }

  // Pattern 2: api.whatsapp.com/send?phone=
  const apiRegex = /api\.whatsapp\.com\/send[?&][^"'\s]*phone=([\d+%]+)/gi;
  while ((m = apiRegex.exec(html)) !== null) {
    const raw = decodeURIComponent(m[1]);
    const n = normalizePhone(raw);
    if (n) found.push({ number: n, source: pageUrl, method: 'api.whatsapp.com' });
  }

  // Pattern 3: whatsapp: protocol links
  const waProtoRegex = /whatsapp:\/\/send\?phone=([\d+%]+)/gi;
  while ((m = waProtoRegex.exec(html)) !== null) {
    const raw = decodeURIComponent(m[1]);
    const n = normalizePhone(raw);
    if (n) found.push({ number: n, source: pageUrl, method: 'whatsapp:' });
  }

  // Pattern 4: Text near "WhatsApp" or "WA" followed by a phone number
  // Look for 7-15 digit phone numbers within 120 chars of whatsapp/WA mention
  const waTextRegex = /(?:whatsapp|whatsapp:|watsapp|wa[\s:]+)[\s\S]{0,120}?(\+?[\d][\d\s\-().]{6,18}[\d])/gi;
  while ((m = waTextRegex.exec(html)) !== null) {
    const n = normalizePhone(m[1]);
    if (n) found.push({ number: n, source: pageUrl, method: 'text_near_whatsapp' });
  }

  // Deduplicate by number
  const seen = new Set();
  return found.filter(f => {
    if (seen.has(f.number)) return false;
    seen.add(f.number);
    return true;
  });
}

// Fetch a page and return its HTML text (with timeout)
async function fetchPage(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WhatsAppScanner/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const text = await res.text();
    return text;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// Build list of URLs to scan (homepage + common contact paths)
function buildUrlsToScan(baseUrl) {
  const url = baseUrl.startsWith('http') ? baseUrl : 'https://' + baseUrl;
  const origin = new URL(url).origin;
  const paths = ['', '/contact', '/contact-us', '/contacts', '/about', '/about-us'];
  // homepage first, then subdirs — max 3 pages
  const urls = [...new Set([url, ...paths.map(p => origin + p)])].slice(0, 6);
  return urls;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { lead_id, force } = await req.json();
    if (!lead_id) return Response.json({ error: 'lead_id is required' }, { status: 400 });

    // Fetch lead
    const lead = await base44.entities.Lead.get(lead_id);
    if (!lead) return Response.json({ error: 'Lead not found' }, { status: 404 });

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
    if (!force && lead.whatsapp_number) {
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
    let allFound = [];
    let pagesScanned = 0;

    for (const pageUrl of urlsToScan) {
      if (pagesScanned >= 3) break; // max 3 pages
      console.log('Scanning:', pageUrl);
      const html = await fetchPage(pageUrl);
      if (!html) continue;
      pagesScanned++;
      const matches = extractWhatsAppNumbers(html, pageUrl);
      allFound = [...allFound, ...matches];
      if (allFound.length > 0) break; // stop as soon as we find one
    }

    const now = new Date().toISOString();
    let updateData = {
      website_scanned_date: now,
      website_scan_status: 'completed',
    };

    let activityDescription;

    if (allFound.length > 0) {
      const best = allFound[0];
      updateData.whatsapp_number = best.number;
      updateData.whatsapp_detected = true;
      updateData.whatsapp_source_url = best.source;
      activityDescription = `WhatsApp Found: ${best.number} (via ${best.method} on ${best.source})`;
      console.log('WhatsApp found:', best.number, 'on', best.source);
    } else {
      updateData.whatsapp_detected = false;
      activityDescription = `No WhatsApp contact found after scanning ${pagesScanned} page(s) of ${lead.website}`;
      console.log('No WhatsApp found for', lead.website);
    }

    // Save to lead
    await base44.entities.Lead.update(lead_id, updateData);

    // Log activity
    await base44.entities.Activity.create({
      lead_id,
      type: 'note',
      title: allFound.length > 0 ? 'Website Scan — WhatsApp Found' : 'Website Scan — No WhatsApp Found',
      description: activityDescription,
      outcome: allFound.length > 0 ? 'positive' : 'neutral',
      completed: true,
    });

    return Response.json({
      success: true,
      whatsapp_number: updateData.whatsapp_number || null,
      whatsapp_detected: updateData.whatsapp_detected,
      whatsapp_source_url: updateData.whatsapp_source_url || null,
      pages_scanned: pagesScanned,
    });

  } catch (error) {
    console.error('scanWebsiteWhatsApp error:', error.message);
    // Mark as failed is best-effort — body already read so skip
    return Response.json({ error: error.message }, { status: 500 });
  }
});