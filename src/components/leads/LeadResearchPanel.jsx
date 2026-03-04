import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Globe, Mail, Phone, MapPin, Building2, Users, ExternalLink, RefreshCw, Check } from "lucide-react";

export default function LeadResearchPanel({ lead, open, onClose, onUpdateLead }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [applied, setApplied] = useState({});

  const runResearch = async () => {
    setLoading(true);
    setResult(null);
    const data = await base44.integrations.Core.InvokeLLM({
      prompt: `Research the company "${lead.company_name}" ${lead.location ? `located in ${lead.location}` : ""}.
Find accurate information about:
- Website, real email (like info@company.com), phone number
- Physical address / location
- Key contacts / decision makers (names, titles, emails if public)
- Industry and what they do
- Company size (employees)
- LinkedIn page URL
- Notes about plastic injection molding or manufacturing

IMPORTANT: Only return real complete email addresses like "info@company.com". 
Never return obfuscated or placeholder emails. If no real email found, return "".

Current data:
- Name: ${lead.first_name} ${lead.last_name}
- Job title: ${lead.job_title || "unknown"}
- Email: ${lead.email || "missing"}
- Phone: ${lead.phone || "missing"}
- Website: ${lead.website || "missing"}
- Location: ${lead.location || "missing"}
- LinkedIn: ${lead.linkedin_url || "missing"}`,
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
          confidence_notes: { type: "string" }
        }
      }
    });
    setResult(data);
    setLoading(false);
  };

  const isValidEmail = (val) =>
    val && val.includes("@") && val.includes(".") &&
    !val.toLowerCase().includes("email protected") &&
    !val.toLowerCase().includes("[email");

  const applyField = async (field, value) => {
    await onUpdateLead({ ...lead, [field]: value });
    setApplied(prev => ({ ...prev, [field]: true }));
  };

  const FieldRow = ({ label, field, value, icon: Icon }) => {
    if (field === "email" && !isValidEmail(value)) value = "";
    const current = lead[field];
    const isDifferent = value && value !== current && value !== "N/A";
    const wasApplied = applied[field];

    return (
      <div className={`flex items-start justify-between gap-3 py-2.5 border-b border-slate-100 last:border-0 ${isDifferent ? "bg-amber-50 -mx-4 px-4" : wasApplied ? "bg-emerald-50 -mx-4 px-4" : ""}`}>
        <div className="flex items-start gap-2 min-w-0 flex-1">
          {Icon && <Icon className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />}
          <div className="min-w-0">
            <span className="text-xs text-slate-400 block">{label}</span>
            <span className={`text-sm font-medium break-all ${isDifferent ? "text-amber-700" : wasApplied ? "text-emerald-700" : "text-slate-700"}`}>
              {value || <span className="text-slate-300 italic text-xs">not found</span>}
            </span>
            {isDifferent && current && (
              <span className="text-xs text-slate-400 line-through block">was: {current}</span>
            )}
          </div>
        </div>
        {isDifferent && !wasApplied && (
          <Button size="sm" variant="outline" className="shrink-0 h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
            onClick={() => applyField(field, value)}>
            Apply
          </Button>
        )}
        {wasApplied && <Check className="w-4 h-4 text-emerald-500 shrink-0" />}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Search className="w-5 h-5 text-teal-600" />
            AI Research — {lead.company_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!result && !loading && (
            <div className="flex flex-col items-center gap-3 py-8 text-slate-400">
              <Search className="w-10 h-10 opacity-30" />
              <p className="text-sm">Click below to research this company online</p>
              <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={runResearch}>
                <Search className="w-4 h-4 mr-2" /> Start Research
              </Button>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center gap-3 py-8 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
              <p className="text-sm">Searching the web...</p>
              <p className="text-xs text-slate-400">This may take a few seconds</p>
            </div>
          )}

          {result && !loading && (
            <>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={runResearch}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Re-search
                </Button>
              </div>

              {result.summary && (
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Summary</p>
                  <p className="text-sm text-slate-700">{result.summary}</p>
                </div>
              )}

              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Company Data</p>
                  <Badge className="bg-amber-100 text-amber-700 text-xs">Yellow = new data</Badge>
                </div>
                <FieldRow label="Website" field="website" value={result.website} icon={Globe} />
                <FieldRow label="Email" field="email" value={result.email} icon={Mail} />
                <FieldRow label="Phone" field="phone" value={result.phone} icon={Phone} />
                <FieldRow label="Location" field="location" value={result.location} icon={MapPin} />
                <FieldRow label="LinkedIn" field="linkedin_url" value={result.linkedin_url} icon={ExternalLink} />
                <FieldRow label="Industry" field="industry" value={result.industry} icon={Building2} />
                <FieldRow label="Company Size" field="company_size" value={result.company_size} icon={Users} />
              </div>

              {result.key_contacts?.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Key Contacts</p>
                  <div className="space-y-3">
                    {result.key_contacts.map((c, i) => (
                      <div key={i} className="bg-slate-50 rounded-lg p-3 text-sm">
                        <p className="font-semibold text-slate-800">{c.name}</p>
                        {c.title && <p className="text-slate-500 text-xs">{c.title}</p>}
                        {c.email && isValidEmail(c.email) && (
                          <a href={`mailto:${c.email}`} className="text-teal-600 text-xs flex items-center gap-1 mt-1 hover:underline">
                            <Mail className="w-3 h-3" />{c.email}
                          </a>
                        )}
                        {c.linkedin && (
                          <a href={c.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-xs flex items-center gap-1 hover:underline">
                            <ExternalLink className="w-3 h-3" />LinkedIn
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.confidence_notes && (
                <p className="text-xs text-slate-400 italic">{result.confidence_notes}</p>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}