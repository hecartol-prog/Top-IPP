import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

var APIFY_TOKEN = Deno.env.get('APIFY_API_TOKEN');

async function fetchDirect(url, timeoutMs) {
  if (!timeoutMs) timeoutMs = 25000;
  try {
    var resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,es;q=0.8,pt;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache'
      },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow'
    });
    if (!resp.ok) {
      console.log('fetchDirect HTTP ' + resp.status + ' for ' + url);
      return null;
    }
    var html = await resp.text();
    var text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#\d+;/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    console.log('fetchDirect OK: ' + text.length + ' chars from ' + url);
    return text;
  } catch (e) {
    console.log('fetchDirect failed for ' + url + ': ' + e.message);
    return null;
  }
}

async function fetchWithApify(url, maxPages) {
  if (!APIFY_TOKEN) throw new Error('APIFY_API_TOKEN not configured');
  if (!maxPages) maxPages = 5;

  console.log('Starting Apify crawl: ' + url + ' (max ' + maxPages + ' pages)');

  var apifyStart = await fetch(
    'https://api.apify.com/v2/acts/apify~website-content-crawler/runs?token=' + APIFY_TOKEN,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startUrls: [{ url: url }],
        maxCrawlPages: maxPages,
        crawlerType: 'cheerio',
        maxCrawlDepth: 2,
        pageLoadTimeoutSecs: 30,
        requestTimeoutSecs: 60
      })
    }
  );
  if (!apifyStart.ok) {
    var errText = await apifyStart.text();
    throw new Error('Apify start failed: ' + apifyStart.status + ' ' + errText.slice(0, 200));
  }
  var startData = await apifyStart.json();
  var runId = startData.data.id;
  console.log('Apify run started: ' + runId);

  // Poll up to 3 minutes
  for (var i = 0; i < 45; i++) {
    await new Promise(function(resolve) { setTimeout(resolve, 4000); });
    var statusResp = await fetch('https://api.apify.com/v2/actor-runs/' + runId + '?token=' + APIFY_TOKEN);
    var statusData = await statusResp.json();
    var runStatus = statusData.data.status;
    console.log('Apify status: ' + runStatus + ' (' + (i+1) + '/45)');
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
    var items = JSON.parse(await itemsResp.text()) || [];
    console.log('Apify returned ' + items.length + ' pages');
    return items;
  } catch (e) { return []; }
}

async function searchDDG(query) {
  try {
    var resp = await fetch(
      'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query),
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120',
          'Accept': 'text/html'
        },
        signal: AbortSignal.timeout(12000)
      }
    );
    if (!resp.ok) return null;
    var html = await resp.text();
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 6000);
  } catch (e) {
    console.log('DDG search failed: ' + e.message);
    return null;
  }
}

async function searchBing(query) {
  try {
    var resp = await fetch(
      'https://www.bing.com/search?q=' + encodeURIComponent(query) + '&count=10',
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120' },
        signal: AbortSignal.timeout(12000)
      }
    );
    if (!resp.ok) return null;
    var html = await resp.text();
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 6000);
  } catch (e) {
    console.log('Bing search failed: ' + e.message);
    return null;
  }
}

Deno.serve(async function(req) {
  try {
    var base44 = createClientFromRequest(req);

    var body = await req.json();
    var url = (body.url || '').trim();
    var mode = body.mode || 'simple';
    var search_query = body.search_query || '';

    if (!url && !search_query) {
      return Response.json({ error: 'url or search_query is required' }, { status: 400 });
    }

    var allText = '';
    var pageCount = 0;
    var method = 'none';

    if (url) {
      // Strategy 1: Direct fetch (always try first — fast and free)
      console.log('Strategy 1: Direct fetch ' + url);
      var directText = await fetchDirect(url, 25000);
      if (directText && directText.length > 300) {
        allText = directText;
        pageCount = 1;
        method = 'direct_fetch';
      }

      // If direct fetch got very little content, or mode is deep — try Apify
      var needsApify = (!allText || allText.length < 500) || mode === 'deep';
      if (needsApify && APIFY_TOKEN) {
        console.log('Strategy 2: Apify crawl (mode=' + mode + ')');
        try {
          var maxPages = mode === 'deep' ? 15 : 5;
          var pages = await fetchWithApify(url, maxPages);
          if (pages.length > 0) {
            pageCount = pages.length;
            var charsPerPage = Math.floor(50000 / pages.length);
            var apifyText = pages.map(function(p) {
              return '--- PAGE: ' + p.url + ' ---\n' + (p.text || p.markdown || '').slice(0, charsPerPage);
            }).join('\n\n');
            // Use whichever is longer
            if (apifyText.length > allText.length) {
              allText = apifyText;
              method = 'apify';
            }
          }
        } catch (e) {
          console.log('Apify failed (using direct fetch result): ' + e.message);
        }
      }
    }

    // Strategy 3: Search engines (for search_query or if we still have nothing)
    if (search_query || !allText) {
      var query = search_query || ('contact information ' + url);
      console.log('Strategy 3: Search engines for: ' + query);
      var results = await Promise.allSettled([searchDDG(query), searchBing(query)]);
      var searchParts = [];
      if (results[0].status === 'fulfilled' && results[0].value) searchParts.push('=== DuckDuckGo ===\n' + results[0].value);
      if (results[1].status === 'fulfilled' && results[1].value) searchParts.push('=== Bing ===\n' + results[1].value);
      if (searchParts.length > 0) {
        var searchText = searchParts.join('\n\n');
        allText = allText ? allText + '\n\n' + searchText : searchText;
        method = method === 'none' ? 'search_engines' : method + '+search';
        pageCount += 1;
      }
    }

    if (!allText || allText.trim().length < 100) {
      return Response.json({
        leads: [],
        pages_scraped: 0,
        method: 'none',
        message: 'Could not retrieve content from the URL. The site may be blocking automated requests. Try a different URL or use the search_query parameter.'
      });
    }

    console.log('Extracting leads from ' + allText.length + ' chars (method=' + method + ')...');

    var extractResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: 'You are extracting B2B company and contact leads from web content for a plastic injection mold CRM.\n\nExtract ALL distinct companies and contacts found in this content. Be thorough and extract every company or person mentioned.\n\nFor each entry extract:\n- company_name (required)\n- first_name, last_name (contact person if found)\n- job_title\n- email\n- phone (keep digits and + sign, remove formatting)\n- website (full URL)\n- location (city, region)\n- country\n- industry\n- notes (brief description)\n\nRules:\n- Only real companies/people, not navigation links or ads\n- If only a company is found with no contact person, leave first_name/last_name empty\n- Include ALL emails and phone numbers found\n- Clean phone numbers: digits and + only\n\nContent:\n---\n' + allText.slice(0, 35000) + '\n---\n\nReturn a JSON array of all leads found.',
      response_json_schema: {
        type: 'object',
        properties: {
          leads: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                first_name:   { type: 'string' },
                last_name:    { type: 'string' },
                job_title:    { type: 'string' },
                company_name: { type: 'string' },
                email:        { type: 'string' },
                phone:        { type: 'string' },
                website:      { type: 'string' },
                location:     { type: 'string' },
                country:      { type: 'string' },
                industry:     { type: 'string' },
                notes:        { type: 'string' }
              }
            }
          }
        }
      }
    });

    var leads = (extractResult && extractResult.leads ? extractResult.leads : []).filter(function(l) {
      return l.company_name || l.first_name;
    });

    // Clean up N/A values
    leads = leads.map(function(l) {
      var cleaned = {};
      for (var key in l) {
        var val = l[key];
        cleaned[key] = (val && val !== 'N/A' && val !== 'n/a' && val !== 'NA') ? val : '';
      }
      return cleaned;
    });

    console.log('Extracted ' + leads.length + ' leads');
    return Response.json({ leads: leads, pages_scraped: pageCount, method: method, total: leads.length });

  } catch (error) {
    console.error('scrapeLeadsApify error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});