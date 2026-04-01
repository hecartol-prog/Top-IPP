import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Loader2, Globe, Search, UserPlus, CheckCircle2, AlertCircle, BookOpen, Link, LayoutGrid, Linkedin } from "lucide-react";

const MODES = [
  { value: "deep",      icon: Link,      label: "Deep Crawl", desc: "Follow profile/detail links (up to 30 pages)" },
  { value: "simple",    icon: BookOpen,  label: "Simple",     desc: "Single page extraction only" },
  { value: "linkedin",  icon: Linkedin,  label: "LinkedIn",   desc: "Paste LinkedIn profile URLs, one per line" },
];

export default function WebScraper({ onImportComplete }) {
  const [url, setUrl]                     = useState("");
  const [linkedinUrls, setLinkedinUrls]   = useState("");
  const [mode, setMode]                   = useState("deep");
  const [scraping, setScraping]           = useState(false);
  const [importing, setImporting]         = useState(false);
  const [extractedLeads, setExtractedLeads] = useState([]);
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [message, setMessage]             = useState(null);
  const [pagesScraped, setPagesScraped]   = useState(null);
  const [linkedinProgress, setLinkedinProgress] = useState(null); // { done, total }

  const handleScrape = async (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }

    // --- LinkedIn mode: process URLs via backend function ---
    if (mode === "linkedin") {
      const lines = linkedinUrls.split("\n").map(l => l.trim()).filter(l => l.startsWith("http"));
      if (lines.length === 0) {
        setMessage({ type: "error", text: "Please enter at least one LinkedIn profile URL." });
        return;
      }
      setScraping(true);
      setExtractedLeads([]);
      setSelectedLeads([]);
      setMessage({ type: "info", text: `Searching ${lines.length} LinkedIn profile${lines.length > 1 ? "s" : ""} (may take ~30s per profile)...` });
      setLinkedinProgress({ done: 0, total: lines.length });

      const res = await base44.functions.invoke('extractLinkedInProfile', { urls: lines });
      const rawResults = res.data?.results || [];
      const results = rawResults.filter(r => !r._failed && (r.first_name || r.last_name || r.company_name));

      setLinkedinProgress({ done: lines.length, total: lines.length });
      setExtractedLeads(results);
      setSelectedLeads(results.map((_, i) => i));
      setLinkedinProgress(null);
      setScraping(false);
      const failed = rawResults.filter(r => r._failed).length;
      if (results.length === 0) {
        setMessage({ type: "error", text: "Could not find public data for the provided LinkedIn profiles. This works best for profiles that appear in Google search results. Private or unlisted profiles cannot be extracted." });
      } else if (failed > 0) {
        setMessage({ type: "success", text: `Extracted ${results.length} profile${results.length !== 1 ? "s" : ""}. ${failed} could not be found (private/unlisted).` });
      } else {
        setMessage({ type: "success", text: `Extracted ${results.length} profile${results.length !== 1 ? "s" : ""}.` });
      }
      return;
    }

    // --- Website scrape modes ---
    if (!url.trim()) return;
    setScraping(true);
    setMessage({ type: "info", text: mode === "deep" ? "Crawling site pages (may take 2-3 min for JS-heavy sites)..." : "Fetching and extracting leads (may take 1-3 min)..." });
    setExtractedLeads([]);
    setSelectedLeads([]);
    setPagesScraped(null);

    const res = await base44.functions.invoke('scrapeLeadsApify', { url: url.trim(), mode });

    if (res.data?.error) {
      setMessage({ type: "error", text: res.data.error });
      setScraping(false);
      return;
    }

    const leads = res.data?.leads || [];
    const pages = res.data?.pages_scraped || 0;
    setPagesScraped(pages);

    if (leads.length === 0) {
      setMessage({ type: "error", text: `No leads found across ${pages} page${pages !== 1 ? 's' : ''}. Try the other mode or check the URL.` });
    } else {
      setExtractedLeads(leads);
      setSelectedLeads(leads.map((_, i) => i));
      setMessage({ type: "success", text: `Found ${leads.length} lead${leads.length !== 1 ? 's' : ''} from ${pages} page${pages !== 1 ? 's' : ''}.` });
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
        last_name:  lead.last_name  || "",
        email:      lead.email      || "",
        phone:      lead.phone      || "",
        job_title:  lead.job_title  || "",
        company_name: lead.company_name || "",
        website:    lead.website    || "",
        location:   lead.location   || "",
        industry:   lead.industry   || "",
        notes:      lead.notes      || "",
        linkedin_url: lead.linkedin_url || "",
        status: "new",
        source: lead.linkedin_url ? "linkedin" : "website"
      });
      imported++;
    }

    setMessage({ type: "success", text: `Successfully imported ${imported} lead${imported !== 1 ? 's' : ''}!` });
    setExtractedLeads([]);
    setSelectedLeads([]);
    setUrl("");
    setImporting(false);
    if (onImportComplete) onImportComplete();
  };

  return (
    <div className="space-y-4">
      {/* Input area */}
      {mode === "linkedin" ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            <Linkedin className="w-3.5 h-3.5 shrink-0" />
            Paste one LinkedIn profile URL per line. AI will extract each profile and create leads.
          </div>
          <textarea
            value={linkedinUrls}
            onChange={(e) => setLinkedinUrls(e.target.value)}
            placeholder={"https://linkedin.com/in/john-smith\nhttps://linkedin.com/in/jane-doe"}
            rows={4}
            disabled={scraping}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
          />
          {linkedinProgress && (
            <p className="text-xs text-slate-500 text-center">
              Processing {linkedinProgress.done} / {linkedinProgress.total}...
            </p>
          )}
          <Button
            type="button"
            onClick={handleScrape}
            disabled={!linkedinUrls.trim() || scraping}
            className="w-full bg-blue-700 hover:bg-blue-800"
          >
            {scraping
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Fetching Profiles...</>
              : <><Linkedin className="w-4 h-4 mr-2" />Extract LinkedIn Profiles</>
            }
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !scraping) { e.preventDefault(); handleScrape(e); } }}
              placeholder="https://directory.com/companies/ or any company/contact page..."
              className="pl-10"
              disabled={scraping}
            />
          </div>
          <Button
            type="button"
            onClick={handleScrape}
            disabled={!url.trim() || scraping}
            className="bg-slate-900 hover:bg-slate-800 shrink-0"
          >
            {scraping
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Crawling...</>
              : <><Search className="w-4 h-4 mr-2" />Extract</>
            }
          </Button>
        </div>
      )}

      {/* Mode selector */}
      <div>
        <p className="text-xs text-slate-500 mb-2 font-medium">Extraction mode</p>
        <div className="grid grid-cols-2 gap-2">
          {MODES.map(({ value, icon: Icon, label, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              disabled={scraping}
              className={`relative flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-center transition-all ${
                mode === value
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
              }`}
            >
              {mode === value && (
                <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-teal-400 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-3 h-3 text-white" />
                </span>
              )}
              <Icon className="w-4 h-4" />
              <span className="text-xs font-semibold">{label}</span>
              <span className={`text-[10px] leading-tight ${mode === value ? "text-slate-300" : "text-slate-400"}`}>{desc}</span>
            </button>
          ))}
        </div>
        {mode !== "linkedin" && (
          <p className="text-[11px] text-slate-400 mt-2 text-center">
            Powered by Apify — all crawling is done server-side, then parsed with a single AI call to save credits.
          </p>
        )}
      </div>

      {/* Scraping indicator */}
      {scraping && (
        <div className="space-y-1">
          <Progress value={undefined} className="h-2 animate-pulse" />
          <p className="text-xs text-slate-500 text-center">
            {mode === "deep" ? "Crawling pages with Apify, then running AI extraction..." : "Fetching page & running AI extraction..."}
          </p>
        </div>
      )}

      {/* Message */}
      {message && (
        <Alert className={
          message.type === "success" ? "bg-emerald-50 border-emerald-200" :
          message.type === "info"    ? "bg-blue-50 border-blue-200" :
                                       "bg-red-50 border-red-200"
        }>
          {message.type === "success" && <CheckCircle2 className="w-4 h-4 inline mr-2 text-emerald-600" />}
          {message.type === "info"    && <BookOpen     className="w-4 h-4 inline mr-2 text-blue-600" />}
          {message.type === "error"   && <AlertCircle  className="w-4 h-4 inline mr-2 text-red-600" />}
          <AlertDescription className={
            message.type === "success" ? "text-emerald-800" :
            message.type === "info"    ? "text-blue-800" :
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
                <button type="button" onClick={toggleAll} className="text-sm text-slate-500 hover:text-slate-800 underline">
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
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
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
                type="button"
                onClick={handleImport}
                disabled={selectedLeads.length === 0 || importing}
                className="w-full bg-teal-600 hover:bg-teal-700"
              >
                {importing
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing...</>
                  : <><UserPlus className="w-4 h-4 mr-2" />Import {selectedLeads.length} Lead{selectedLeads.length !== 1 ? "s" : ""}</>
                }
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}