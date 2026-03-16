import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { Sparkles, RefreshCw, Check, X, Mail, Phone, Linkedin, Globe, User, Building2, MapPin, Briefcase, AlertCircle, UserSearch } from "lucide-react";

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
  const [loadingStage, setLoadingStage] = useState(null); // "verify" | "google"
  const [suggestions, setSuggestions] = useState(null);
  const [accepted, setAccepted] = useState({});
  const [rejected, setRejected] = useState({});
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);
  const [contactResult, setContactResult] = useState(null);
  const [contactSaving, setContactSaving] = useState(false);
  const [contactSavedOk, setContactSavedOk] = useState(false);

  const fieldSchema = {
    type: "object",
    properties: {
      suggested: { type: "string" },
      confidence: { type: "string" },
      reason: { type: "string" }
    }
  };

  const handleRunAI = async () => {
    setLoading(true);
    setLoadingStage("verify");
    setSuggestions(null);
    setAccepted({});
    setRejected({});
    setSavedOk(false);

    // Stage 1: Verify & correct contact details
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
          email: fieldSchema,
          phone: fieldSchema,
          linkedin_url: fieldSchema,
          website: fieldSchema,
          job_title: fieldSchema,
          location: fieldSchema,
          first_name: fieldSchema,
          last_name: fieldSchema,
        }
      }
    });

    const cleaned = {};
    Object.entries(result).forEach(([key, val]) => {
      if (val?.suggested && val.suggested !== lead[key] && val.suggested !== 'Unknown' && val.suggested !== 'null') {
        cleaned[key] = { ...val, current: lead[key] };
      }
    });

    // Stage 2: Google search for additional missing/unverified fields
    setLoadingStage("google");
    const contactName = [lead.first_name, lead.last_name].filter(Boolean).join(' ');
    const allFields = ['email', 'phone', 'linkedin_url', 'website', 'job_title', 'location', 'first_name', 'last_name'];
    const stillMissing = allFields.filter(key => !lead[key] && !cleaned[key]);

    if (stillMissing.length > 0) {
      const googleResult = await base44.integrations.Core.InvokeLLM({
        prompt: `Search Google specifically for:
1. "${contactName ? contactName + ' ' + lead.company_name : lead.company_name} contact details"
2. "${lead.company_name} ${contactName || 'director manager'} email phone LinkedIn"

Company: ${lead.company_name}
Contact: ${contactName || 'Unknown'}
Website: ${lead.website || 'Unknown'}

I need to find: ${stillMissing.join(', ')}

For each field found via Google search results, return the value, confidence ("high"/"medium"/"low"), and which search result you found it in.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            email: fieldSchema,
            phone: fieldSchema,
            linkedin_url: fieldSchema,
            website: fieldSchema,
            job_title: fieldSchema,
            location: fieldSchema,
            first_name: fieldSchema,
            last_name: fieldSchema,
          }
        }
      });

      // Merge google results for still-missing fields (don't overwrite stage 1 results)
      Object.entries(googleResult).forEach(([key, val]) => {
        if (!cleaned[key] && val?.suggested && val.suggested !== lead[key] && val.suggested !== 'Unknown' && val.suggested !== 'null') {
          cleaned[key] = { ...val, current: lead[key], source: 'google' };
        }
      });
    }

    setLoadingStage(null);
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

  const handleContactSearch = async () => {
    setContactLoading(true);
    setContactResult(null);
    setContactSavedOk(false);

    const hasContact = lead.first_name || lead.last_name;

    const prompt = hasContact
      ? `You are a B2B sales intelligence assistant. Research the contact person at this company and find detailed outreach information.

Company: ${lead.company_name}
Contact Person: ${lead.first_name} ${lead.last_name}
Job Title: ${lead.job_title || 'Unknown'}
Website: ${lead.website || 'Unknown'}
Location: ${lead.location || 'Unknown'}

Search the web and find:
1. Verified email address for this person
2. Phone number (direct or company)
3. LinkedIn profile URL
4. Exact job title / role
5. Best outreach notes: preferred channel, professional background, any relevant context to build rapport`
      : `You are a B2B sales intelligence assistant. This company has no known contact person. Search for the best decision maker for plastic injection mold manufacturing procurement.

Company: ${lead.company_name}
Industry: ${lead.industry || 'Unknown'}
Website: ${lead.website || 'Unknown'}
Location: ${lead.location || 'Unknown'}

Find the top decision maker: Director General, CEO, General Manager, Purchasing/Procurement Manager, or Operations Director. Provide their full name, title, email, phone, LinkedIn, and why they are the best contact.`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          first_name: { type: "string" },
          last_name: { type: "string" },
          job_title: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          linkedin_url: { type: "string" },
          outreach_notes: { type: "string" },
          confidence: { type: "string" }
        }
      }
    });

    setContactResult(result);
    setContactLoading(false);
  };

  const handleApplyContact = async () => {
    if (!contactResult) return;
    setContactSaving(true);
    const updates = {};
    if (contactResult.first_name) updates.first_name = contactResult.first_name;
    if (contactResult.last_name) updates.last_name = contactResult.last_name;
    if (contactResult.job_title) updates.job_title = contactResult.job_title;
    if (contactResult.email) updates.email = contactResult.email;
    if (contactResult.phone) updates.phone = contactResult.phone;
    if (contactResult.linkedin_url) updates.linkedin_url = contactResult.linkedin_url;
    if (contactResult.outreach_notes) updates.notes = (lead.notes ? lead.notes + '\n\n' : '') + contactResult.outreach_notes;
    await onUpdateLead({ ...lead, ...updates });
    setContactSaving(false);
    setContactSavedOk(true);
    setContactResult(null);
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
          <div className="py-4 space-y-3">
            <div className="flex gap-3">
              <div className={`flex-1 flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${loadingStage === "verify" ? "bg-violet-50 text-violet-700" : "bg-slate-50 text-slate-400"}`}>
                {loadingStage === "verify" ? <RefreshCw className="w-3.5 h-3.5 animate-spin flex-shrink-0" /> : <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                Stage 1: Verify contact info
              </div>
              <div className={`flex-1 flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${loadingStage === "google" ? "bg-blue-50 text-blue-700" : "bg-slate-50 text-slate-400"}`}>
                {loadingStage === "google" && <RefreshCw className="w-3.5 h-3.5 animate-spin flex-shrink-0" />}
                Stage 2: Google search
              </div>
            </div>
            <div className="space-y-2 animate-pulse">
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

        {/* Contact Person Search Section */}
        <div className="border-t border-slate-100 pt-4 mt-2">
          <p className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
            <UserSearch className="w-4 h-4 text-indigo-500" />
            {(lead?.first_name || lead?.last_name) ? "Find Contact Person Details" : "Find Decision Maker"}
          </p>
          <p className="text-xs text-slate-400 mb-3">
            {(lead?.first_name || lead?.last_name)
              ? `Search for direct contact info and outreach tips for ${lead.first_name} ${lead.last_name}.`
              : `No contact identified. AI will find the best decision maker at ${lead?.company_name}.`
            }
          </p>

          {!contactResult && !contactLoading && !contactSavedOk && (
            <Button onClick={handleContactSearch} className="w-full bg-indigo-600 hover:bg-indigo-700">
              <UserSearch className="w-4 h-4 mr-2" />
              {(lead?.first_name || lead?.last_name) ? "Search Contact Details" : "Find Decision Maker"}
            </Button>
          )}

          {contactLoading && (
            <div className="py-4 text-center space-y-2">
              <RefreshCw className="w-6 h-6 mx-auto text-indigo-500 animate-spin" />
              <p className="text-xs text-slate-400">Searching online for contact information...</p>
            </div>
          )}

          {contactSavedOk && (
            <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 rounded-lg p-3">
              <Check className="w-4 h-4" /> Contact info applied!
              <button className="ml-auto text-xs text-slate-400 hover:text-slate-600 underline" onClick={() => setContactSavedOk(false)}>Search again</button>
            </div>
          )}

          {contactResult && !contactLoading && (
            <div className="space-y-3">
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 space-y-2">
                {(contactResult.first_name || contactResult.last_name) && (
                  <div className="flex gap-2"><span className="text-xs font-semibold text-indigo-400 w-16 uppercase">Name</span><span className="text-sm font-semibold text-slate-800">{contactResult.first_name} {contactResult.last_name}</span></div>
                )}
                {contactResult.job_title && (
                  <div className="flex gap-2"><span className="text-xs font-semibold text-indigo-400 w-16 uppercase">Title</span><span className="text-sm text-slate-700">{contactResult.job_title}</span></div>
                )}
                {contactResult.email && (
                  <div className="flex gap-2"><span className="text-xs font-semibold text-indigo-400 w-16 uppercase">Email</span><span className="text-sm text-slate-700 break-all">{contactResult.email}</span></div>
                )}
                {contactResult.phone && (
                  <div className="flex gap-2"><span className="text-xs font-semibold text-indigo-400 w-16 uppercase">Phone</span><span className="text-sm text-slate-700">{contactResult.phone}</span></div>
                )}
                {contactResult.linkedin_url && (
                  <div className="flex gap-2"><span className="text-xs font-semibold text-indigo-400 w-16 uppercase">LinkedIn</span><a href={contactResult.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline break-all">{contactResult.linkedin_url}</a></div>
                )}
                {contactResult.outreach_notes && (
                  <div className="pt-2 border-t border-indigo-100">
                    <p className="text-xs font-semibold text-indigo-400 uppercase mb-1">Outreach Notes</p>
                    <p className="text-xs text-slate-600 whitespace-pre-wrap">{contactResult.outreach_notes}</p>
                  </div>
                )}
                {contactResult.confidence && (
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-1 ${
                    contactResult.confidence === 'high' ? 'bg-emerald-100 text-emerald-700' :
                    contactResult.confidence === 'medium' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>{contactResult.confidence} confidence</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button onClick={handleApplyContact} disabled={contactSaving} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                  {contactSaving ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <><Check className="w-4 h-4 mr-2" />Apply to Lead</>}
                </Button>
                <Button variant="outline" onClick={() => setContactResult(null)}>Reset</Button>
              </div>
            </div>
          )}
        </div>

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