import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Search, Users, CheckSquare, Square, Send, RefreshCw,
  Sparkles, AlertCircle, CheckCircle, X, FlaskConical
} from "lucide-react";

const TEST_EMAIL = "hector@dgtopindustrial.com";

export default function CampaignBuilderDialog({ open, onClose, onComplete }) {
  const [step, setStep] = useState(1); // 1=select leads, 2=compose, 3=sending
  const [campaignName, setCampaignName] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [searchLeads, setSearchLeads] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [personalizing, setPersonalizing] = useState(false);
  const [sendingState, setSendingState] = useState([]); // [{lead, status}]
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date', 1000)
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['email-templates'],
    queryFn: () => base44.entities.EmailTemplate.list()
  });

  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      if (!l.email) return false; // only leads with email
      const matchStatus = filterStatus === "all" || l.status === filterStatus;
      const q = searchLeads.toLowerCase();
      const matchSearch = !q ||
        `${l.first_name} ${l.last_name} ${l.company_name} ${l.email}`.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [leads, searchLeads, filterStatus]);

  const selectedLeads = leads.filter(l => selectedIds.includes(l.id));

  const toggleAll = () => {
    const allIds = filteredLeads.map(l => l.id);
    const allSelected = allIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !allIds.includes(id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...allIds])]);
    }
  };

  const toggleOne = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleTemplateSelect = (id) => {
    setSelectedTemplateId(id);
    const tpl = templates.find(t => t.id === id);
    if (tpl) { setSubject(tpl.subject || ""); setBody(tpl.body || ""); }
  };

  const handlePersonalize = async () => {
    if (!body) return;
    setPersonalizing(true);
    // Use first selected lead as sample for preview
    const sampleLead = selectedLeads[0];
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a B2B sales email specialist for a plastic injection mold manufacturing company.
Personalize this cold email template. It will be sent to multiple leads so keep personalization tokens like {{first_name}}, {{company_name}} intact — only improve the general copy and tone.
${sampleLead ? `Sample lead for context: ${sampleLead.first_name} ${sampleLead.last_name}, ${sampleLead.job_title || ''} at ${sampleLead.company_name} (${sampleLead.industry || ''})` : ''}
Subject: ${subject}
Body: ${body}
Return improved subject and body. Keep {{first_name}}, {{company_name}} tokens. Return HTML-safe text with <br> for line breaks.`,
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

  const replacePlaceholders = (text, lead) => {
    return text
      .replace(/{{first_name}}/gi, lead.first_name || '')
      .replace(/{{last_name}}/gi, lead.last_name || '')
      .replace(/{{company_name}}/gi, lead.company_name || '')
      .replace(/{{job_title}}/gi, lead.job_title || '')
      .replace(/{{industry}}/gi, lead.industry || '');
  };

  const handleSendTest = async () => {
    if (!subject || !body) return;
    setTestSending(true);
    setTestResult(null);
    try {
      await base44.functions.invoke('sendTrackedEmail', {
        lead_id: 'test',
        lead_email: TEST_EMAIL,
        lead_name: 'Test User',
        subject: `[TEST] ${subject}`,
        body,
        campaign_name: campaignName || 'Test',
        sequence_step: 1
      });
      setTestResult({ ok: true });
    } catch (e) {
      setTestResult({ ok: false, error: e.message });
    }
    setTestSending(false);
  };

  const handleLaunchCampaign = async () => {
    if (!subject || !body || selectedLeads.length === 0) return;
    setStep(3);
    const results = [];
    for (const lead of selectedLeads) {
      const personalizedSubject = replacePlaceholders(subject, lead);
      const personalizedBody = replacePlaceholders(body, lead);
      try {
        await base44.functions.invoke('sendTrackedEmail', {
          lead_id: lead.id,
          lead_email: lead.email,
          lead_name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
          subject: personalizedSubject,
          body: personalizedBody,
          campaign_name: campaignName || 'Campaign',
          sequence_step: 1
        });
        results.push({ lead, status: 'sent' });
      } catch (e) {
        results.push({ lead, status: 'error', error: e.message });
      }
      setSendingState([...results]);
    }
  };

  const handleClose = () => {
    setStep(1); setSelectedIds([]); setSubject(""); setBody("");
    setCampaignName(""); setSelectedTemplateId(""); setTestResult(null);
    setSendingState([]);
    if (step === 3 && sendingState.length > 0) onComplete?.();
    onClose();
  };

  const allFilteredSelected = filteredLeads.length > 0 && filteredLeads.every(l => selectedIds.includes(l.id));
  const sentCount = sendingState.filter(s => s.status === 'sent').length;
  const errorCount = sendingState.filter(s => s.status === 'error').length;
  const done = sendingState.length === selectedLeads.length && selectedLeads.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl bg-white max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-600" />
            Campaign Builder
            <div className="ml-auto flex gap-1">
              {[1, 2].map(s => (
                <div key={s} className={`w-6 h-1.5 rounded-full transition-colors ${step >= s ? 'bg-teal-500' : 'bg-slate-200'}`} />
              ))}
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* STEP 1 — Select Leads */}
        {step === 1 && (
          <div className="flex flex-col gap-3 overflow-hidden flex-1">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Campaign Name</label>
              <Input value={campaignName} onChange={e => setCampaignName(e.target.value)} className="mt-1" placeholder="e.g. Q2 Cold Outreach" />
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input value={searchLeads} onChange={e => setSearchLeads(e.target.value)} className="pl-9" placeholder="Search leads..." />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  {["all","new","contacted","qualified","proposal","negotiation"].map(s => (
                    <SelectItem key={s} value={s} className="capitalize">{s === "all" ? "All Status" : s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="text-xs text-slate-500 flex items-center justify-between">
              <span>Showing {filteredLeads.length} leads with email · <span className="font-semibold text-teal-600">{selectedIds.length} selected</span></span>
              <button onClick={toggleAll} className="text-teal-600 hover:underline font-medium">
                {allFilteredSelected ? "Deselect all" : "Select all"}
              </button>
            </div>

            <div className="overflow-y-auto flex-1 border border-slate-200 rounded-xl divide-y divide-slate-100">
              {filteredLeads.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-sm">No leads with email found</div>
              ) : filteredLeads.map(lead => {
                const selected = selectedIds.includes(lead.id);
                return (
                  <div
                    key={lead.id}
                    onClick={() => toggleOne(lead.id)}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${selected ? 'bg-teal-50' : 'hover:bg-slate-50'}`}
                  >
                    {selected
                      ? <CheckSquare className="w-4 h-4 text-teal-600 shrink-0" />
                      : <Square className="w-4 h-4 text-slate-300 shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{lead.first_name} {lead.last_name}</p>
                      <p className="text-xs text-slate-400 truncate">{lead.company_name} · {lead.email}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize shrink-0">{lead.status}</Badge>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-1">
              <Button
                onClick={() => setStep(2)}
                disabled={selectedIds.length === 0}
                className="bg-teal-600 hover:bg-teal-700"
              >
                Next: Compose Email →
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2 — Compose */}
        {step === 2 && (
          <div className="flex flex-col gap-3 overflow-y-auto flex-1">
            <div className="flex items-center gap-2 p-3 bg-teal-50 border border-teal-100 rounded-lg">
              <Users className="w-4 h-4 text-teal-600 shrink-0" />
              <p className="text-sm text-teal-700">
                Sending to <strong>{selectedLeads.length} leads</strong>. Use <code className="bg-teal-100 px-1 rounded">{"{{first_name}}"}</code>, <code className="bg-teal-100 px-1 rounded">{"{{company_name}}"}</code> for personalization.
              </p>
            </div>

            {templates.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Start from Template</label>
                <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Choose a template (optional)" /></SelectTrigger>
                  <SelectContent>
                    {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name} — {t.stage}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Subject</label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} className="mt-1" placeholder="e.g. Partnering with {{company_name}} on injection molds" />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Body</label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={8}
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 font-mono"
                placeholder="Hi {{first_name}},&#10;&#10;I noticed {{company_name}} might benefit from..."
              />
            </div>

            <Button onClick={handlePersonalize} disabled={personalizing || !body} variant="outline" className="border-violet-200 text-violet-700 hover:bg-violet-50">
              {personalizing
                ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Improving with AI...</>
                : <><Sparkles className="w-4 h-4 mr-2" />AI Improve Email</>
              }
            </Button>

            {/* Test Send */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                <FlaskConical className="w-3.5 h-3.5" /> Test Email
              </p>
              <p className="text-xs text-slate-400">Send a test to <strong>{TEST_EMAIL}</strong> before launching.</p>
              <Button
                onClick={handleSendTest}
                disabled={testSending || !subject || !body}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                {testSending
                  ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Sending test...</>
                  : <><FlaskConical className="w-3.5 h-3.5" />Send Test Email</>
                }
              </Button>
              {testResult && (
                <p className={`text-xs flex items-center gap-1 ${testResult.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {testResult.ok
                    ? <><CheckCircle className="w-3.5 h-3.5" />Test sent to {TEST_EMAIL}!</>
                    : <><AlertCircle className="w-3.5 h-3.5" />Error: {testResult.error}</>
                  }
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
              <Button
                onClick={handleLaunchCampaign}
                disabled={!subject || !body}
                className="flex-1 bg-teal-600 hover:bg-teal-700"
              >
                <Send className="w-4 h-4 mr-2" />
                Launch Campaign to {selectedLeads.length} Leads
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3 — Sending Progress */}
        {step === 3 && (
          <div className="flex flex-col gap-4 overflow-hidden flex-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">
                Sending campaign: <span className="text-teal-600">{campaignName || 'Campaign'}</span>
              </p>
              <p className="text-xs text-slate-400">{sendingState.length} / {selectedLeads.length}</p>
            </div>

            <div className="w-full bg-slate-100 rounded-full h-2">
              <div
                className="bg-teal-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${selectedLeads.length > 0 ? (sendingState.length / selectedLeads.length) * 100 : 0}%` }}
              />
            </div>

            <div className="overflow-y-auto flex-1 space-y-1.5 pr-1">
              {sendingState.map(({ lead, status, error }) => (
                <div key={lead.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50">
                  {status === 'sent'
                    ? <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                    : <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{lead.first_name} {lead.last_name}</p>
                    <p className="text-xs text-slate-400 truncate">{lead.email}</p>
                  </div>
                  <Badge className={status === 'sent' ? 'bg-emerald-100 text-emerald-700 border-0' : 'bg-rose-100 text-rose-700 border-0'}>
                    {status === 'sent' ? 'Sent' : 'Error'}
                  </Badge>
                </div>
              ))}
              {!done && (
                <div className="flex items-center gap-2 px-3 py-2 text-slate-400 text-sm">
                  <RefreshCw className="w-4 h-4 animate-spin" /> Sending...
                </div>
              )}
            </div>

            {done && (
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <div className="flex gap-4 text-sm">
                  <span className="text-emerald-600 font-semibold">✓ {sentCount} sent</span>
                  {errorCount > 0 && <span className="text-rose-600 font-semibold">✗ {errorCount} failed</span>}
                </div>
                <Button onClick={handleClose} className="w-full bg-teal-600 hover:bg-teal-700">Done</Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}