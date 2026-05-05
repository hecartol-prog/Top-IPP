import React, { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import {
  Mail, Plus, X, RefreshCw, Send, Eye, EyeOff, Check,
  Paperclip, Sparkles, ChevronRight, ChevronLeft, FlaskConical
} from "lucide-react";
import RichEmailEditor from "./RichEmailEditor";

function replacePlaceholders(text, data) {
  if (!text) return text;
  return text
    .replace(/\{\{first_name\}\}/g, data.first_name || "Test")
    .replace(/\{\{last_name\}\}/g, data.last_name || "Recipient")
    .replace(/\{\{company_name\}\}/g, data.company_name || "Test Company")
    .replace(/\{\{job_title\}\}/g, data.job_title || "Manager")
    .replace(/\{\{industry\}\}/g, data.industry || "Manufacturing");
}

export default function TestEmailDialog({ open, onClose, subject: initSubject, body: initBody, campaignName: initCampaign }) {
  // Step 1: add recipients, Step 2: compose & send
  const [step, setStep] = useState(1);

  // Step 1 state
  const [testEmails, setTestEmails] = useState([]);
  const [newEmail, setNewEmail] = useState("");

  // Step 2 state
  const [subject, setSubject] = useState(initSubject || "");
  const [body, setBody] = useState(initBody || "");
  const [campaignName, setCampaignName] = useState(initCampaign || "Test Campaign");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [personalizing, setPersonalizing] = useState(false);
  const [sentResults, setSentResults] = useState([]);

  const fileInputRef = useRef();

  const { data: templates = [] } = useQuery({
    queryKey: ['email-templates'],
    queryFn: () => base44.entities.EmailTemplate.list()
  });

  // Reset on open/close
  useEffect(() => {
    if (open) {
      setStep(1);
      setTestEmails([]);
      setNewEmail("");
      setSubject(initSubject || "");
      setBody(initBody || "");
      setCampaignName(initCampaign || "Test Campaign");
      setSelectedTemplateId("");
      setShowPreview(false);
      setAttachments([]);
      setSentResults([]);
      setSending(false);
    }
  }, [open]);

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleAddEmail = () => {
    const trimmed = newEmail.trim();
    if (!trimmed || !isValidEmail(trimmed)) return;
    if (testEmails.includes(trimmed)) return;
    setTestEmails([...testEmails, trimmed]);
    setNewEmail("");
  };

  const handleRemoveEmail = (email) => setTestEmails(testEmails.filter(e => e !== email));

  const handleTemplateSelect = (id) => {
    setSelectedTemplateId(id);
    const tpl = templates.find(t => t.id === id);
    if (tpl) { setSubject(tpl.subject || ""); setBody(tpl.body || ""); }
  };

  const handlePersonalize = async () => {
    if (!body) return;
    setPersonalizing(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a B2B sales email specialist for a plastic injection mold manufacturing company.
Improve this cold email template for better engagement. Keep placeholders like {{first_name}}, {{company_name}} intact.
Subject: ${subject}
Body: ${body}
Return improved subject and body. Return HTML-safe text (use <br> for line breaks).`,
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

  const testData = {
    first_name: "Test", last_name: "Recipient",
    company_name: "Test Company", job_title: "Manager", industry: "Manufacturing"
  };

  const handleSend = async () => {
    if (testEmails.length === 0 || !subject || !body) return;
    setSending(true);
    const results = [];
    for (const email of testEmails) {
      try {
        await base44.functions.invoke('sendTrackedEmail', {
          lead_id: null,
          lead_email: email,
          lead_name: "Test Recipient",
          subject: replacePlaceholders(subject, testData),
          body: replacePlaceholders(body, testData),
          campaign_name: campaignName,
          sequence_step: 1,
          attachments: attachments.map(a => ({ name: a.name, url: a.url, type: a.type }))
        });
        results.push({ email, success: true });
      } catch (error) {
        results.push({ email, success: false, error: error.message });
      }
    }
    setSentResults(results);
    setSending(false);
    if (results.every(r => r.success)) {
      setTimeout(() => onClose(), 3000);
    }
  };

  const successCount = sentResults.filter(r => r.success).length;
  const failureCount = sentResults.filter(r => !r.success).length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-2xl bg-white max-h-[93vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-amber-600 shrink-0" />
            Test Email
            <div className="ml-auto flex gap-1">
              {[1, 2].map(s => (
                <div key={s} className={`w-6 h-1.5 rounded-full transition-colors ${step >= s ? 'bg-amber-500' : 'bg-slate-200'}`} />
              ))}
            </div>
          </DialogTitle>
          <DialogDescription>
            {step === 1 ? "Add the email addresses to receive the test" : "Compose and send your test email"}
          </DialogDescription>
        </DialogHeader>

        {/* STEP 1: Add recipients */}
        {step === 1 && (
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Test Email Addresses</label>
              <div className="flex gap-2 mt-2">
                <Input
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAddEmail()}
                  placeholder="Enter email address..."
                  type="email"
                  className="flex-1"
                  autoFocus
                />
                <Button
                  onClick={handleAddEmail}
                  disabled={!newEmail.trim() || !isValidEmail(newEmail)}
                  variant="outline"
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </Button>
              </div>
            </div>

            {testEmails.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">
                  Recipients ({testEmails.length})
                </label>
                <div className="space-y-2">
                  {testEmails.map(email => (
                    <div key={email} className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-sm text-slate-700">{email}</span>
                      </div>
                      <button onClick={() => handleRemoveEmail(email)} className="text-slate-400 hover:text-rose-500 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button
                onClick={() => {
                  // Auto-add current input if valid
                  const trimmed = newEmail.trim();
                  let emails = testEmails;
                  if (trimmed && isValidEmail(trimmed) && !testEmails.includes(trimmed)) {
                    emails = [...testEmails, trimmed];
                    setTestEmails(emails);
                    setNewEmail("");
                  }
                  if (emails.length > 0) setStep(2);
                }}
                disabled={testEmails.length === 0 && (!newEmail.trim() || !isValidEmail(newEmail.trim()))}
                className="bg-amber-600 hover:bg-amber-700 gap-2"
              >
                Next: Compose Email
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Compose */}
        {step === 2 && sentResults.length === 0 && (
          <div className="space-y-4 mt-2">
            {/* Recipients summary */}
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-lg">
              <Mail className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-700">
                Sending to: {testEmails.map(e => <Badge key={e} className="bg-amber-100 text-amber-700 border-0 ml-1">{e}</Badge>)}
              </p>
            </div>

            {/* Template selector — prominent at the top */}
            {templates.length > 0 && (
              <div className={`rounded-lg border p-3 ${!subject && !body ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {!subject && !body ? '📋 Pick a Template to Start' : 'Template'}
                </label>
                <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
                  <SelectTrigger className="mt-1 bg-white">
                    <SelectValue placeholder="Choose a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.filter(t => t.type === 'email').map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}{t.stage ? ` — ${t.stage}` : ''}{t.language && t.language !== 'english' ? ` (${t.language})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Campaign name */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Campaign Name</label>
              <Input value={campaignName} onChange={e => setCampaignName(e.target.value)} className="mt-1" placeholder="e.g. Test Campaign" />
            </div>

            {/* Subject */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Subject</label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} className="mt-1" placeholder="Email subject... (use {{first_name}}, {{company_name}})" />
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
                  className="min-h-[200px] p-4 border border-slate-200 rounded-lg bg-slate-50 text-sm text-slate-700"
                  dangerouslySetInnerHTML={{ __html: replacePlaceholders(body, testData) || "<em class='text-slate-400'>No content yet</em>" }}
                />
              ) : (
                <RichEmailEditor
                  value={body}
                  onChange={setBody}
                  placeholder="Email body... Use {{first_name}}, {{company_name}}, {{job_title}}, {{industry}}"
                />
              )}
            </div>

            {/* AI Improve */}
            <Button
              onClick={handlePersonalize}
              disabled={personalizing || !body}
              variant="outline"
              className="w-full border-violet-200 text-violet-700 hover:bg-violet-50"
            >
              {personalizing
                ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Improving with AI...</>
                : <><Sparkles className="w-4 h-4 mr-2" />AI Improve Email</>
              }
            </Button>

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
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current.click()} disabled={uploading} className="gap-2">
                  {uploading
                    ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Uploading...</>
                    : <><Paperclip className="w-3.5 h-3.5" />Add Attachment</>
                  }
                </Button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setStep(1)} className="gap-1.5 shrink-0">
                <ChevronLeft className="w-4 h-4" />
                Back
              </Button>
              <Button
                onClick={handleSend}
                disabled={sending || !subject || !body}
                className="flex-1 bg-amber-600 hover:bg-amber-700"
              >
                {sending
                  ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Sending...</>
                  : <><Send className="w-4 h-4 mr-2" />Send Test to {testEmails.length} Address{testEmails.length !== 1 ? "es" : ""}</>
                }
              </Button>
              <Button variant="outline" onClick={onClose} className="shrink-0">Cancel</Button>
            </div>
          </div>
        )}

        {/* Results */}
        {sentResults.length > 0 && (
          <div className="py-6 text-center space-y-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${failureCount === 0 ? 'bg-emerald-100' : 'bg-amber-100'}`}>
              {failureCount === 0
                ? <Check className="w-6 h-6 text-emerald-600" />
                : <Mail className="w-6 h-6 text-amber-600" />
              }
            </div>
            <div>
              <p className="font-semibold text-slate-800">Test sending complete</p>
              <div className="flex justify-center gap-3 mt-2">
                {successCount > 0 && <Badge className="bg-emerald-100 text-emerald-700 border-0">{successCount} sent</Badge>}
                {failureCount > 0 && <Badge className="bg-rose-100 text-rose-700 border-0">{failureCount} failed</Badge>}
              </div>
            </div>
            {failureCount > 0 && (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-left">
                <p className="text-xs font-semibold text-rose-700 mb-2">Failed deliveries:</p>
                {sentResults.filter(r => !r.success).map(r => (
                  <div key={r.email} className="mb-2">
                    <p className="text-xs text-rose-600 break-all font-medium">{r.email}</p>
                    <p className="text-xs text-rose-500 break-all mt-0.5">
                      {r.error?.includes('not yet activated')
                        ? '⚠️ Brevo SMTP account not activated. Please contact contact@brevo.com to request activation.'
                        : r.error?.includes('permission_denied') || r.error?.includes('403')
                        ? '⚠️ Brevo permission denied. Check your API key and account activation status.'
                        : r.error}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}