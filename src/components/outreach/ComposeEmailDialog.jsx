import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles, Send, RefreshCw, Eye, EyeOff, Mail, Paperclip, X,
  Search, ChevronLeft, Users, FlaskConical
} from "lucide-react";
import RichEmailEditor from "./RichEmailEditor";
import TestEmailDialog from "./TestEmailDialog";

const STATUS_OPTIONS = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"];
const INDUSTRY_OPTIONS = [
  "Automotive", "Electronics", "Medical", "Consumer Goods", "Aerospace",
  "Industrial", "Packaging", "Other"
];

function replacePlaceholders(text, lead) {
  if (!text || !lead) return text;
  return text
    .replace(/\{\{first_name\}\}/g, lead.first_name || "")
    .replace(/\{\{last_name\}\}/g, lead.last_name || "")
    .replace(/\{\{company_name\}\}/g, lead.company_name || "")
    .replace(/\{\{job_title\}\}/g, lead.job_title || "")
    .replace(/\{\{industry\}\}/g, lead.industry || "");
}

export default function ComposeEmailDialog({ open, onClose, lead: propLead, onSent }) {
  const [step, setStep] = useState(propLead ? "compose" : "pick_lead");
  const [mode, setMode] = useState("single");

  const [leadSearch, setLeadSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterIndustry, setFilterIndustry] = useState("all");
  const [selectedLead, setSelectedLead] = useState(propLead || null);
  const [selectedBatch, setSelectedBatch] = useState([]);

  const [campaignName, setCampaignName] = useState("Manual Outreach");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [personalizing, setPersonalizing] = useState(false);
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [sentOk, setSentOk] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [batchProgress, setBatchProgress] = useState(null);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const fileInputRef = useRef();

  const { data: templates = [] } = useQuery({
    queryKey: ['email-templates'],
    queryFn: () => base44.entities.EmailTemplate.list()
  });

  const { data: allLeads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date', 500)
  });

  useEffect(() => {
    if (!open) {
      setSubject(""); setBody(""); setSelectedTemplateId("");
      setSentOk(false); setPersonalizing(false); setSending(false);
      setAttachments([]); setLeadSearch(""); setFilterStatus("all"); setFilterIndustry("all");
      setStep(propLead ? "compose" : "pick_lead");
      setSelectedLead(propLead || null);
      setSelectedBatch([]);
      setMode("single");
      setBatchProgress(null);
      setShowTestDialog(false);
    }
  }, [open, propLead]);

  const lead = selectedLead;

  const filteredLeads = allLeads.filter(l => {
    const q = leadSearch.toLowerCase();
    const matchSearch = !q ||
      `${l.first_name} ${l.last_name}`.toLowerCase().includes(q) ||
      l.email?.toLowerCase().includes(q) ||
      l.company_name?.toLowerCase().includes(q);
    const matchStatus = filterStatus === "all" || l.status === filterStatus;
    const matchIndustry = filterIndustry === "all" ||
      l.industry?.toLowerCase().includes(filterIndustry.toLowerCase());
    return matchSearch && matchStatus && matchIndustry;
  });

  const allBatchSelected = filteredLeads.length > 0 && filteredLeads.every(l => selectedBatch.some(s => s.id === l.id));

  const toggleBatchLead = (l) => {
    setSelectedBatch(prev =>
      prev.some(s => s.id === l.id) ? prev.filter(s => s.id !== l.id) : [...prev, l]
    );
  };

  const toggleSelectAll = () => {
    if (allBatchSelected) {
      setSelectedBatch(prev => prev.filter(s => !filteredLeads.some(f => f.id === s.id)));
    } else {
      const toAdd = filteredLeads.filter(f => !selectedBatch.some(s => s.id === f.id));
      setSelectedBatch(prev => [...prev, ...toAdd]);
    }
  };

  const handleTemplateSelect = (id) => {
    setSelectedTemplateId(id);
    const tpl = templates.find(t => t.id === id);
    if (tpl) { setSubject(tpl.subject || ""); setBody(tpl.body || ""); }
  };

  const handlePersonalize = async () => {
    if (!lead || !body) return;
    setPersonalizing(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a B2B sales email specialist for a plastic injection mold manufacturing company.

Personalize this email template for the specific lead below. Make it feel genuinely tailored — reference their company, industry, role, or any specific context you know about them. Keep the tone professional and concise.

Lead info:
- Name: ${lead.first_name} ${lead.last_name}
- Title: ${lead.job_title || 'Unknown'}
- Company: ${lead.company_name}
- Industry: ${lead.industry || 'Unknown'}
- Location: ${lead.location || 'Unknown'}
- Company size: ${lead.company_size || 'Unknown'}
- Notes: ${lead.notes || 'None'}

Current subject: ${subject}
Current body:
${body}

Return a personalized version. Replace placeholders like {{first_name}}, {{company_name}}, etc. with real values. Add 1-2 sentences of company-specific context. Keep it under 200 words. Return HTML-safe text (use <br> for line breaks, no markdown).`,
      response_json_schema: {
        type: "object",
        properties: {
          subject: { type: "string" },
          body: { type: "string" }
        }
      }
    });
    if (result?.subject) setSubject(result.subject);
    if (result?.body) setBody(result.body);
    setPersonalizing(false);
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setAttachments(prev => [...prev, { name: file.name, url: file_url, type: file.type, size: file.size }]);
    }
    setUploading(false);
    fileInputRef.current.value = "";
  };

  const removeAttachment = (idx) => setAttachments(prev => prev.filter((_, i) => i !== idx));

  const formatSize = (bytes) => bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  const handleSend = async () => {
    if (!lead?.email || !subject || !body) return;
    setSending(true);
    const res = await base44.functions.invoke('sendTrackedEmail', {
      lead_id: lead.id,
      lead_email: lead.email,
      lead_name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
      subject: replacePlaceholders(subject, lead),
      body: replacePlaceholders(body, lead),
      campaign_name: campaignName,
      sequence_step: 1,
    });
    setSending(false);
    if (res?.data?.error) {
      alert(`Send failed: ${res.data.error}`);
      return;
    }
    setSentOk(true);
    if (onSent) onSent();
    setTimeout(() => { onClose(); setSentOk(false); }, 1500);
  };

  const handleBatchSend = async () => {
    const leads = selectedBatch.filter(l => l.email);
    if (!leads.length || !subject || !body) return;
    setSending(true);
    setBatchProgress({ current: 0, total: leads.length, errors: 0 });
    let errors = 0;
    for (let i = 0; i < leads.length; i++) {
      const l = leads[i];
      try {
        const res = await base44.functions.invoke('sendTrackedEmail', {
          lead_id: l.id,
          lead_email: l.email,
          lead_name: `${l.first_name || ''} ${l.last_name || ''}`.trim(),
          subject: replacePlaceholders(subject, l),
          body: replacePlaceholders(body, l),
          campaign_name: campaignName,
          sequence_step: 1,
        });
        if (res?.data?.error) errors++;
      } catch {
        errors++;
      }
      setBatchProgress({ current: i + 1, total: leads.length, errors });
      // Small delay between sends to avoid rate limits
      if (i < leads.length - 1) await new Promise(r => setTimeout(r, 1500));
    }
    setSending(false);
    setSentOk(true);
    if (onSent) onSent();
    setTimeout(() => { onClose(); setSentOk(false); }, 2000);
  };

  const leadsWithEmail = selectedBatch.filter(l => l.email).length;
  const leadsWithoutEmail = selectedBatch.length - leadsWithEmail;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-3xl bg-white max-h-[93vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <Mail className="w-5 h-5 text-teal-600 shrink-0" />
            {step === "pick_lead" ? "Select Recipients" : "Compose Email"}
            {step === "compose" && mode === "single" && lead && (
              <Badge variant="secondary" className="text-xs font-normal">
                To: {lead.first_name} {lead.last_name} {lead.email ? `<${lead.email}>` : "(no email)"}
              </Badge>
            )}
            {step === "compose" && mode === "batch" && (
              <Badge variant="secondary" className="text-xs font-normal">
                {selectedBatch.length} recipients ({leadsWithEmail} with email)
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* PICK LEAD STEP */}
        {step === "pick_lead" && (
          <div className="mt-2 space-y-3">
            {/* Mode toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setMode("single")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  mode === "single" ? "bg-teal-600 text-white border-teal-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <Mail className="w-4 h-4" /> Single Lead
              </button>
              <button
                onClick={() => setMode("batch")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  mode === "batch" ? "bg-teal-600 text-white border-teal-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <Users className="w-4 h-4" /> Batch Send
              </button>
            </div>

            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-40">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={leadSearch}
                  onChange={e => setLeadSearch(e.target.value)}
                  placeholder="Search name, email, company..."
                  className="pl-9 h-9"
                  autoFocus
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-36 h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {STATUS_OPTIONS.map(s => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterIndustry} onValueChange={setFilterIndustry}>
                <SelectTrigger className="w-36 h-9">
                  <SelectValue placeholder="Industry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Industries</SelectItem>
                  {INDUSTRY_OPTIONS.map(i => (
                    <SelectItem key={i} value={i}>{i}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Batch select all bar */}
            {mode === "batch" && (
              <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2">
                  <Checkbox checked={allBatchSelected} onCheckedChange={toggleSelectAll} />
                  <span className="text-sm text-slate-600">
                    {allBatchSelected ? "Deselect all" : `Select all ${filteredLeads.length} shown`}
                  </span>
                </div>
                {selectedBatch.length > 0 && (
                  <Badge className="bg-teal-100 text-teal-700 border-0">{selectedBatch.length} selected</Badge>
                )}
              </div>
            )}

            {/* Lead list */}
            <div className="border border-slate-200 rounded-lg overflow-y-auto max-h-[45vh]">
              {filteredLeads.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No leads found</p>
              ) : filteredLeads.map(l => {
                const isChecked = selectedBatch.some(s => s.id === l.id);
                return (
                  <div
                    key={l.id}
                    onClick={() => {
                      if (mode === "single") { setSelectedLead(l); setStep("compose"); }
                      else toggleBatchLead(l);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-slate-100 last:border-0 transition-colors cursor-pointer ${
                      mode === "batch" && isChecked ? "bg-teal-50" : "hover:bg-slate-50"
                    }`}
                  >
                    {mode === "batch" && (
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleBatchLead(l)}
                        onClick={e => e.stopPropagation()}
                      />
                    )}
                    <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-semibold text-sm shrink-0">
                      {(l.first_name?.[0] || "?").toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{l.first_name} {l.last_name}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {l.company_name}{l.industry ? ` · ${l.industry}` : ""}{l.email ? ` · ${l.email}` : " · no email"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {l.status && (
                        <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full capitalize">{l.status}</span>
                      )}
                      {!l.email && <span className="text-xs text-amber-500">No email</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Batch proceed button */}
            {mode === "batch" && (
              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-slate-400">
                  {leadsWithoutEmail > 0 && `${leadsWithoutEmail} lead(s) without email will be skipped`}
                </p>
                <Button
                  onClick={() => setStep("compose")}
                  disabled={selectedBatch.length === 0}
                  className="bg-teal-600 hover:bg-teal-700 gap-2"
                >
                  <Send className="w-4 h-4" />
                  Continue ({leadsWithEmail} with email)
                </Button>
              </div>
            )}
          </div>
        )}

        {/* COMPOSE: success */}
        {step === "compose" && sentOk && (
          <div className="py-10 text-center space-y-2">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <Send className="w-6 h-6 text-emerald-600" />
            </div>
            {batchProgress ? (
              <>
                <p className="font-semibold text-slate-800">
                  {batchProgress.total - batchProgress.errors} email{batchProgress.total - batchProgress.errors !== 1 ? "s" : ""} sent!
                </p>
                {batchProgress.errors > 0 && <p className="text-xs text-rose-500">{batchProgress.errors} failed</p>}
              </>
            ) : (
              <p className="font-semibold text-slate-800">Email sent successfully!</p>
            )}
            <p className="text-sm text-slate-500">Sent via Google Workspace SMTP.</p>
          </div>
        )}

        {/* COMPOSE: batch progress bar */}
        {step === "compose" && sending && batchProgress && (
          <div className="py-6 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-teal-500 animate-spin mx-auto" />
            <p className="font-semibold text-slate-800">
              Sending {batchProgress.current} / {batchProgress.total}...
            </p>
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div
                className="bg-teal-500 h-2 rounded-full transition-all"
                style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
              />
            </div>
            {batchProgress.errors > 0 && <p className="text-xs text-rose-500">{batchProgress.errors} error(s)</p>}
          </div>
        )}

        {/* COMPOSE: form */}
        {step === "compose" && !sentOk && !(sending && batchProgress) && (
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Campaign Name</label>
              <Input value={campaignName} onChange={e => setCampaignName(e.target.value)} className="mt-1" placeholder="e.g. Cold Outreach Q1" />
            </div>

            {templates.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Start from Template</label>
                <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Choose a template (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name} — {t.stage}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Subject</label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} className="mt-1" placeholder="Subject... (use {{first_name}}, {{company_name}})" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Body</label>
                <button onClick={() => setShowPreview(!showPreview)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700">
                  {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showPreview ? "Edit" : "Preview"}
                </button>
              </div>
              {showPreview ? (
                <div
                  className="min-h-[220px] p-4 border border-slate-200 rounded-lg bg-slate-50 text-sm text-slate-700"
                  dangerouslySetInnerHTML={{ __html: replacePlaceholders(body, lead) || "<em class='text-slate-400'>No content yet</em>" }}
                />
              ) : (
                <RichEmailEditor
                  value={body}
                  onChange={setBody}
                  placeholder="Email body... Use {{first_name}}, {{company_name}}, {{job_title}}, {{industry}}"
                />
              )}
              {mode === "batch" && (
                <p className="text-xs text-slate-400 mt-1">
                  Placeholders like <code className="bg-slate-100 px-1 rounded">{"{{first_name}}"}</code> will be replaced per lead.
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Attachments</label>
              <div className="mt-1 space-y-2">
                {attachments.map((att, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                    <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="flex-1 truncate text-slate-700">{att.name}</span>
                    <span className="text-xs text-slate-400 shrink-0">{formatSize(att.size)}</span>
                    <button onClick={() => removeAttachment(idx)} className="text-slate-400 hover:text-rose-500 shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current.click()} disabled={uploading} className="gap-2">
                  {uploading
                    ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Uploading...</>
                    : <><Paperclip className="w-3.5 h-3.5" />Add Attachment</>
                  }
                </Button>
              </div>
            </div>

            {mode === "single" && (
              <Button
                onClick={handlePersonalize}
                disabled={personalizing || !body || !lead}
                variant="outline"
                className="w-full border-violet-200 text-violet-700 hover:bg-violet-50"
              >
                {personalizing
                  ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Personalizing...</>
                  : <><Sparkles className="w-4 h-4 mr-2" />AI Personalize for {lead?.first_name || 'Lead'}</>
                }
              </Button>
            )}

            {mode === "single" && !lead?.email && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2 text-center">
                ⚠ This lead has no email address. Add an email to send.
              </p>
            )}

            <Button
              onClick={() => setShowTestDialog(true)}
              disabled={!subject || !body}
              variant="outline"
              className="w-full border-amber-200 text-amber-700 hover:bg-amber-50"
            >
              <FlaskConical className="w-4 h-4 mr-2" />
              Test Campaign Before Sending
            </Button>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setStep("pick_lead")} className="gap-1.5 shrink-0">
                <ChevronLeft className="w-4 h-4" />
                {mode === "batch" ? `${selectedBatch.length} leads` : "Change Lead"}
              </Button>
              {mode === "single" ? (
                <Button
                  onClick={handleSend}
                  disabled={sending || !lead?.email || !subject || !body}
                  className="flex-1 bg-teal-600 hover:bg-teal-700"
                >
                  {sending
                    ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Sending...</>
                    : <><Send className="w-4 h-4 mr-2" />Send with Tracking</>
                  }
                </Button>
              ) : (
                <Button
                  onClick={handleBatchSend}
                  disabled={sending || leadsWithEmail === 0 || !subject || !body}
                  className="flex-1 bg-teal-600 hover:bg-teal-700"
                >
                  {sending
                    ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Sending...</>
                    : <><Send className="w-4 h-4 mr-2" />Send to {leadsWithEmail} Lead{leadsWithEmail !== 1 ? "s" : ""}</>
                  }
                </Button>
              )}
              <Button variant="outline" onClick={onClose} className="shrink-0">Cancel</Button>
            </div>
          </div>
        )}
      </DialogContent>

      <TestEmailDialog
        open={showTestDialog}
        onClose={() => setShowTestDialog(false)}
        subject={subject}
        body={body}
        campaignName={campaignName}
      />
    </Dialog>
  );
}