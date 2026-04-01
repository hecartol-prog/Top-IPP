import React, { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { base44 } from "@/api/base44Client";
import { ClipboardPaste, ArrowRight, Loader2, Sparkles } from "lucide-react";

/**
 * Step 1: paste text → AI parses it → Step 2: confirm in LeadForm
 */
export default function PasteLeadDialog({ open, onClose, onParsed }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleParse = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a B2B CRM data extraction assistant. The user has pasted raw text from the internet (could be from LinkedIn, a website, a business card image copy, a directory, or any other source). Extract all relevant lead/contact information from the text below and return a structured JSON object.

Text:
"""
${text}
"""

Extract as many fields as you can confidently identify. Use null for fields you cannot determine.
For company_size, use only one of: "1-10", "11-50", "51-200", "201-500", "501-1000", "1000+".
For language, use only one of: "english", "spanish", "portuguese", "french", "german", "other".
For status, always use: "new".
For source, try to infer from context (e.g. "linkedin", "website", "manual") or use "manual".
Websites should include https:// prefix if not already present.
LinkedIn URLs should start with https://linkedin.com/in/ or https://linkedin.com/company/.`,
      response_json_schema: {
        type: "object",
        properties: {
          first_name: { type: "string" },
          last_name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          job_title: { type: "string" },
          company_name: { type: "string" },
          company_size: { type: "string" },
          industry: { type: "string" },
          linkedin_url: { type: "string" },
          website: { type: "string" },
          country: { type: "string" },
          location: { type: "string" },
          language: { type: "string" },
          source: { type: "string" },
          notes: { type: "string" },
        }
      }
    });

    setLoading(false);

    // Clean nulls
    const cleaned = {};
    for (const [k, v] of Object.entries(result)) {
      if (v !== null && v !== undefined && v !== "") cleaned[k] = v;
    }
    cleaned.status = cleaned.status || "new";

    onParsed(cleaned);
    setText("");
    onClose();
  };

  const handleClose = () => {
    if (loading) return;
    setText("");
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg bg-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
            <ClipboardPaste className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Paste Lead Info</h2>
            <p className="text-sm text-slate-500">Paste any text (LinkedIn profile, website, etc.) and AI will extract the lead data</p>
          </div>
        </div>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Paste anything here — e.g.:\n\nJohn Smith\nCEO at Acme Manufacturing\njohn@acme.com | +1 555 123 4567\nwww.acme.com | linkedin.com/in/johnsmith\nChicago, USA`}
          className="min-h-[180px] font-mono text-sm resize-none"
          disabled={loading}
        />

        {error && (
          <p className="text-sm text-rose-600">{error}</p>
        )}

        <div className="flex gap-2 pt-1">
          <Button
            onClick={handleParse}
            disabled={!text.trim() || loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Extracting data...</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" /> Extract & Fill Form <ArrowRight className="w-4 h-4 ml-1" /></>
            )}
          </Button>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}