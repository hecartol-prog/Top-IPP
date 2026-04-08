import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import {
  MessageCircle, Send, Paperclip, X, RefreshCw, Check,
  AlertTriangle, ExternalLink, Plus, Trash2
} from "lucide-react";

function replacePlaceholders(text, lead) {
  if (!text) return text;
  return text
    .replace(/\{\{first_name\}\}/g, lead.first_name || "")
    .replace(/\{\{last_name\}\}/g, lead.last_name || "")
    .replace(/\{\{company_name\}\}/g, lead.company_name || "")
    .replace(/\{\{job_title\}\}/g, lead.job_title || "");
}

function formatPhone(phone) {
  if (!phone) return null;
  return phone.replace(/[\s\-\(\)]/g, "").replace(/^\+/, "");
}

export default function BulkWhatsAppMessage({ open, onClose, leads = [] }) {
  const [message, setMessage] = useState("");
  const [links, setLinks] = useState([]);
  const [newLink, setNewLink] = useState({ label: "", url: "" });
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(null);
  const [results, setResults] = useState([]);
  const fileInputRef = useRef();

  // Leads with WhatsApp number
  const leadsWithWA = leads.filter(l => l.whatsapp_number);
  const leadsWithoutWA = leads.filter(l => !l.whatsapp_number);

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

  const addLink = () => {
    const url = newLink.url.trim();
    const label = newLink.label.trim() || url;
    if (!url) return;
    setLinks(prev => [...prev, { label, url }]);
    setNewLink({ label: "", url: "" });
  };

  const removeLink = (idx) => setLinks(prev => prev.filter((_, i) => i !== idx));

  // Build full message text with links appended
  const buildMessage = (lead) => {
    let text = replacePlaceholders(message, lead);
    if (links.length > 0) {
      text += "\n\n";
      links.forEach(l => {
        text += `${l.label}: ${l.url}\n`;
      });
    }
    return text.trim();
  };

  // Open WhatsApp web link for a lead
  const openWhatsApp = (lead) => {
    const phone = formatPhone(lead.whatsapp_number);
    if (!phone) return null;
    const text = encodeURIComponent(buildMessage(lead));
    return `https://wa.me/${phone}?text=${text}`;
  };

  // Send all - opens WhatsApp links sequentially with delay
  const handleSendAll = async () => {
    if (!message.trim() || leadsWithWA.length === 0) return;
    setSending(true);
    setResults([]);
    const res = [];

    for (let i = 0; i < leadsWithWA.length; i++) {
      const lead = leadsWithWA[i];
      setProgress({ current: i + 1, total: leadsWithWA.length });
      const url = openWhatsApp(lead);
      if (url) {
        window.open(url, "_blank");
        res.push({ lead, success: true });
      } else {
        res.push({ lead, success: false });
      }
      // Small delay between tabs
      if (i < leadsWithWA.length - 1) await new Promise(r => setTimeout(r, 800));
    }

    setResults(res);
    setSending(false);
    setProgress(null);
  };

  const handleClose = () => {
    setMessage("");
    setLinks([]);
    setNewLink({ label: "", url: "" });
    setAttachments([]);
    setResults([]);
    setProgress(null);
    setSending(false);
    onClose();
  };

  const successCount = results.filter(r => r.success).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-2xl bg-white max-h-[93vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-green-600 shrink-0" />
            Bulk WhatsApp Message
          </DialogTitle>
          <DialogDescription>
            Compose a message to send to {leads.length} selected lead{leads.length !== 1 ? "s" : ""} via WhatsApp Web.
          </DialogDescription>
        </DialogHeader>

        {/* Done state */}
        {results.length > 0 ? (
          <div className="py-6 text-center space-y-4">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-7 h-7 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-lg">Done!</p>
              <p className="text-sm text-slate-500 mt-1">
                Opened WhatsApp for <strong>{successCount}</strong> lead{successCount !== 1 ? "s" : ""}.
              </p>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {results.map((r, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-1.5 bg-slate-50 rounded-lg text-sm">
                  <span className="text-slate-700">{r.lead.first_name} {r.lead.last_name} — {r.lead.whatsapp_number}</span>
                  {r.success
                    ? <Badge className="bg-green-100 text-green-700 border-0">Opened</Badge>
                    : <Badge className="bg-rose-100 text-rose-700 border-0">Failed</Badge>
                  }
                </div>
              ))}
            </div>
            <Button variant="outline" onClick={handleClose}>Close</Button>
          </div>
        ) : (
          <div className="space-y-5 mt-2">

            {/* Recipients summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-700">{leadsWithWA.length}</p>
                <p className="text-xs text-green-600 mt-0.5">With WhatsApp</p>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-amber-700">{leadsWithoutWA.length}</p>
                <p className="text-xs text-amber-600 mt-0.5">No WhatsApp</p>
              </div>
            </div>

            {leadsWithoutWA.length > 0 && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  {leadsWithoutWA.length} lead{leadsWithoutWA.length !== 1 ? "s" : ""} without a WhatsApp number will be skipped. Use the WhatsApp Scan feature to detect their numbers first.
                </p>
              </div>
            )}

            {/* Message */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                Message
                <span className="text-slate-400 font-normal normal-case ml-2">Use {"{{first_name}}"}, {"{{last_name}}"}, {"{{company_name}}"}</span>
              </label>
              <Textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder={`Hi {{first_name}},\n\nI wanted to reach out about our plastic injection mold solutions...`}
                className="min-h-[150px] resize-none font-mono text-sm"
                autoFocus
              />
            </div>

            {/* Links */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">
                Links <span className="text-slate-400 font-normal normal-case">(appended to message)</span>
              </label>
              {links.map((link, idx) => (
                <div key={idx} className="flex items-center gap-2 mb-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-medium text-slate-700 shrink-0">{link.label}:</span>
                  <span className="flex-1 text-slate-500 truncate">{link.url}</span>
                  <button onClick={() => removeLink(idx)} className="text-slate-400 hover:text-rose-500 shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  value={newLink.label}
                  onChange={e => setNewLink(p => ({ ...p, label: e.target.value }))}
                  placeholder="Label (e.g. Catalog)"
                  className="w-32 text-sm h-8"
                />
                <Input
                  value={newLink.url}
                  onChange={e => setNewLink(p => ({ ...p, url: e.target.value }))}
                  placeholder="https://..."
                  className="flex-1 text-sm h-8"
                  onKeyDown={e => e.key === "Enter" && addLink()}
                />
                <Button onClick={addLink} variant="outline" size="sm" className="h-8 gap-1" disabled={!newLink.url.trim()}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Attachments note */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                Attachments <span className="text-slate-400 font-normal normal-case">(uploaded & linked)</span>
              </label>
              <p className="text-xs text-slate-400 mb-2">Files are uploaded and their links are appended to the message.</p>
              {attachments.map((att, idx) => (
                <div key={idx} className="flex items-center gap-2 mb-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                  <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="flex-1 truncate text-slate-700">{att.name}</span>
                  <span className="text-xs text-slate-400 shrink-0">{formatSize(att.size)}</span>
                  <button onClick={() => removeAttachment(idx)} className="text-slate-400 hover:text-rose-500 shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current.click()} disabled={uploading} className="gap-2 h-8">
                {uploading
                  ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Uploading...</>
                  : <><Paperclip className="w-3.5 h-3.5" />Add File</>
                }
              </Button>
            </div>

            {/* Preview */}
            {message && leadsWithWA.length > 0 && (
              <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">Preview (first lead)</p>
                <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans">
                  {buildMessage(leadsWithWA[0])}
                </pre>
                {attachments.map((att, i) => (
                  <p key={i} className="text-xs text-slate-500 mt-1">📎 {att.name}: {att.url}</p>
                ))}
              </div>
            )}

            {/* Progress */}
            {sending && progress && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>Opening WhatsApp...</span>
                  <span>{progress.current} / {progress.total}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400">WhatsApp Web tabs are opening — review and send each one.</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button
                onClick={handleSendAll}
                disabled={sending || !message.trim() || leadsWithWA.length === 0}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {sending
                  ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Opening tabs...</>
                  : <><MessageCircle className="w-4 h-4 mr-2" />Send to {leadsWithWA.length} Lead{leadsWithWA.length !== 1 ? "s" : ""} via WhatsApp</>
                }
              </Button>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}