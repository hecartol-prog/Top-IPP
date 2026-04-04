import React, { useState, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { Zap, CheckCircle2, XCircle, Loader2, AlertCircle, Rocket, RefreshCw } from "lucide-react";

const delay = ms => new Promise(r => setTimeout(r, ms));

const ENRICHABLE_FIELDS = [
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "website", label: "Website" },
  { key: "linkedin_url", label: "LinkedIn URL" },
  { key: "job_title", label: "Job Title" },
  { key: "industry", label: "Industry" },
  { key: "company_size", label: "Company Size" },
  { key: "location", label: "Location" },
  { key: "country", label: "Country" },
  { key: "notes", label: "Notes / Summary" },
];

export default function BatchEnrichDialog({ open, onClose, leads, onComplete }) {
  const [enrichMode, setEnrichMode] = useState("apollo"); // "apollo" | "ai"
  const [selectedFields, setSelectedFields] = useState(
    new Set(["email", "phone", "website", "industry"])
  );
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [results, setResults] = useState([]);
  const [current, setCurrent] = useState(0);
  const lastPayloadRef = useRef(null);

  const toggleField = (key) => {
    setSelectedFields(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleRun = async (retryFromIndex = 0) => {
    setRunning(true);
    setStarted(true);
    if (retryFromIndex === 0) setResults([]);
    setCurrent(retryFromIndex);

    lastPayloadRef.current = { enrichMode, selectedFields: Array.from(selectedFields), onlyMissing };
    const res = retryFromIndex === 0 ? [] : (results || []).slice(0, retryFromIndex);

    for (let i = retryFromIndex; i < leads.length; i++) {
      const lead = leads[i];
      setCurrent(i + 1);
      const fnName = enrichMode === "apollo" ? "apolloEnrich" : "enrichLead";
      const payload = enrichMode === "apollo"
        ? { lead_id: lead.id, only_missing: onlyMissing }
        : { lead_id: lead.id, fields: Array.from(selectedFields), only_missing: onlyMissing };

      try {
        const response = await base44.functions.invoke(fnName, payload);
        if (!response) throw new Error("Empty response");
        res.push({
          id: lead.id,
          name: `${lead.first_name || ""} ${lead.last_name || ""}`.trim() || lead.company_name,
          status: "success",
          fields_updated: response.data?.fields_updated || [],
        });
      } catch (e) {
        console.error(`[BatchEnrich] ${lead.company_name}:`, e);
        res.push({
          id: lead.id,
          name: `${lead.first_name || ""} ${lead.last_name || ""}`.trim() || lead.company_name,
          status: "error",
          fields_updated: [],
        });
      }
      setResults([...res]);
      if (i < leads.length - 1) await delay(800);
    }

    setRunning(false);
    if (onComplete) onComplete();
  };

  const successCount = results.filter(r => r.status === "success" && r.fields_updated.length > 0).length;
  const totalUpdated = results.reduce((acc, r) => acc + r.fields_updated.length, 0);

  const handleClose = () => {
    if (running) return;
    setResults([]);
    setStarted(false);
    setCurrent(0);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg bg-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
            <Zap className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Batch AI Enrichment</h2>
            <p className="text-sm text-slate-500">{leads.length} lead{leads.length !== 1 ? "s" : ""} selected</p>
          </div>
        </div>

        {!started ? (
          <div className="space-y-4">
            {/* Mode selection */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Enrichment source</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setEnrichMode("apollo")}
                  className={`p-3 rounded-lg border text-left transition-all ${enrichMode === "apollo" ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Rocket className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-semibold text-slate-800">Apollo.io</span>
                  </div>
                  <p className="text-xs text-slate-500">Verified contact & company data</p>
                </button>
                <button
                  onClick={() => setEnrichMode("ai")}
                  className={`p-3 rounded-lg border text-left transition-all ${enrichMode === "ai" ? "border-violet-500 bg-violet-50" : "border-slate-200 hover:bg-slate-50"}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-4 h-4 text-violet-600" />
                    <span className="text-sm font-semibold text-slate-800">AI Web Search</span>
                  </div>
                  <p className="text-xs text-slate-500">Google-powered AI research</p>
                </button>
              </div>
            </div>

            {/* Field selection (AI mode only) */}
            {enrichMode === "ai" && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Fields to enrich</p>
                <div className="grid grid-cols-2 gap-2">
                  {ENRICHABLE_FIELDS.map(f => (
                    <label key={f.key} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-50 border border-slate-100">
                      <Checkbox checked={selectedFields.has(f.key)} onCheckedChange={() => toggleField(f.key)} />
                      <span className="text-sm text-slate-700">{f.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Only missing toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={onlyMissing} onCheckedChange={setOnlyMissing} />
              <span className="text-sm text-slate-700">Only fill in <strong>missing</strong> fields (skip if already has data)</span>
            </label>

            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                {enrichMode === "apollo"
                  ? "Apollo.io enrichment is fast and uses verified data. Rate-limited to avoid throttling."
                  : "AI web search enriches each lead one at a time. May take a while for large batches."}
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                onClick={() => handleRun(0)}
                disabled={enrichMode === "ai" && selectedFields.size === 0}
                className={`flex-1 ${enrichMode === "apollo" ? "bg-blue-600 hover:bg-blue-700" : "bg-violet-600 hover:bg-violet-700"}`}
              >
                {enrichMode === "apollo" ? <Rocket className="w-4 h-4 mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                Enrich {leads.length} Lead{leads.length !== 1 ? "s" : ""}
              </Button>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Progress */}
            {running && (
              <div className="flex items-center gap-2 text-sm text-violet-700 bg-violet-50 rounded-lg px-3 py-2">
                <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                Enriching lead {current} of {leads.length}...
              </div>
            )}

            {!running && (
              <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                Done! Updated {totalUpdated} field{totalUpdated !== 1 ? "s" : ""} across {successCount} lead{successCount !== 1 ? "s" : ""}.
              </div>
            )}

            {/* Results list */}
            <div className="max-h-64 overflow-y-auto space-y-1.5 border border-slate-100 rounded-lg p-2">
              {results.map(r => (
                <div key={r.id} className="flex items-center justify-between gap-2 text-sm py-1 px-2 rounded hover:bg-slate-50">
                  <div className="flex items-center gap-2 min-w-0">
                    {r.status === "error"
                      ? <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                      : r.fields_updated.length > 0
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        : <CheckCircle2 className="w-4 h-4 text-slate-300 flex-shrink-0" />
                    }
                    <span className="truncate text-slate-700">{r.name}</span>
                  </div>
                  <div className="flex gap-1 flex-wrap justify-end">
                    {r.status === "error"
                      ? <Badge variant="destructive" className="text-xs">Failed</Badge>
                      : r.fields_updated.length > 0
                        ? r.fields_updated.map(f => <Badge key={f} className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200">{f}</Badge>)
                        : <span className="text-xs text-slate-400">No changes</span>
                    }
                  </div>
                </div>
              ))}
              {running && current <= leads.length && (
                <div className="flex items-center gap-2 px-2 py-1 text-sm text-slate-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Processing...
                </div>
              )}
            </div>

            {!running && (
              <div className="flex gap-2">
                {results?.some(r => r.status === "error") && (
                  <Button
                    variant="outline"
                    className="flex-1 border-rose-200 text-rose-600 hover:bg-rose-50"
                    onClick={() => {
                      const firstError = results.findIndex(r => r.status === "error");
                      handleRun(firstError >= 0 ? firstError : 0);
                    }}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry Failed
                  </Button>
                )}
                <Button className="flex-1" variant="outline" onClick={handleClose}>Close</Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}