import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { Sparkles, RefreshCw, Check, X, Mail, Phone, Linkedin, Globe, User, Building2, MapPin, Briefcase, AlertCircle } from "lucide-react";

const fieldIcons = {
  email: Mail,
  phone: Phone,
  linkedin_url: Linkedin,
  website: Globe,
  first_name: User,
  last_name: User,
  job_title: Briefcase,
  company_name: Building2,
  location: MapPin,
};

const fieldLabels = {
  email: "Email",
  phone: "Phone",
  linkedin_url: "LinkedIn URL",
  website: "Website",
  first_name: "First Name",
  last_name: "Last Name",
  job_title: "Job Title",
  company_name: "Company Name",
  location: "Location",
};

export default function AIEditDialog({ open, onClose, lead, onUpdateLead }) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState(null); // { field: { suggested, current, confidence, reason } }
  const [accepted, setAccepted] = useState({});
  const [rejected, setRejected] = useState({});
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  const handleRunAI = async () => {
    setLoading(true);
    setSuggestions(null);
    setAccepted({});
    setRejected({});
    setSavedOk(false);

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a B2B data accuracy agent. Research this lead using the web and verify/correct their contact details.

Current lead data:
- Name: ${lead.first_name} ${lead.last_name}
- Job Title: ${lead.job_title || 'Unknown'}
- Company: ${lead.company_name}
- Email: ${lead.email || 'Unknown'}
- Phone: ${lead.phone || 'Unknown'}
- LinkedIn: ${lead.linkedin_url || 'Unknown'}
- Website: ${lead.website || 'Unknown'}
- Location: ${lead.location || 'Unknown'}

Search the web for this person and company. For each field below, provide:
1. The best/corrected value you found (or null if you couldn't find/verify it)
2. Confidence: "high", "medium", or "low"
3. A short reason explaining where you found it

Only suggest a value if it differs from the current one OR if the current one is missing/Unknown.
Be conservative — only include fields you actually found evidence for.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          email: {
            type: "object",
            properties: {
              suggested: { type: "string" },
              confidence: { type: "string" },
              reason: { type: "string" }
            }
          },
          phone: {
            type: "object",
            properties: {
              suggested: { type: "string" },
              confidence: { type: "string" },
              reason: { type: "string" }
            }
          },
          linkedin_url: {
            type: "object",
            properties: {
              suggested: { type: "string" },
              confidence: { type: "string" },
              reason: { type: "string" }
            }
          },
          website: {
            type: "object",
            properties: {
              suggested: { type: "string" },
              confidence: { type: "string" },
              reason: { type: "string" }
            }
          },
          job_title: {
            type: "object",
            properties: {
              suggested: { type: "string" },
              confidence: { type: "string" },
              reason: { type: "string" }
            }
          },
          location: {
            type: "object",
            properties: {
              suggested: { type: "string" },
              confidence: { type: "string" },
              reason: { type: "string" }
            }
          },
          first_name: {
            type: "object",
            properties: {
              suggested: { type: "string" },
              confidence: { type: "string" },
              reason: { type: "string" }
            }
          },
          last_name: {
            type: "object",
            properties: {
              suggested: { type: "string" },
              confidence: { type: "string" },
              reason: { type: "string" }
            }
          },
        }
      }
    });

    // Filter to only meaningful suggestions
    const cleaned = {};
    Object.entries(result).forEach(([key, val]) => {
      if (val?.suggested && val.suggested !== lead[key] && val.suggested !== 'Unknown' && val.suggested !== 'null') {
        cleaned[key] = { ...val, current: lead[key] };
      }
    });

    setSuggestions(cleaned);
    setLoading(false);
  };

  const toggleAccept = (key) => {
    setAccepted(prev => ({ ...prev, [key]: !prev[key] }));
    setRejected(prev => ({ ...prev, [key]: false }));
  };

  const toggleReject = (key) => {
    setRejected(prev => ({ ...prev, [key]: !prev[key] }));
    setAccepted(prev => ({ ...prev, [key]: false }));
  };

  const acceptedCount = Object.values(accepted).filter(Boolean).length;

  const handleApply = async () => {
    const updates = {};
    Object.entries(accepted).forEach(([key, isAccepted]) => {
      if (isAccepted && suggestions[key]) {
        updates[key] = suggestions[key].suggested;
      }
    });
    if (Object.keys(updates).length === 0) return;
    setSaving(true);
    await onUpdateLead({ ...lead, ...updates });
    setSaving(false);
    setSavedOk(true);
    setSuggestions(null);
    setAccepted({});
  };

  const confidenceBadge = (confidence) => {
    if (confidence === 'high') return <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">High confidence</Badge>;
    if (confidence === 'medium') return <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">Medium confidence</Badge>;
    return <Badge className="bg-slate-100 text-slate-600 border-0 text-xs">Low confidence</Badge>;
  };

  const suggestionKeys = suggestions ? Object.keys(suggestions) : [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-white max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <Sparkles className="w-5 h-5 text-violet-500" />
            AI Edit — Contact Verification
          </DialogTitle>
          <p className="text-sm text-slate-500 mt-1">
            AI searches the web to verify and correct contact details for <strong>{lead?.first_name} {lead?.last_name}</strong> at <strong>{lead?.company_name}</strong>.
          </p>
        </DialogHeader>

        {!suggestions && !loading && !savedOk && (
          <Button onClick={handleRunAI} className="w-full bg-violet-600 hover:bg-violet-700 mt-2">
            <Sparkles className="w-4 h-4 mr-2" />
            Verify & Suggest Corrections
          </Button>
        )}

        {loading && (
          <div className="py-6 text-center space-y-4">
            <RefreshCw className="w-8 h-8 mx-auto text-violet-500 animate-spin" />
            <p className="text-sm text-slate-500">Searching the web for accurate contact information...</p>
            <div className="space-y-2 animate-pulse text-left">
              <div className="h-3 bg-slate-100 rounded w-3/4" />
              <div className="h-3 bg-slate-100 rounded w-full" />
              <div className="h-3 bg-slate-100 rounded w-5/6" />
            </div>
          </div>
        )}

        {savedOk && (
          <div className="py-6 text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-6 h-6 text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-slate-800">Lead updated successfully!</p>
            <Button variant="outline" size="sm" onClick={() => { setSavedOk(false); setSuggestions(null); }}>
              Run Again
            </Button>
          </div>
        )}

        {suggestions && !loading && !savedOk && (
          <div className="space-y-4 mt-2">
            {suggestionKeys.length === 0 ? (
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg text-sm text-slate-600">
                <AlertCircle className="w-5 h-5 text-slate-400 flex-shrink-0" />
                No corrections found — current data appears accurate or could not be verified online.
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-500">{suggestionKeys.length} suggestion(s) found. Accept the ones you want to apply.</p>

                <div className="space-y-3">
                  {suggestionKeys.map(key => {
                    const s = suggestions[key];
                    const Icon = fieldIcons[key] || User;
                    const isAccepted = accepted[key];
                    const isRejected = rejected[key];

                    return (
                      <div
                        key={key}
                        className={`rounded-xl border p-3 transition-colors ${
                          isAccepted ? 'border-emerald-300 bg-emerald-50' :
                          isRejected ? 'border-slate-200 bg-slate-50 opacity-50' :
                          'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <Icon className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{fieldLabels[key]}</p>
                              {s.current && (
                                <p className="text-xs text-slate-400 line-through mb-0.5 truncate">{s.current}</p>
                              )}
                              <p className="text-sm font-medium text-slate-900 break-all">{s.suggested}</p>
                              <p className="text-xs text-slate-400 mt-1">{s.reason}</p>
                              <div className="mt-1.5">{confidenceBadge(s.confidence)}</div>
                            </div>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button
                              onClick={() => toggleAccept(key)}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                                isAccepted ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-emerald-100 hover:text-emerald-600'
                              }`}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => toggleReject(key)}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                                isRejected ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-600'
                              }`}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={handleApply}
                    disabled={acceptedCount === 0 || saving}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  >
                    {saving ? (
                      <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                    ) : (
                      <><Check className="w-4 h-4 mr-2" /> Apply {acceptedCount > 0 ? `${acceptedCount} Change${acceptedCount > 1 ? 's' : ''}` : 'Selected'}</>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => { setSuggestions(null); setAccepted({}); setRejected({}); }}>
                    Reset
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}