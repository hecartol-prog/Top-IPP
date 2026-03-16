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

const MODES = [
  { value: "logo_grid", icon: LayoutGrid, label: "Logo Grid", desc: "Cards/icons with 'Ver más' links" },
  { value: "deep", icon: Link, label: "Deep Crawl", desc: "Auto-detect & follow profile links" },
  { value: "simple", icon: BookOpen, label: "Simple", desc: "Extract from table/list on one page" },
];

export default function WebScraper({ onImportComplete }) {
  const [url, setUrl] = useState("");
  const [selectedModes, setSelectedModes] = useState(["deep"]); // multi-select
  const [scraping, setScraping] = useState(false);
  const [importing, setImporting] = useState(false);
  const [extractedLeads, setExtractedLeads] = useState([]);
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [message, setMessage] = useState(null);
  const [progressState, setProgressState] = useState(null);
  const [currentModeLabel, setCurrentModeLabel] = useState("");

  const toggleMode = (value) => {
    setSelectedModes(prev =>
      prev.includes(value)
        ? prev.length === 1 ? prev : prev.filter(m => m !== value) // at least one selected
        : [...prev, value]
    );
  };

  // ─── Extraction helpers ───────────────────────────────────────────────────

  const analyzeStartPage = async (startUrl) => {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Fetch this URL: ${startUrl}

Analyze the page and return:
1. is_detail_page: true if this is a single company/person profile page (not a listing)
2. detail_links: list of absolute URLs linking to individual company/profile pages visible on THIS page only
3. all_pagination_urls: list of ALL pagination page URLs found (page 2, page 3, etc.)
4. has_pagination: true if there are multiple pages

Only include profile/company page URLs in detail_links, not category or filter links.`,
      add_context_from_internet: true,
      model: "gemini_3_flash",
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

  const getDetailLinksFromPage = async (pageUrl) => {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Fetch this listing page: ${pageUrl}

Return ALL URLs that link to individual company or person profile/detail pages on this page.
Do NOT include category, filter, navigation, or pagination links — only profile/detail page URLs.`,
      add_context_from_internet: true,
      model: "gemini_3_flash",
      response_json_schema: {
        type: "object",
        properties: {
          detail_links: { type: "array", items: { type: "string" } }
        }
      }
    });
    return result?.detail_links || [];
  };

  const extractFromDetailPage = async (pageUrl) => {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Fetch this company/contact detail page: ${pageUrl}

Extract all contact and company information: company name, contact person (first/last name), email, phone, website, address/location, industry/products.`,
      add_context_from_internet: true,
      model: "gemini_3_flash",
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

  const extractFromTablePage = async (pageUrl, onProgress) => {
    const countResult = await base44.integrations.Core.InvokeLLM({
      prompt: `Visit this URL: ${pageUrl}
Count the TOTAL number of company/contact rows in the table or list on this page (do NOT count the header row). Return only the integer count.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: { total_entries: { type: "number" } }
      }
    });

    const total = countResult?.total_entries || 50;
    const batchSize = 5;
    const batches = Math.ceil(total / batchSize);
    let allLeads = [];

    for (let i = 0; i < batches; i++) {
      const start = i * batchSize + 1;
      const end = Math.min((i + 1) * batchSize, total);
      if (onProgress) onProgress(i, batches, start, end);

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Visit this URL: ${pageUrl}

Extract rows ${start} to ${end} from the company/contact list on this page (skip the header row).
For each entry return: company_name, first_name, last_name, email, phone, website, industry.
Only return those ${end - start + 1} entries, nothing else.`,
        add_context_from_internet: true,
        model: "gemini_3_flash",
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
                  company_name: { type: "string" },
                  website: { type: "string" },
                  industry: { type: "string" }
                }
              }
            }
          }
        }
      }).catch(() => ({ leads: [] }));

      allLeads = [...allLeads, ...(result?.leads || [])];
    }

    return allLeads;
  };

  const extractLogoGridLinks = async (startUrl) => {
    setProgressState({ current: 0, total: 1, label: "Fetching directory links..." });
    const result = await base44.functions.invoke('fetchPageLinks', { url: startUrl });
    return result?.data?.links || [];
  };

  const isFlippingBookUrl = (u) =>
    u.includes("flippingbook") || u.includes("page-html5-substrates") || u.includes("Directorio-de-Empresas");

  // ─── Mode runners ─────────────────────────────────────────────────────────

  const runLogoGrid = async (startUrl, existingLeads) => {
    setCurrentModeLabel("Logo Grid");
    setProgressState({ current: 0, total: 1, label: "Scanning logo grid for company links..." });
    setMessage({ type: "info", text: "Logo Grid: collecting company page links..." });

    let links = await extractLogoGridLinks(startUrl);
    links = [...new Set(links)].filter(l => l && l.startsWith("http"));

    if (links.length === 0) {
      setMessage({ type: "error", text: "Logo Grid: No company links found in the grid." });
      return existingLeads;
    }

    // Filter out links we already have companies for
    const existingWebsites = new Set(existingLeads.map(l => l.website).filter(Boolean));
    const newLinks = links.filter(l => !existingWebsites.has(l));

    setProgressState({ current: 0, total: newLinks.length, label: `Found ${newLinks.length} new companies. Extracting...` });
    setMessage({ type: "info", text: `Logo Grid: Found ${newLinks.length} new company cards...` });

    let modeLeads = [...existingLeads];
    const batchSize = 5;
    for (let i = 0; i < newLinks.length; i += batchSize) {
      const batch = newLinks.slice(i, i + batchSize);
      setProgressState({ current: i, total: newLinks.length, label: `Logo Grid: scraping ${i + 1}–${Math.min(i + batchSize, newLinks.length)} of ${newLinks.length}...` });

      const batchResults = await Promise.all(
        batch.map(detailUrl => extractFromDetailPage(detailUrl).catch(() => null))
      );

      for (const lead of batchResults) {
        if (lead && (lead.company_name || lead.first_name)) modeLeads.push(lead);
      }

      setMessage({ type: "info", text: `Logo Grid: ${modeLeads.length} total leads so far...` });
    }

    return modeLeads;
  };

  const runDeepCrawl = async (startUrl, existingLeads) => {
    setCurrentModeLabel("Deep Crawl");
    setProgressState({ current: 0, total: 1, label: "Deep Crawl: analyzing page structure..." });

    const analysis = await analyzeStartPage(startUrl);
    let modeLeads = [...existingLeads];

    if (analysis.is_detail_page) {
      setProgressState({ current: 1, total: 1, label: "Deep Crawl: extracting detail page..." });
      const lead = await extractFromDetailPage(startUrl);
      if (lead?.company_name || lead?.first_name) modeLeads.push(lead);
      return modeLeads;
    }

    let allDetailLinks = [...(analysis.detail_links || [])];
    const paginationUrls = (analysis.all_pagination_urls || []).filter(l => l && l.startsWith("http") && l !== startUrl);

    if (paginationUrls.length > 0) {
      setProgressState({ current: 0, total: paginationUrls.length, label: `Deep Crawl: collecting links from ${paginationUrls.length} more pages...` });
      const pagResults = await Promise.all(
        paginationUrls.map(pgUrl => getDetailLinksFromPage(pgUrl).catch(() => []))
      );
      for (const links of pagResults) allDetailLinks = [...allDetailLinks, ...links];
    }

    allDetailLinks = [...new Set(allDetailLinks)].filter(l => l && l.startsWith("http"));

    // Skip links we already have
    const existingWebsites = new Set(existingLeads.map(l => l.website).filter(Boolean));
    const newLinks = allDetailLinks.filter(l => !existingWebsites.has(l));

    if (newLinks.length === 0 && allDetailLinks.length === 0) {
      setProgressState({ current: 1, total: 1, label: "Deep Crawl: counting entries..." });
      const allPageUrls = [startUrl, ...paginationUrls];
      for (const pageUrl of allPageUrls) {
        const pageLeads = await extractFromTablePage(pageUrl, (i, total, start, end) => {
          setProgressState({ current: i, total, label: `Deep Crawl: rows ${start}–${end}...` });
        });
        modeLeads = [...modeLeads, ...pageLeads];
        setMessage({ type: "info", text: `Deep Crawl: ${modeLeads.length} leads so far...` });
      }
    } else {
      setProgressState({ current: 0, total: newLinks.length, label: `Deep Crawl: found ${newLinks.length} new pages...` });

      const batchSize = 5;
      for (let i = 0; i < newLinks.length; i += batchSize) {
        const batch = newLinks.slice(i, i + batchSize);
        setProgressState({ current: i, total: newLinks.length, label: `Deep Crawl: scraping ${i + 1}–${Math.min(i + batchSize, newLinks.length)} of ${newLinks.length}...` });

        const batchResults = await Promise.all(
          batch.map(detailUrl => extractFromDetailPage(detailUrl).catch(() => null))
        );

        for (const lead of batchResults) {
          if (lead && (lead.company_name || lead.first_name)) modeLeads.push(lead);
        }

        setMessage({ type: "info", text: `Deep Crawl: ${modeLeads.length} total leads so far...` });
      }
    }

    return modeLeads;
  };

  const runSimple = async (startUrl, existingLeads) => {
    setCurrentModeLabel("Simple");
    setProgressState({ current: 1, total: 1, label: "Simple: counting entries..." });

    let modeLeads = [...existingLeads];
    const pageLeads = await extractFromTablePage(startUrl, (i, total, start, end) => {
      setProgressState({ current: i, total, label: `Simple: extracting rows ${start}–${end}...` });
      setMessage({ type: "info", text: `Simple: ${modeLeads.length} leads so far...` });
    });
    modeLeads = [...modeLeads, ...pageLeads];
    return modeLeads;
  };

  // ─── Main handler ─────────────────────────────────────────────────────────

  const handleScrape = async () => {
    if (!url.trim()) return;
    setScraping(true);
    setMessage(null);
    setExtractedLeads([]);
    setSelectedLeads([]);
    setProgressState(null);
    setCurrentModeLabel("");

    let allLeads = [];

    try {
      // FlippingBook special case (always runs regardless of mode)
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

          for (const r of batchResults) allLeads = [...allLeads, ...(r?.leads || [])];
          setMessage({ type: "info", text: `Scanning pages... Found ${allLeads.length} companies so far.` });
        }

      } else {
        // Run each selected mode sequentially — each passes its accumulated leads to the next
        const orderedModes = MODES.map(m => m.value).filter(v => selectedModes.includes(v));

        for (let mi = 0; mi < orderedModes.length; mi++) {
          const mode = orderedModes[mi];
          const modeLabel = MODES.find(m => m.value === mode)?.label;
          setMessage({ type: "info", text: `Running mode ${mi + 1}/${orderedModes.length}: ${modeLabel}...` });

          if (mode === "logo_grid") {
            allLeads = await runLogoGrid(url, allLeads);
          } else if (mode === "deep") {
            allLeads = await runDeepCrawl(url, allLeads);
          } else if (mode === "simple") {
            allLeads = await runSimple(url, allLeads);
          }

          setMessage({ type: "info", text: `${modeLabel} done. ${allLeads.length} leads collected. ${mi < orderedModes.length - 1 ? `Starting next mode...` : ""}` });
        }
      }

    } catch (err) {
      setMessage({ type: "error", text: `Error: ${err.message}` });
      setScraping(false);
      setProgressState(null);
      return;
    }

    setProgressState(null);
    setCurrentModeLabel("");

    // Deduplicate across all modes
    const seen = new Set();
    const unique = allLeads.filter(l => {
      const key = ((l.company_name || l.first_name || "") + (l.email || "")).toLowerCase().trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (unique.length === 0) {
      setMessage({ type: "error", text: "No leads found. Try a different mode or check the URL." });
    } else {
      setExtractedLeads(unique);
      setSelectedLeads(unique.map((_, i) => i));
      setMessage({ type: "success", text: `Found ${unique.length} lead${unique.length !== 1 ? "s" : ""} across ${selectedModes.length} mode${selectedModes.length > 1 ? "s" : ""}.` });
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
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{currentModeLabel || "Scanning"}...</>
          ) : (
            <><Search className="w-4 h-4 mr-2" />Extract</>
          )}
        </Button>
      </div>

      {/* Multi-select Mode selector */}
      <div>
        <p className="text-xs text-slate-500 mb-2 font-medium">Extraction modes <span className="text-slate-400 font-normal">(select one or more — run in sequence, results are combined)</span></p>
        <div className="grid grid-cols-3 gap-2">
          {MODES.map(({ value, icon: Icon, label, desc }) => {
            const isSelected = selectedModes.includes(value);
            return (
              <button
                key={value}
                onClick={() => toggleMode(value)}
                disabled={scraping}
                className={`relative flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-center transition-all ${
                  isSelected
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                }`}
              >
                {isSelected && (
                  <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-teal-400 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-3 h-3 text-white" />
                  </span>
                )}
                <Icon className="w-4 h-4" />
                <span className="text-xs font-semibold">{label}</span>
                <span className={`text-[10px] leading-tight ${isSelected ? "text-slate-300" : "text-slate-400"}`}>{desc}</span>
              </button>
            );
          })}
        </div>
        {selectedModes.length > 1 && (
          <p className="text-[11px] text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-3 py-1.5 mt-2">
            ✓ {selectedModes.length} modes selected — each will run in sequence and add new results without overwriting previous ones.
          </p>
        )}
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
        Select multiple modes to combine results · Logo Grid: card/icon directories · Deep Crawl: follows profile links · Simple: table/list pages · Also supports FlippingBooks
      </p>
    </div>
  );
}