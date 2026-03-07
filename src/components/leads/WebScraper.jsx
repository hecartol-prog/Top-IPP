import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Loader2, Globe, Search, UserPlus, CheckCircle2, AlertCircle, BookOpen, Link, LayoutGrid } from "lucide-react";

export default function WebScraper({ onImportComplete }) {
  const [url, setUrl] = useState("");
  const [scrapeMode, setScrapeMode] = useState("deep"); // "deep" | "logo_grid" | "simple"
  const [scraping, setScraping] = useState(false);
  const [importing, setImporting] = useState(false);
  const [extractedLeads, setExtractedLeads] = useState([]);
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [message, setMessage] = useState(null);
  const [progressState, setProgressState] = useState(null);

  // Step 1a: Analyze starting URL - detect page type and get first set of links + ALL pagination URLs
  const analyzeStartPage = async (startUrl) => {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Fetch this URL: ${startUrl}

Analyze the page and return:
1. is_detail_page: true if this is a single company/person profile page (not a listing)
2. detail_links: list of absolute URLs linking to individual company/profile pages visible on THIS page only
3. all_pagination_urls: list of ALL pagination page URLs found (page 2, page 3, page 4, etc. - include ALL page links visible in the pagination nav, not just "next")
4. has_pagination: true if there are multiple pages

Important: For detail_links, only include URLs to individual profile/company pages, NOT category or filter links.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          is_detail_page: { type: "boolean" },
          detail_links: { type: "array", items: { type: "string" } },
          all_pagination_urls: { type: "array", items: { type: "string" } },
          has_pagination: { type: "boolean" }
        }
      }
    });
    return result || { is_detail_page: false, detail_links: [], all_pagination_urls: [], has_pagination: false };
  };

  // Step 1b: Get detail links from a single listing page (for pagination pages)
  const getDetailLinksFromPage = async (pageUrl) => {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Fetch this listing page: ${pageUrl}

Return ALL URLs that link to individual company or person profile/detail pages on this page.
Do NOT include category, filter, navigation, or pagination links — only profile/detail page URLs.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          detail_links: { type: "array", items: { type: "string" } }
        }
      }
    });
    return result?.detail_links || [];
  };

  // Step 2: Extract lead data from a single detail page
  const extractFromDetailPage = async (pageUrl) => {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Fetch this company/contact detail page: ${pageUrl}

Extract ALL contact and company information visible on the page:
- Company name
- Contact person name (first and last name)
- Email address
- Phone numbers
- Website
- Physical address / location
- Industry / products / services
- Any other relevant business info

Return the data structured as a lead record.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          first_name: { type: "string" },
          last_name: { type: "string" },
          job_title: { type: "string" },
          company_name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          website: { type: "string" },
          location: { type: "string" },
          industry: { type: "string" },
          notes: { type: "string" }
        }
      }
    });
    return result;
  };

  // Step 3: Extract leads from a flat table/list on a single page (handles large tables with many rows)
  const extractFromTablePage = async (pageUrl, onProgress) => {
    // First, get the total number of entries
    const countResult = await base44.integrations.Core.InvokeLLM({
      prompt: `Visit this URL: ${pageUrl}

Count the TOTAL number of company/contact rows in the table or list on this page (do NOT count the header row). Return only the integer count.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          total_entries: { type: "number" }
        }
      }
    });

    const total = countResult?.total_entries || 80; // default high to ensure we get all
    const batchSize = 10; // smaller batches = less JSON overflow risk
    const batches = Math.ceil(total / batchSize);
    let allLeads = [];

    for (let i = 0; i < batches; i++) {
      const start = i * batchSize + 1;
      const end = Math.min((i + 1) * batchSize, total);
      if (onProgress) onProgress(i, batches, start, end);

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Visit this URL: ${pageUrl}

This page has a table/list of companies. Extract ONLY rows numbered ${start} to ${end} (use the # column or count from top, skipping the header).
For each row return: company_name, first_name, last_name, email, phone, website, industry, notes.
Return exactly the rows in that range, no more, no less.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            leads: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  first_name: { type: "string" },
                  last_name: { type: "string" },
                  email: { type: "string" },
                  phone: { type: "string" },
                  job_title: { type: "string" },
                  company_name: { type: "string" },
                  website: { type: "string" },
                  industry: { type: "string" },
                  notes: { type: "string" }
                }
              }
            }
          }
        }
      });

      allLeads = [...allLeads, ...(result?.leads || [])];
    }

    return allLeads;
  };

  // Step 4: Simple single-page extraction (fallback)
  const extractFromListingPage = async (pageUrl) => {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Visit this page and extract ALL people/companies/contacts you find: ${pageUrl}

For each, get: first_name, last_name, email, phone, job_title, company_name, linkedin_url, website, location, industry, notes.
Be thorough — extract EVERY single entry, do not stop early.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          leads: {
            type: "array",
            items: {
              type: "object",
              properties: {
                first_name: { type: "string" },
                last_name: { type: "string" },
                email: { type: "string" },
                phone: { type: "string" },
                job_title: { type: "string" },
                company_name: { type: "string" },
                linkedin_url: { type: "string" },
                website: { type: "string" },
                location: { type: "string" },
                industry: { type: "string" },
                notes: { type: "string" }
              }
            }
          }
        }
      }
    });
    return result?.leads || [];
  };

  // Step: Extract all clickable card/logo links from a grid directory page
  const extractLogoGridLinks = async (pageUrl) => {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Fetch this URL: ${pageUrl}

This is a directory page showing company logos or image cards in a grid layout. Each card has a company logo/image and a clickable link (often "Ver más", "More", or the logo itself links to a detail page).

Extract ALL absolute URLs that link to individual company detail/profile pages. These are the href values of the clickable cards or "Ver más" / "Read more" links.

Return every single link found — do not skip any.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          detail_links: { type: "array", items: { type: "string" } },
          total_cards_found: { type: "number" }
        }
      }
    });
    return result?.detail_links || [];
  };

  // Detect FlippingBook
  const isFlippingBookUrl = (u) => {
    return u.includes("flippingbook") || u.includes("page-html5-substrates") || u.includes("Directorio-de-Empresas");
  };

  const handleScrape = async () => {
    if (!url.trim()) return;
    setScraping(true);
    setMessage(null);
    setExtractedLeads([]);
    setSelectedLeads([]);
    setProgressState(null);

    let allLeads = [];

    try {
      // --- FlippingBook handling ---
      if (isFlippingBookUrl(url)) {
        setMessage({ type: "info", text: "FlippingBook detected. Scanning pages with AI vision..." });

        const detectResult = await base44.integrations.Core.InvokeLLM({
          prompt: `Fetch this FlippingBook URL: ${url}. Tell me: how many total pages does it have? (look for "pages:/N" pattern). What is the exact base URL? Is there a "uni=" hash parameter?`,
          add_context_from_internet: true,
          response_json_schema: {
            type: "object",
            properties: {
              total_pages: { type: "number" },
              base_url: { type: "string" },
              hash_param: { type: "string" }
            }
          }
        });

        const totalPages = detectResult?.total_pages || 10;
        const baseUrl = (detectResult?.base_url || url).replace(/\/$/, "") + "/";
        const hashParam = detectResult?.hash_param || "";

        const pageUrls = [];
        for (let i = 1; i <= totalPages; i++) {
          const pageNum = String(i).padStart(4, "0");
          let imgUrl = `${baseUrl}files/assets/common/page-html5-substrates/page${pageNum}_2.jpg`;
          if (hashParam) imgUrl += `?uni=${hashParam}`;
          pageUrls.push(imgUrl);
        }

        const batchSize = 3;
        for (let i = 0; i < pageUrls.length; i += batchSize) {
          const batch = pageUrls.slice(i, i + batchSize);
          setProgressState({ current: i + 1, total: pageUrls.length, label: `Scanning pages ${i + 1}–${Math.min(i + batchSize, pageUrls.length)} of ${pageUrls.length}...` });

          const batchResults = await Promise.all(batch.map(imgUrl =>
            base44.integrations.Core.InvokeLLM({
              prompt: `Look at this page image from a business directory. Extract ALL companies and contacts visible. Get: company name, website, phone, email, contact person, location, industry.`,
              file_urls: [imgUrl],
              response_json_schema: {
                type: "object",
                properties: {
                  leads: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        first_name: { type: "string" },
                        last_name: { type: "string" },
                        job_title: { type: "string" },
                        company_name: { type: "string" },
                        email: { type: "string" },
                        phone: { type: "string" },
                        website: { type: "string" },
                        location: { type: "string" },
                        industry: { type: "string" },
                        notes: { type: "string" }
                      }
                    }
                  }
                }
              }
            }).catch(() => ({ leads: [] }))
          ));

          for (const r of batchResults) {
            allLeads = [...allLeads, ...(r?.leads || [])];
          }
          setMessage({ type: "info", text: `Scanning pages... Found ${allLeads.length} companies so far.` });
        }

      } else if (deepCrawl) {
        // --- Deep crawl mode ---
        setProgressState({ current: 0, total: 1, label: "Analyzing page structure..." });

        const analysis = await analyzeStartPage(url);

        if (analysis.is_detail_page) {
          // It's already a single detail page
          setProgressState({ current: 1, total: 1, label: "Extracting from detail page..." });
          const lead = await extractFromDetailPage(url);
          if (lead?.company_name || lead?.first_name) allLeads.push(lead);

        } else {
          // It's a listing page — gather all detail links from all pages
          let allDetailLinks = [...(analysis.detail_links || [])];
          const paginationUrls = (analysis.all_pagination_urls || []).filter(l => l && l.startsWith("http") && l !== url);

          if (paginationUrls.length > 0) {
            setProgressState({ current: 0, total: paginationUrls.length, label: `Found ${paginationUrls.length} more listing pages, collecting links...` });

            // Fetch all pagination pages in parallel to get their detail links
            const pagResults = await Promise.all(
              paginationUrls.map(pgUrl => getDetailLinksFromPage(pgUrl).catch(() => []))
            );
            for (const links of pagResults) {
              allDetailLinks = [...allDetailLinks, ...links];
            }
          }

          // Deduplicate
          allDetailLinks = [...new Set(allDetailLinks)].filter(l => l && l.startsWith("http"));

          if (allDetailLinks.length === 0) {
            // Flat table/list page — use batched row extraction
            setProgressState({ current: 1, total: 1, label: "Counting entries..." });
            // Also gather from all pagination pages if any
            const allPageUrls = [url, ...paginationUrls];
            for (const pageUrl of allPageUrls) {
              const pageLeads = await extractFromTablePage(pageUrl, (i, total, start, end) => {
                setProgressState({ current: i, total, label: `Extracting rows ${start}–${end} from page...` });
              });
              allLeads = [...allLeads, ...pageLeads];
              setMessage({ type: "info", text: `Extracted ${allLeads.length} leads so far...` });
            }
          } else {
            // Visit each detail page
            setProgressState({ current: 0, total: allDetailLinks.length, label: `Found ${allDetailLinks.length} company pages. Extracting data...` });

            const batchSize = 5;
            for (let i = 0; i < allDetailLinks.length; i += batchSize) {
              const batch = allDetailLinks.slice(i, i + batchSize);
              setProgressState({ current: i, total: allDetailLinks.length, label: `Scraping companies ${i + 1}–${Math.min(i + batchSize, allDetailLinks.length)} of ${allDetailLinks.length}...` });

              const batchResults = await Promise.all(
                batch.map(detailUrl => extractFromDetailPage(detailUrl).catch(() => null))
              );

              for (const lead of batchResults) {
                if (lead && (lead.company_name || lead.first_name)) {
                  allLeads.push(lead);
                }
              }

              setMessage({ type: "info", text: `Extracted ${allLeads.length} leads so far...` });
            }
          }
        }

      } else {
        // --- Simple mode (no deep crawl) ---
        // Use batched extraction to avoid JSON overflow with large directories
        setProgressState({ current: 1, total: 1, label: "Counting entries..." });
        allLeads = await extractFromTablePage(url, (i, total, start, end) => {
          setProgressState({ current: i, total, label: `Extracting rows ${start}–${end} of ~${total * 10}...` });
          setMessage({ type: "info", text: `Extracted ${allLeads.length} leads so far...` });
        });
      }

    } catch (err) {
      setMessage({ type: "error", text: `Error: ${err.message}` });
      setScraping(false);
      setProgressState(null);
      return;
    }

    setProgressState(null);

    // Deduplicate
    const seen = new Set();
    const unique = allLeads.filter(l => {
      const key = ((l.company_name || l.first_name || "") + (l.email || "")).toLowerCase().trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (unique.length === 0) {
      setMessage({ type: "error", text: "No leads found. Try enabling Deep Crawl or check the URL." });
    } else {
      setExtractedLeads(unique);
      setSelectedLeads(unique.map((_, i) => i));
      setMessage({ type: "success", text: `Found ${unique.length} lead${unique.length !== 1 ? "s" : ""} extracted.` });
    }

    setScraping(false);
  };

  const toggleLead = (index) => {
    setSelectedLeads(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const toggleAll = () => {
    setSelectedLeads(selectedLeads.length === extractedLeads.length ? [] : extractedLeads.map((_, i) => i));
  };

  const handleImport = async () => {
    if (selectedLeads.length === 0) return;
    setImporting(true);

    let imported = 0;
    for (const index of selectedLeads) {
      const lead = extractedLeads[index];
      await base44.entities.Lead.create({
        first_name: lead.first_name || lead.company_name?.split(" ")[0] || "Unknown",
        last_name: lead.last_name || "",
        email: lead.email || "",
        phone: lead.phone || "",
        job_title: lead.job_title || "",
        company_name: lead.company_name || "",
        website: lead.website || "",
        location: lead.location || "",
        industry: lead.industry || "",
        notes: lead.notes || "",
        status: "new",
        source: "website"
      });
      imported++;
    }

    setMessage({ type: "success", text: `Successfully imported ${imported} lead${imported !== 1 ? "s" : ""}!` });
    setExtractedLeads([]);
    setSelectedLeads([]);
    setUrl("");
    setImporting(false);
    if (onImportComplete) onImportComplete();
  };

  const progressPct = progressState ? Math.round((progressState.current / Math.max(progressState.total, 1)) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* URL Input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !scraping && handleScrape()}
            placeholder="https://directory.com/companies/ or any company/contact page..."
            className="pl-10"
            disabled={scraping}
          />
        </div>
        <Button
          onClick={handleScrape}
          disabled={!url.trim() || scraping}
          className="bg-slate-900 hover:bg-slate-800 shrink-0"
        >
          {scraping ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scanning...</>
          ) : (
            <><Search className="w-4 h-4 mr-2" />Extract</>
          )}
        </Button>
      </div>

      {/* Deep crawl toggle */}
      <div className="flex items-center gap-2 px-1">
        <Checkbox
          id="deepCrawl"
          checked={deepCrawl}
          onCheckedChange={setDeepCrawl}
          disabled={scraping}
        />
        <label htmlFor="deepCrawl" className="text-sm text-slate-600 cursor-pointer select-none">
          <span className="font-medium">Deep crawl</span> — follow links to individual company pages for complete contact data
        </label>
      </div>

      {/* Progress */}
      {progressState && (
        <div className="space-y-1">
          <Progress value={progressPct} className="h-2" />
          <p className="text-xs text-slate-500 text-center">{progressState.label}</p>
        </div>
      )}

      {/* Message */}
      {message && (
        <Alert className={
          message.type === "success" ? "bg-emerald-50 border-emerald-200" :
          message.type === "info" ? "bg-blue-50 border-blue-200" :
          "bg-red-50 border-red-200"
        }>
          {message.type === "success" && <CheckCircle2 className="w-4 h-4 inline mr-2 text-emerald-600" />}
          {message.type === "info" && <BookOpen className="w-4 h-4 inline mr-2 text-blue-600" />}
          {message.type === "error" && <AlertCircle className="w-4 h-4 inline mr-2 text-red-600" />}
          <AlertDescription className={
            message.type === "success" ? "text-emerald-800" :
            message.type === "info" ? "text-blue-800" :
            "text-red-800"
          }>
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      {/* Extracted Leads Table */}
      {extractedLeads.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Extracted Leads</CardTitle>
              <div className="flex items-center gap-3">
                <button onClick={toggleAll} className="text-sm text-slate-500 hover:text-slate-800 underline">
                  {selectedLeads.length === extractedLeads.length ? "Deselect all" : "Select all"}
                </button>
                <Badge variant="secondary">{selectedLeads.length} selected</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {extractedLeads.map((lead, index) => (
                <div
                  key={index}
                  onClick={() => toggleLead(index)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors ${selectedLeads.includes(index) ? "bg-teal-50/50" : ""}`}
                >
                  <Checkbox
                    checked={selectedLeads.includes(index)}
                    onCheckedChange={() => toggleLead(index)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {((lead.company_name || lead.first_name || "?")[0]).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 text-sm truncate">
                      {lead.company_name || [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown"}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {[lead.first_name && lead.company_name ? `${lead.first_name} ${lead.last_name || ""}`.trim() : null, lead.industry].filter(Boolean).join(" · ") || "No details"}
                    </p>
                  </div>
                  <div className="text-right shrink-0 hidden sm:block">
                    {(lead.email || lead.phone) && (
                      <p className="text-xs text-slate-500 truncate max-w-[160px]">{lead.email || lead.phone}</p>
                    )}
                    {lead.location && (
                      <p className="text-xs text-slate-400 truncate max-w-[160px]">{lead.location}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-slate-100">
              <Button
                onClick={handleImport}
                disabled={selectedLeads.length === 0 || importing}
                className="w-full bg-teal-600 hover:bg-teal-700"
              >
                {importing ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing...</>
                ) : (
                  <><UserPlus className="w-4 h-4 mr-2" />Import {selectedLeads.length} Lead{selectedLeads.length !== 1 ? "s" : ""}</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-slate-400 text-center">
        Deep crawl visits each company's detail page for complete contact info · Also supports FlippingBooks & image directories
      </p>
    </div>
  );
}