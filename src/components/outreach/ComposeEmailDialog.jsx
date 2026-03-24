import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Send, RefreshCw, Eye, EyeOff, Mail, Paperclip, X } from "lucide-react";

export default function ComposeEmailDialog({ open, onClose, lead, onSent }) {
  const [campaignName, setCampaignName] = useState("Manual Outreach");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [personalizing, setPersonalizing] = useState(false);
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [sentOk, setSentOk] = useState(false);
  const [attachments, setAttachments] = useState([]); // [{name, url, type, size}]
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef();

  const { data: templates = [] } = useQuery({
    queryKey: ['email-templates'],
    queryFn: () => base44.entities.EmailTemplate.list()
  });

  useEffect(() => {
    if (!open) {
      setSubject(""); setBody(""); setSelectedTemplateId("");
      setSentOk(false); setPersonalizing(false); setSending(false);
      setAttachments([]);
    }
  }, [open]);

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
    await base44.functions.invoke('sendTrackedEmail', {
      lead_id: lead.id,
      lead_email: lead.email,
      lead_name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
      subject,
      body,
      campaign_name: campaignName,
      sequence_step: 1,
      attachments: attachments.map(a => ({ name: a.name, url: a.url, type: a.type }))
    });
    setSending(false);
    setSentOk(true);
    if (onSent) onSent();
    setTimeout(() => { onClose(); setSentOk(false); }, 1500);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-teal-600" />
            Compose Email
            {lead && (
              <Badge variant="secondary" className="ml-1 text-xs font-normal">
                To: {lead.first_name} {lead.last_name} &lt;{lead.email}&gt;
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {sentOk ? (
          <div className="py-10 text-center space-y-2">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <Send className="w-6 h-6 text-emerald-600" />
            </div>
            <p className="font-semibold text-slate-800">Email sent successfully!</p>
            <p className="text-sm text-slate-500">Open & click tracking is active.</p>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            {/* Campaign name */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Campaign Name</label>
              <Input value={campaignName} onChange={e => setCampaignName(e.target.value)} className="mt-1" placeholder="e.g. Cold Outreach Q1" />
            </div>

            {/* Template selector */}
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

            {/* Subject */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Subject</label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} className="mt-1" placeholder="Email subject..." />
            </div>

            {/* Body */}
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
                  className="min-h-[180px] p-3 border border-slate-200 rounded-md bg-slate-50 text-sm text-slate-700"
                  dangerouslySetInnerHTML={{ __html: body || "<em class='text-slate-400'>No content yet</em>" }}
                />
              ) : (
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 font-mono"
                  placeholder="Email body (HTML supported)..."
                />
              )}
            </div>

            {/* Attachments */}
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
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current.click()}
                  disabled={uploading}
                  className="gap-2"
                >
                  {uploading
                    ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Uploading...</>
                    : <><Paperclip className="w-3.5 h-3.5" />Add Attachment</>
                  }
                </Button>
              </div>
            </div>

            {/* AI Personalize */}
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

            {!lead?.email && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2 text-center">
                ⚠ This lead has no email address. Add an email to send.
              </p>
            )}

            <div className="flex gap-2 pt-1">
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
              <Button variant="outline" onClick={onClose}>Cancel</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}