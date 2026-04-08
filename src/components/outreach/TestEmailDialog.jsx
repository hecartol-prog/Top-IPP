import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import {
  Mail, Plus, X, RefreshCw, Send, Eye, EyeOff, Trash2, Check
} from "lucide-react";
import RichEmailEditor from "./RichEmailEditor";

function replacePlaceholders(text, data) {
  if (!text) return text;
  return text
    .replace(/\{\{first_name\}\}/g, data.first_name || "")
    .replace(/\{\{last_name\}\}/g, data.last_name || "")
    .replace(/\{\{company_name\}\}/g, data.company_name || "")
    .replace(/\{\{job_title\}\}/g, data.job_title || "")
    .replace(/\{\{industry\}\}/g, data.industry || "");
}

export default function TestEmailDialog({ open, onClose, subject, body, campaignName }) {
  const [testEmails, setTestEmails] = useState([]);
  const [newEmail, setNewEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [sentResults, setSentResults] = useState([]);

  const handleAddEmail = () => {
    if (!newEmail.trim() || !isValidEmail(newEmail)) {
      alert("Please enter a valid email address");
      return;
    }
    if (testEmails.includes(newEmail.trim())) {
      alert("Email already added");
      return;
    }
    setTestEmails([...testEmails, newEmail.trim()]);
    setNewEmail("");
  };

  const handleRemoveEmail = (email) => {
    setTestEmails(testEmails.filter(e => e !== email));
  };

  const isValidEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleSendTest = async () => {
    if (testEmails.length === 0 || !subject || !body) return;

    setSending(true);
    setSentResults([]);
    const results = [];

    for (const email of testEmails) {
      try {
        // Use simple test data for preview
        const testData = {
          first_name: "Test",
          last_name: "Recipient",
          company_name: "Test Company",
          job_title: "Manager",
          industry: "Manufacturing"
        };

        await base44.functions.invoke('sendTrackedEmail', {
          lead_id: null,
          lead_email: email,
          lead_name: "Test Recipient",
          subject: replacePlaceholders(subject, testData),
          body: replacePlaceholders(body, testData),
          campaign_name: campaignName || "Test Campaign",
          sequence_step: 1,
          attachments: []
        });
        results.push({ email, success: true, error: null });
      } catch (error) {
        results.push({ email, success: false, error: error.message });
      }
    }

    setSentResults(results);
    setSending(false);

    // Auto-close after 3 seconds if all successful
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
            <Mail className="w-5 h-5 text-amber-600 shrink-0" />
            Test Email Campaign
          </DialogTitle>
          <DialogDescription>
            Send test emails to custom addresses before launching the campaign
          </DialogDescription>
        </DialogHeader>

        {sentResults.length === 0 ? (
          <div className="space-y-4 mt-4">
            {/* Email input */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Add Test Email Addresses</label>
              <div className="flex gap-2 mt-2">
                <Input
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAddEmail()}
                  placeholder="Enter email address..."
                  type="email"
                  className="flex-1"
                />
                <Button
                  onClick={handleAddEmail}
                  disabled={!newEmail.trim()}
                  variant="outline"
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </Button>
              </div>
            </div>

            {/* Test emails list */}
            {testEmails.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">
                  Test Recipients ({testEmails.length})
                </label>
                <div className="space-y-2">
                  {testEmails.map(email => (
                    <div key={email} className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                      <span className="text-sm text-slate-700">{email}</span>
                      <button
                        onClick={() => handleRemoveEmail(email)}
                        className="text-slate-400 hover:text-rose-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Preview section */}
            {subject && body && (
              <div className="border-t border-slate-200 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Email Preview</label>
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700"
                  >
                    {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {showPreview ? "Hide" : "Show"}
                  </button>
                </div>

                {showPreview && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">Subject</p>
                      <p className="text-sm text-slate-800 font-medium">{replacePlaceholders(subject, {})}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">Body</p>
                      <div
                        className="text-sm text-slate-700 prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: replacePlaceholders(body, {}) || "<em class='text-slate-400'>No content</em>" }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Send button */}
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleSendTest}
                disabled={testEmails.length === 0 || !subject || !body || sending}
                className="flex-1 bg-amber-600 hover:bg-amber-700"
              >
                {sending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Test to {testEmails.length} Address{testEmails.length !== 1 ? "es" : ""}
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center space-y-4">
            {successCount > 0 && failureCount === 0 && (
              <>
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">All test emails sent!</p>
                  <p className="text-sm text-slate-500">{successCount} email{successCount !== 1 ? "s" : ""} delivered successfully</p>
                </div>
              </>
            )}

            {failureCount > 0 && (
              <>
                <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto">
                  <Mail className="w-6 h-6 text-rose-600" />
                </div>
                <div className="space-y-2">
                  <p className="font-semibold text-slate-800">Test sending complete</p>
                  <div className="flex justify-center gap-3">
                    <Badge className="bg-emerald-100 text-emerald-700 border-0">{successCount} sent</Badge>
                    <Badge className="bg-rose-100 text-rose-700 border-0">{failureCount} failed</Badge>
                  </div>
                </div>

                {/* Failed emails list */}
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-left">
                  <p className="text-xs font-semibold text-rose-700 mb-2">Failed deliveries:</p>
                  {sentResults
                    .filter(r => !r.success)
                    .map(r => (
                      <p key={r.email} className="text-xs text-rose-600 mb-1 break-all">
                        {r.email}: {r.error}
                      </p>
                    ))}
                </div>
              </>
            )}

            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}