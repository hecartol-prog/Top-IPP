import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Loader2, Globe, Search, UserPlus, CheckCircle2, AlertCircle, BookOpen, Link } from "lucide-react";

export default function WebScraper({ onImportComplete }) {
  const [url, setUrl] = useState("");
  const [deepCrawl, setDeepCrawl] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [importing, setImporting] = useState(false);
  const [extractedLeads, setExtractedLeads] = useState([]);
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [message, setMessage] = useState(null);
  const [progressState, setProgressState] = useState(null);

  // Step 1: Discover all listing/detail links from a directory page (including pagination)
  const discoverLinks = async (startUrl) => {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Fetch this URL: ${startUrl}

Your job is to find ALL links that lead to individual company/person/profile detail pages.
Also find pagination links (next page, page 2, page 3, etc.) so we can get ALL entries.

Return:
- detail_links: array of absolute URLs that each point to an individual company or person profile page (NOT category, NOT filter, NOT nav links - only profile/detail pages)
- pagination_links: array of URLs for other pages of this same listing (page 2, page 3, etc.)
- is_detail_page: true if this URL IS already a single company/person detail page (not a listing)
- page_type: "listing" | "detail" | "other"

For this URL, look for patterns like /directorio/company-name/ or /profile/name/ etc.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          detail_links: { type: "array", items: { type: "string" } },
          pagination_links: { type: "array", items: { type: "string" } },
          is_detail_page: { type: "boolean" },
          page_type: { type: "string" }
        }
      }
    });
    return result || { detail_links: [], pagination_links: [], is_detail_page: false, page_type: "other" };
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
  const extractFromTablePage = async (pageUrl) => {
    // First, get the total number of entries to know how many batches we need
    const countResult = await base44.integrations.Core.InvokeLLM({
      prompt: `Visit this URL: ${pageUrl}
      
Count the TOTAL number of company/contact rows in the table or list on this page. Just return the count. Also return whether the data is in an HTML table or a list format.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          total_entries: { type: "number" },
          format: { type: "string" }
        }
      }
    });

    const total = countResult?.total_entries || 0;
    const batchSize = 20;
    const batches = Math.max(1, Math.ceil(total / batchSize));
    let allLeads = [];

    for (let i = 0; i < batches; i++) {
      const start = i * batchSize + 1;
      const end = Math.min((i + 1) * batchSize, total || 999);

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Visit this URL: ${pageUrl}

Extract companies/contacts numbered ${start} to ${end} from the table or list on this page. 
Extract EVERY row in that range — do not skip any.
For each entry get: company_name, representative/contact person name (split into first_name + last_name), email, phone, website, industry/activity, location, notes.`,
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
                  location: { type: "string" },
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

        // Discover the page type and links
        const discovery = await discoverLinks(url);

        if (discovery.is_detail_page || discovery.page_type === "detail") {
          // It's already a detail page - extract directly
          setProgressState({ current: 1, total: 1, label: "Extracting from detail page..." });
          const lead = await extractFromDetailPage(url);
          if (lead?.company_name || lead?.first_name) allLeads.push(lead);

        } else {
          // It's a listing page - collect all detail links across all pagination pages
          let allDetailLinks = [...(discovery.detail_links || [])];
          const paginationLinks = discovery.pagination_links || [];

          // Fetch pagination pages to get more detail links
          if (paginationLinks.length > 0) {
            setProgressState({ current: 0, total: paginationLinks.length, label: `Found ${paginationLinks.length} more pages, collecting all company links...` });
            
            const pagResults = await Promise.all(
              paginationLinks.map(pgUrl =>
                base44.integrations.Core.InvokeLLM({
                  prompt: `Fetch this listing page: ${pgUrl}. Return all individual company/profile detail page links found on it (NOT category or nav links).`,
                  add_context_from_internet: true,
                  response_json_schema: {
                    type: "object",
                    properties: {
                      detail_links: { type: "array", items: { type: "string" } }
                    }
                  }
                }).catch(() => ({ detail_links: [] }))
              )
            );

            for (const r of pagResults) {
              allDetailLinks = [...allDetailLinks, ...(r?.detail_links || [])];
            }
          }

          // Deduplicate links
          allDetailLinks = [...new Set(allDetailLinks)].filter(l => l && l.startsWith("http"));

          if (allDetailLinks.length === 0) {
            // Fallback: just extract from the listing page directly
            setProgressState({ current: 1, total: 1, label: "No detail links found, extracting from listing..." });
            allLeads = await extractFromListingPage(url);
          } else {
            // Visit each detail page and extract data
            setProgressState({ current: 0, total: allDetailLinks.length, label: `Found ${allDetailLinks.length} company pages. Extracting data...` });

            const batchSize = 5;
            for (let i = 0; i < allDetailLinks.length; i += batchSize) {
              const batch = allDetailLinks.slice(i, i + batchSize);
              setProgressState({ current: i, total: allDetailLinks.length, label: `Scraping company ${i + 1}–${Math.min(i + batchSize, allDetailLinks.length)} of ${allDetailLinks.length}...` });

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
        setProgressState({ current: 1, total: 1, label: "Extracting leads from page..." });
        allLeads = await extractFromListingPage(url);
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