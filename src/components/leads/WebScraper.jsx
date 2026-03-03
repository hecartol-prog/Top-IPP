import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Loader2, Globe, Search, UserPlus, CheckCircle2, AlertCircle, BookOpen } from "lucide-react";

// Detect FlippingBook URLs and extract page image URLs
function detectFlippingBook(url, htmlContent) {
  // Match pattern like: page0001_2.jpg, page0002_2.jpg, etc.
  const matches = htmlContent.match(/page-html5-substrates\/(page\d+_\d+\.jpg[^"']*)/g) || [];
  if (matches.length === 0) return null;

  // Get base URL
  const baseUrl = url.endsWith("/") ? url : url + "/";
  const imageUrls = [...new Set(matches)].map(m => {
    const fileName = m.replace("page-html5-substrates/", "");
    return `${baseUrl}files/assets/common/page-html5-substrates/${fileName}`;
  });

  // Get total pages from "pages:/N" pattern
  const pagesMatch = htmlContent.match(/pages:\/(\d+)/);
  const totalPages = pagesMatch ? parseInt(pagesMatch[1]) : imageUrls.length;

  return { imageUrls, totalPages };
}

// Generate all page image URLs for a FlippingBook
function generateAllFlippingBookImageUrls(url, totalPages) {
  const baseUrl = url.endsWith("/") ? url : url + "/";
  const urls = [];
  // Use the unique hash from the URL if present
  const hashMatch = url.match(/uni=([a-f0-9]+)/);
  const hash = hashMatch ? hashMatch[1] : null;

  for (let i = 1; i <= totalPages; i++) {
    const pageNum = String(i).padStart(4, "0");
    let imgUrl = `${baseUrl}files/assets/common/page-html5-substrates/page${pageNum}_2.jpg`;
    if (hash) imgUrl += `?uni=${hash}`;
    urls.push(imgUrl);
  }
  return urls;
}

export default function WebScraper({ onImportComplete }) {
  const [url, setUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [importing, setImporting] = useState(false);
  const [extractedLeads, setExtractedLeads] = useState([]);
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [message, setMessage] = useState(null);
  const [progress, setProgress] = useState(null); // { current, total, label }

  const handleScrape = async () => {
    if (!url.trim()) return;

    setScraping(true);
    setMessage(null);
    setExtractedLeads([]);
    setSelectedLeads([]);
    setProgress(null);

    // Step 1: Fetch the page HTML to detect type
    setProgress({ current: 0, total: 1, label: "Analyzing page..." });

    const fetchResult = await base44.integrations.Core.InvokeLLM({
      prompt: `Fetch this URL and return the raw HTML/content: ${url}. Also tell me: is this a FlippingBook? Does it have "pages:/N" pattern? List any page image URLs you see following the pattern page0001_2.jpg, page0002_2.jpg etc. Return all info.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          is_flippingbook: { type: "boolean" },
          total_pages: { type: "number" },
          base_url: { type: "string" },
          hash_param: { type: "string" },
          raw_html_snippet: { type: "string" },
          page_image_urls: { type: "array", items: { type: "string" } }
        }
      }
    });

    const isFlippingBook = fetchResult?.is_flippingbook || false;
    let allLeads = [];

    if (isFlippingBook || (fetchResult?.total_pages && fetchResult.total_pages > 1)) {
      // FlippingBook: scrape page by page using vision
      const totalPages = fetchResult?.total_pages || 10;
      const baseUrl = (fetchResult?.base_url || url).replace(/\/$/, "") + "/";
      const hashParam = fetchResult?.hash_param || "";

      // Generate image URLs for all pages
      const pageUrls = [];
      for (let i = 1; i <= totalPages; i++) {
        const pageNum = String(i).padStart(4, "0");
        let imgUrl = `${baseUrl}files/assets/common/page-html5-substrates/page${pageNum}_2.jpg`;
        if (hashParam) imgUrl += `?uni=${hashParam}`;
        pageUrls.push(imgUrl);
      }

      setMessage({ type: "info", text: `FlippingBook detected with ${totalPages} pages. Scanning each page for company/contact data...` });

      // Process pages in batches of 3
      const batchSize = 3;
      for (let i = 0; i < pageUrls.length; i += batchSize) {
        const batch = pageUrls.slice(i, i + batchSize);
        setProgress({ current: i + 1, total: pageUrls.length, label: `Scanning pages ${i + 1}–${Math.min(i + batchSize, pageUrls.length)} of ${pageUrls.length}...` });

        const batchResults = await Promise.all(batch.map(imgUrl =>
          base44.integrations.Core.InvokeLLM({
            prompt: `Look at this page image from a business directory. Extract ALL companies and contacts visible. For each company/contact, get: company name, website, phone, email, contact person name and title, location, industry. Return empty leads array if the page has no company listings (e.g. cover, index, ads).`,
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

        for (const result of batchResults) {
          const leads = result?.leads || [];
          allLeads = [...allLeads, ...leads];
        }

        // Update running count
        setMessage({ type: "info", text: `Scanning pages... Found ${allLeads.length} companies so far.` });
      }

    } else {
      // Regular webpage: use AI with internet access
      setProgress({ current: 1, total: 1, label: "Extracting leads from page..." });

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Visit this website and extract ALL people/contacts/leads you find: ${url}
        
This could be a team page, directory, staff listing, contact page, or any page with people's information.

For each person found, extract: first_name, last_name, email, phone, job_title, company_name, linkedin_url, location, notes.

Return ALL people you find.`,
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
                  location: { type: "string" },
                  notes: { type: "string" }
                }
              }
            }
          }
        }
      });

      allLeads = result?.leads || [];
    }

    setProgress(null);

    if (allLeads.length === 0) {
      setMessage({ type: "error", text: "No leads found. Try a team page, directory, or contact page." });
    } else {
      // Deduplicate by company name
      const seen = new Set();
      const unique = allLeads.filter(l => {
        const key = (l.company_name || l.first_name || "").toLowerCase().trim();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setExtractedLeads(unique);
      setSelectedLeads(unique.map((_, i) => i));
      setMessage({ type: "success", text: `Found ${unique.length} lead${unique.length !== 1 ? "s" : ""} extracted from the page.` });
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
        linkedin_url: lead.linkedin_url || "",
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

  const progressPct = progress ? Math.round((progress.current / progress.total) * 100) : 0;

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
            placeholder="https://company.com/team or FlippingBook/PDF directory URL..."
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
            <><Search className="w-4 h-4 mr-2" />Extract Leads</>
          )}
        </Button>
      </div>

      {/* Progress */}
      {progress && (
        <div className="space-y-2">
          <Progress value={progressPct} className="h-2" />
          <p className="text-xs text-slate-500 text-center">{progress.label}</p>
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
                      {[lead.job_title, lead.first_name && lead.last_name ? `${lead.first_name} ${lead.last_name}` : null].filter(Boolean).join(" · ") || lead.industry || "No details"}
                    </p>
                  </div>
                  <div className="text-right shrink-0 hidden sm:block">
                    {(lead.phone || lead.email) && (
                      <p className="text-xs text-slate-500 truncate max-w-[160px]">{lead.phone || lead.email}</p>
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
        Supports websites, team directories, FlippingBooks, and image-based catalogs
      </p>
    </div>
  );
}