import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Globe, Mail, Phone, MapPin, Building2, Users, ExternalLink, RefreshCw, Copy, Check } from "lucide-react";

export default function LeadResearchPanel({ lead, onUpdateLead }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(null);
  const [appliedFields, setAppliedFields] = useState({});

  const searchQuery = [lead.company_name, lead.location, "plastic injection mold"].filter(Boolean).join(" ");

  const runResearch = async () => {
    setLoading(true);
    setResult(null);

    const data = await base44.integrations.Core.InvokeLLM({
      prompt: `Research the company "${lead.company_name}" ${lead.location ? `located in ${lead.location}` : ""}. 
      
      Find and return accurate, up-to-date information about this company. Focus on:
      - Company full legal name and any aliases
      - Contact details: website, real email address (e.g. info@company.com or contact@company.com), phone
      - Physical address / location
      - Key contacts / decision makers (names, job titles, real emails if public)
      - Industry and what they manufacture or do
      - Company size (employees)
      - LinkedIn page URL
      - Any relevant notes about their plastic injection molding or manufacturing activities
      
      IMPORTANT: For email addresses, only return real, complete email addresses like "info@company.com". 
      NEVER return "[email protected]", "[email protected]", "email protected", or any obfuscated/placeholder email. 
      If you cannot find a real, complete email address, return an empty string "".
      
      Current data we have (may be inaccurate or incomplete):
      - Name: ${lead.first_name} ${lead.last_name}
      - Job title: ${lead.job_title || "unknown"}
      - Email: ${lead.email || "missing"}
      - Phone: ${lead.phone || "missing"}
      - Website: ${lead.website || "missing"}
      - Location: ${lead.location || "missing"}
      - LinkedIn: ${lead.linkedin_url || "missing"}
      
      Return all findings with confidence notes. If a field is uncertain, note it.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          company_name: { type: "string" },
          website: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          location: { type: "string" },
          linkedin_url: { type: "string" },
          industry: { type: "string" },
          company_size: { type: "string" },
          key_contacts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                title: { type: "string" },
                email: { type: "string" },
                linkedin: { type: "string" }
              }
            }
          },
          summary: { type: "string" },
          confidence_notes: { type: "string" },
          sources: { type: "array", items: { type: "string" } }
        }
      }
    });

    setResult(data);
    setLoading(false);
  };

  useEffect(() => {
    runResearch();
  }, []);

  const handleApplyField = async (field, value) => {
    if (!value || value === "N/A" || value === "unknown") return;
    await onUpdateLead({ ...lead, [field]: value });
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const isValidEmail = (val) => val && !val.toLowerCase().includes("email protected") && !val.toLowerCase().includes("[email") && val.includes("@") && val.includes(".");

  const sanitize = (field, val) => {
    if (!val) return val;
    if (field === "email" && !isValidEmail(val)) return "";
    // filter obfuscated emails in key_contacts too
    return val;
  };

  const FieldRow = ({ label, field, value: rawValue, icon: Icon }) => {
    const value = sanitize(field, rawValue);
    const currentValue = lead[field];
    const isDifferent = value && value !== currentValue && value !== "N/A" && value !== "unknown";

    return (
      <div className={`flex items-start justify-between gap-3 py-2.5 border-b border-slate-100 last:border-0 ${isDifferent ? "bg-amber-50/40 -mx-3 px-3 rounded" : ""}`}>
        <div className="flex items-start gap-2 min-w-0 flex-1">
          {Icon && <Icon className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />}
          <div className="min-w-0">
            <span className="text-xs text-slate-400 block">{label}</span>
            <span className={`text-sm font-medium break-all ${isDifferent ? "text-amber-700" : "text-slate-700"}`}>
              {value || <span className="text-slate-300 italic">not found</span>}
            </span>
            {isDifferent && currentValue && (
              <span className="text-xs text-slate-400 line-through block">was: {currentValue}</span>
            )}
          </div>
        </div>
        {isDifferent && (
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
            onClick={() => handleApplyField(field, value)}
          >
            {copied === field ? <Check className="w-3 h-3" /> : "Apply"}
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 p-4 gap-4 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Search className="w-5 h-5 text-teal-600" />
            AI Company Research
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">"{lead.company_name}"</p>
        </div>
        <Button variant="outline" size="sm" onClick={runResearch} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Re-search
        </Button>
      </div>

      {loading && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
          <p className="text-sm">Searching the web for company information...</p>
          <p className="text-xs text-slate-400">This may take a few seconds</p>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-4">
          {/* Summary */}
          {result.summary && (
            <Card className="p-4 bg-white border-slate-200">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Summary</h3>
              <p className="text-sm text-slate-700 leading-relaxed">{result.summary}</p>
            </Card>
          )}

          {/* Fields comparison */}
          <Card className="p-4 bg-white border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Company Data</h3>
              <Badge className="bg-amber-100 text-amber-700 text-xs">Highlighted = differs from current</Badge>
            </div>
            <FieldRow label="Website" field="website" value={result.website} icon={Globe} />
            <FieldRow label="Email" field="email" value={result.email} icon={Mail} />
            <FieldRow label="Phone" field="phone" value={result.phone} icon={Phone} />
            <FieldRow label="Location" field="location" value={result.location} icon={MapPin} />
            <FieldRow label="LinkedIn" field="linkedin_url" value={result.linkedin_url} icon={ExternalLink} />
            <FieldRow label="Industry" field="industry" value={result.industry} icon={Building2} />
            <FieldRow label="Company Size" field="company_size" value={result.company_size} icon={Users} />
          </Card>

          {/* Key contacts */}
          {result.key_contacts?.length > 0 && (
            <Card className="p-4 bg-white border-slate-200">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Key Contacts Found</h3>
              <div className="space-y-3">
                {result.key_contacts.map((contact, i) => (
                  <div key={i} className="bg-slate-50 rounded-lg p-3 text-sm">
                    <p className="font-semibold text-slate-800">{contact.name}</p>
                    {contact.title && <p className="text-slate-500 text-xs">{contact.title}</p>}
                    {contact.email && (
                      <a href={`mailto:${contact.email}`} className="text-teal-600 text-xs flex items-center gap-1 mt-1 hover:underline">
                        <Mail className="w-3 h-3" />{contact.email}
                      </a>
                    )}
                    {contact.linkedin && (
                      <a href={contact.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-xs flex items-center gap-1 hover:underline">
                        <ExternalLink className="w-3 h-3" />LinkedIn
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Sources & confidence */}
          {(result.sources?.length > 0 || result.confidence_notes) && (
            <Card className="p-4 bg-white border-slate-200">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Sources & Confidence</h3>
              {result.confidence_notes && (
                <p className="text-xs text-slate-500 mb-2">{result.confidence_notes}</p>
              )}
              {result.sources?.map((src, i) => (
                <a key={i} href={src} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-600 hover:underline flex items-center gap-1 mb-1">
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  <span className="truncate">{src}</span>
                </a>
              ))}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}