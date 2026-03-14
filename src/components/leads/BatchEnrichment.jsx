import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Zap, RefreshCw } from "lucide-react";

export default function BatchEnrichment({ open, onClose, selectedLeads, onEnrichmentComplete }) {
  const [enriching, setEnriching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const startEnrichment = async () => {
    setEnriching(true);
    setProgress(0);
    setError(null);
    setResults(null);

    try {
      // Limit to 50 records
      const leadsToEnrich = selectedLeads.slice(0, 50);
      let enrichedCount = 0;
      let failedCount = 0;
      const errors = [];

      for (let i = 0; i < leadsToEnrich.length; i++) {
        const lead = leadsToEnrich[i];
        
        try {
          // Skip if already has most fields
          if (lead.email && lead.company_name && lead.phone) {
            enrichedCount++;
            setProgress(Math.round(((i + 1) / leadsToEnrich.length) * 100));
            continue;
          }

          // Use AI to enrich empty fields
          const prompt = `You are a B2B lead researcher. Based on this partial lead information, fill in missing details. Only return JSON, no other text.
          
          Lead data:
          - Name: ${lead.first_name} ${lead.last_name}
          - Company: ${lead.company_name || 'Unknown'}
          - Email: ${lead.email || 'Unknown'}
          - Phone: ${lead.phone || 'Unknown'}
          - Job Title: ${lead.job_title || 'Unknown'}
          - LinkedIn: ${lead.linkedin_url || 'Unknown'}
          
          Research this person and company online and provide:
          {
            "email": "their work email if found",
            "phone": "their work phone if found",
            "company_name": "correct company name",
            "job_title": "current job title",
            "industry": "company industry",
            "company_size": "company size (1-10, 11-50, 51-200, 201-500, 501-1000, 1000+)"
          }`;

          const aiRes = await base44.integrations.Core.InvokeLLM({
            prompt,
            response_json_schema: {
              type: "object",
              properties: {
                email: { type: "string" },
                phone: { type: "string" },
                company_name: { type: "string" },
                job_title: { type: "string" },
                industry: { type: "string" },
                company_size: { type: "string" }
              }
            }
          });

          // Merge enriched data with existing lead
          const enrichedData = {};
          if (aiRes.email && !lead.email) enrichedData.email = aiRes.email;
          if (aiRes.phone && !lead.phone) enrichedData.phone = aiRes.phone;
          if (aiRes.company_name && !lead.company_name) enrichedData.company_name = aiRes.company_name;
          if (aiRes.job_title && !lead.job_title) enrichedData.job_title = aiRes.job_title;
          if (aiRes.industry && !lead.industry) enrichedData.industry = aiRes.industry;
          if (aiRes.company_size && !lead.company_size) enrichedData.company_size = aiRes.company_size;

          // Update lead if there's new data
          if (Object.keys(enrichedData).length > 0) {
            await base44.entities.Lead.update(lead.id, enrichedData);
          }

          enrichedCount++;
        } catch (e) {
          failedCount++;
          errors.push(`${lead.first_name} ${lead.last_name}: ${e.message}`);
        }

        setProgress(Math.round(((i + 1) / leadsToEnrich.length) * 100));
      }

      setResults({ enrichedCount, failedCount, errors });
      onEnrichmentComplete();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnriching(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            AI Batch Enrichment
          </DialogTitle>
          <DialogDescription>
            Fill empty fields for {Math.min(selectedLeads.length, 50)} leads using AI research
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!results && !enriching && (
            <>
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm text-slate-600">
                  <strong>{selectedLeads.length}</strong> leads selected
                  {selectedLeads.length > 50 && <span className="block text-xs text-amber-600 mt-1">Only first 50 will be enriched</span>}
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-slate-900">This will fill:</h4>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Email</Badge>
                  <Badge variant="outline">Phone</Badge>
                  <Badge variant="outline">Company</Badge>
                  <Badge variant="outline">Job Title</Badge>
                  <Badge variant="outline">Industry</Badge>
                  <Badge variant="outline">Company Size</Badge>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2 text-sm">
                <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <span className="text-blue-800">Only empty fields will be filled. Existing data is preserved.</span>
              </div>
            </>
          )}

          {enriching && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Enriching leads...</span>
                <span className="text-sm text-slate-600">{progress}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-amber-500 h-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {results && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-emerald-900">Enrichment complete!</p>
              <div className="text-sm text-emerald-800">
                <p>✓ <strong>{results.enrichedCount}</strong> leads enriched</p>
                {results.failedCount > 0 && <p className="text-amber-700 mt-1">⚠ {results.failedCount} failed</p>}
              </div>
              {results.errors.length > 0 && (
                <div className="mt-3 max-h-40 overflow-y-auto">
                  <p className="text-xs font-medium text-slate-600 mb-1">Errors:</p>
                  {results.errors.map((err, i) => (
                    <p key={i} className="text-xs text-slate-600">{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} disabled={enriching}>
            {results ? "Close" : "Cancel"}
          </Button>
          {!results && (
            <Button 
              onClick={startEnrichment}
              disabled={enriching}
              className="bg-amber-600 hover:bg-amber-700 flex-1"
            >
              {enriching ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Enriching...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Start Enrichment
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}