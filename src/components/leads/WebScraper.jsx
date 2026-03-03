import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Globe, Search, UserPlus, CheckCircle2, AlertCircle } from "lucide-react";

export default function WebScraper({ onImportComplete }) {
  const [url, setUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [importing, setImporting] = useState(false);
  const [extractedLeads, setExtractedLeads] = useState([]);
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [message, setMessage] = useState(null);

  const handleScrape = async () => {
    if (!url.trim()) return;

    setScraping(true);
    setMessage(null);
    setExtractedLeads([]);
    setSelectedLeads([]);

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Visit this website: ${url}
      
Extract ALL people/contacts/leads you find on the page. This could be a team page, directory, staff listing, LinkedIn profile, contact page, or any page with people's information.

For each person found, extract as much of the following as available:
- first_name
- last_name  
- email
- phone
- job_title
- company_name
- linkedin_url
- location
- notes (any extra info)

Return ONLY the people you actually find on the page. If it's a directory with many people, extract all of them.`,
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
          },
          page_description: { type: "string" }
        }
      }
    });

    const leads = result?.leads || [];

    if (leads.length === 0) {
      setMessage({ type: "error", text: "No leads found on this page. Try a team page, directory, or contact page." });
    } else {
      setExtractedLeads(leads);
      setSelectedLeads(leads.map((_, i) => i));
      setMessage({ type: "success", text: `Found ${leads.length} lead${leads.length > 1 ? "s" : ""} on the page.${result?.page_description ? " " + result.page_description : ""}` });
    }

    setScraping(false);
  };

  const toggleLead = (index) => {
    setSelectedLeads(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const toggleAll = () => {
    if (selectedLeads.length === extractedLeads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(extractedLeads.map((_, i) => i));
    }
  };

  const handleImport = async () => {
    if (selectedLeads.length === 0) return;
    setImporting(true);

    let imported = 0;
    for (const index of selectedLeads) {
      const lead = extractedLeads[index];
      await base44.entities.Lead.create({
        first_name: lead.first_name || "Unknown",
        last_name: lead.last_name || "",
        email: lead.email || "",
        phone: lead.phone || "",
        job_title: lead.job_title || "",
        company_name: lead.company_name || "",
        linkedin_url: lead.linkedin_url || "",
        location: lead.location || "",
        notes: lead.notes || "",
        status: "new",
        source: "website"
      });
      imported++;
    }

    setMessage({ type: "success", text: `Successfully imported ${imported} leads!` });
    setExtractedLeads([]);
    setSelectedLeads([]);
    setUrl("");
    setImporting(false);

    if (onImportComplete) onImportComplete();
  };

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
            placeholder="https://company.com/team or any directory page..."
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

      {/* Message */}
      {message && (
        <Alert className={message.type === "success" ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}>
          {message.type === "success"
            ? <CheckCircle2 className="w-4 h-4 inline mr-2 text-emerald-600" />
            : <AlertCircle className="w-4 h-4 inline mr-2 text-red-600" />}
          <AlertDescription className={message.type === "success" ? "text-emerald-800" : "text-red-800"}>
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
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
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
                    {(lead.first_name?.[0] || "?").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 text-sm truncate">
                      {[lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown"}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {[lead.job_title, lead.company_name].filter(Boolean).join(" @ ") || "No title"}
                    </p>
                  </div>
                  <div className="text-right shrink-0 hidden sm:block">
                    {lead.email && <p className="text-xs text-slate-500 truncate max-w-[160px]">{lead.email}</p>}
                    {lead.location && <p className="text-xs text-slate-400 truncate max-w-[160px]">{lead.location}</p>}
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
    </div>
  );
}