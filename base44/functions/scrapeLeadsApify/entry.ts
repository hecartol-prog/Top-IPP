import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

var APIFY_TOKEN = Deno.env.get('APIFY_API_TOKEN');

async function fetchDirect(url, timeoutMs) {
  if (!timeoutMs) timeoutMs = 20000;
  try {
    var resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept': 'text/html,*/*;q=0.9',
        'Accept-Language': 'en-US,en;q=0.9,es;q=0.8'
      },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow'
    });
    if (!resp.ok) return null;
    var html = await resp.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s{2,}/g, ' ')
      .trim();
  } catch (e) {
    console.log('fetchDirect failed:', e.message);
    return null;
  }
}

async function searchDDG(query) {
  try {
    var resp = await fetch(
      'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query),
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) }
    );
    if (!resp.ok) return null;
    var html = await resp.text();
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 5000);
  } catch (e) { return null; }
}

async function searchBing(query) {
  try {
    var resp = await fetch(
      'https://www.bing.com/search?q=' + encodeURIComponent(query) + '&count=10',
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120' }, signal: AbortSignal.timeout(10000) }
    );
    if (!resp.ok) return null;
    var html = await resp.text();
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 5000);
  } catch (e) { return null; }
}

async function fetchWithApify(url, maxPages) {
  if (!APIFY_TOKEN) throw new Error('APIFY_API_TOKEN not configured');
  if (!maxPages) maxPages = 3;

  var apifyStart = await fetch(
    'https://api.apify.com/v2/acts/apify~website-content-crawler/runs?token=' + APIFY_TOKEN,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startUrls: [{ url: url }],
        maxCrawlPages: maxPages,
        crawlerType: 'cheerio',
        maxCrawlDepth: 1,
        pageLoadTimeoutSecs: 30
      })
    }
  );
  if (!apifyStart.ok) throw new Error('Apify start failed: ' + apifyStart.status);
  var startData = await apifyStart.json();
  var runId = startData.data.id;

  for (var i = 0; i < 40; i++) {
    await new Promise(function(resolve) { setTimeout(resolve, 4000); });
    var statusResp = await fetch('https://api.apify.com/v2/actor-runs/' + runId + '?token=' + APIFY_TOKEN);
    var statusData = await statusResp.json();
    var runStatus = statusData.data.status;
    if (runStatus === 'SUCCEEDED') break;
    if (runStatus === 'FAILED' || runStatus === 'ABORTED' || runStatus === 'TIMED-OUT') {
      throw new Error('Apify run ' + runStatus);
    }
  }

  var infoResp = await fetch('https://api.apify.com/v2/actor-runs/' + runId + '?token=' + APIFY_TOKEN);
  var infoData = await infoResp.json();
  var dsId = (infoData.data && infoData.data.defaultDatasetId) ? infoData.data.defaultDatasetId : null;
  if (!dsId) return [];

  var itemsResp = await fetch('https://api.apify.com/v2/datasets/' + dsId + '/items?token=' + APIFY_TOKEN + '&clean=true&limit=100');
  try {
    return JSON.parse(await itemsResp.text()) || [];
  } catch (e) { return []; }
}

Deno.serve(async function(req) {
  try {
    var base44 = createClientFromRequest(req);
    var user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    var body = await req.json();
    var url = body.url;
    var mode = body.mode;
    var search_query = body.search_query;

    if (!url && !search_query) {
      return Response.json({ error: 'url or search_query is required' }, { status: 400 });
    }

    var serviceRole = base44.asServiceRole;
    var allText = '';
    var pageCount = 0;
    var method = 'none';

    if (url) {
      console.log('Strategy 1: Direct fetch ' + url);
      var directText = await fetchDirect(url, 20000);
      if (directText && directText.length > 500) {
        allText = directText;
        pageCount = 1;
        method = 'direct_fetch';
        console.log('Direct fetch OK: ' + directText.length + ' chars');
      }

      if ((!allText || allText.length < 500) && APIFY_TOKEN) {
        console.log('Strategy 2: Apify...');
        try {
          var maxPages = mode === 'deep' ? 15 : 3;
          var pages = await fetchWithApify(url, maxPages);
          if (pages.length > 0) {
            pageCount = pages.length;
            var cpp = Math.floor(50000 / pages.length);
            allText = pages.map(function(p) {
              return '--- ' + p.url + ' ---\n' + (p.text || p.markdown || '').slice(0, cpp);
            }).join('\n\n');
            method = 'apify';
          }
        } catch (e) {
          console.log('Apify failed (optional):', e.message);
        }
      }
    }

    if (search_query || (!allText && url)) {
      var query = search_query || ('companies directory ' + url);
      console.log('Strategy 3: Search engines for: ' + query);

      var searchSettled = await Promise.allSettled([
        searchDDG(query),
        searchBing(query + ' directory list companies')
      ]);

      var ddgText = (searchSettled[0].status === 'fulfilled' && searchSettled[0].value)
        ? '=== DuckDuckGo ===\n' + searchSettled[0].value : null;
      var bingText = (searchSettled[1].status === 'fulfilled' && searchSettled[1].value)
        ? '=== Bing ===\n' + searchSettled[1].value : null;
      var searchText = [ddgText, bingText].filter(Boolean).join('\n\n');

      if (searchText) {
        allText = (allText ? allText + '\n\n' : '') + searchText;
        method = method === 'direct_fetch' ? 'direct+search' : 'search_engines';
        pageCount += 1;
      }
    }

    if (!allText || allText.trim().length < 100) {
      return Response.json({
        leads: [],
        pages_scraped: 0,
        method: 'none',
        message: 'Could not retrieve content. Try using search_query instead of a URL.'
      });
    }

    console.log('Extracting leads from ' + allText.length + ' chars...');

    var sourceLabel = pageCount + ' source' + (pageCount !== 1 ? 's' : '');
    var extractResult = await serviceRole.integrations.Core.InvokeLLM({
      prompt: 'Extract ALL B2B company and contact leads from this web content for a plastic injection mold CRM.\n\nExtract EVERY distinct company or contact. Be thorough.\n\nFor each get: company name, website, email, phone, city, country, industry, contact name and title.\n\nRules:\n- Only real companies, not ads or navigation links\n- Clean phone numbers: keep digits and + sign only\n- Include full website URL if listed\n\nContent (' + sourceLabel + '):\n---\n' + allText.slice(0, 55000) + '\n---\n\nReturn ALL companies and contacts found.',
      response_json_schema: {
        type: 'object',
        properties: {
          leads: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                first_name: { type: 'string' },
                last_name: { type: 'string' },
                job_title: { type: 'string' },
                company_name: { type: 'string' },
                email: { type: 'string' },
                phone: { type: 'string' },
                website: { type: 'string' },
                location: { type: 'string' },
                country: { type: 'string' },
                industry: { type: 'string' },
                notes: { type: 'string' }
              }
            }
          }
        }
      }
    });

    var leads = (extractResult && extractResult.leads ? extractResult.leads : []).filter(function(l) {
      return l.company_name || l.first_name;
    });

    console.log('Extracted ' + leads.length + ' leads');
    return Response.json({ leads: leads, pages_scraped: pageCount, method: method, total: leads.length });

  } catch (error) {
    console.error('scrapeLeadsApify error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
