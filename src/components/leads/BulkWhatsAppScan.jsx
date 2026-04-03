import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Loader2, CheckCircle2, XCircle, SkipForward, Play, X } from "lucide-react";

const delay = ms => new Promise(r => setTimeout(r, ms));

async function safeInvoke(fnName, payload) {
  try {
    const res = await base44.functions.invoke(fnName, payload);
    if (!res) throw new Error("Empty response");
    return res;
  } catch (err) {
    console.error(`[safeInvoke] ${fnName}:`, err);
    return { data: { success: false, error: err.message || "Request failed" } };
  }
}

export default function BulkWhatsAppScan({ open, onClose, leads, onComplete }) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState([]);
  const [currentLead, setCurrentLead] = useState(null);
  const abortRef = useRef(false);

  const leadsWithWebsite = leads.filter(l => !!l.website);
  const leadsWithoutWebsite = leads.filter(l => !l.website);

  const handleStart = async () => {
    setRunning(true);
    setResults([]);
    setProgress(0);
    abortRef.current = false;

    const toScan = leadsWithWebsite;
    for (let i = 0; i < toScan.length; i++) {
      if (abortRef.current) break;

      const lead = toScan[i];
      setCurrentLead(lead);

      let resultEntry = { lead, status: "scanning" };
      setResults(prev => [...prev, resultEntry]);

      try {
        await delay(1200);
        const res = await safeInvoke("scanWebsiteWhatsApp", { lead_id: lead.id, force: false });
        const data = res.data;
        if (data?.success && data?.whatsapp_detected) {
          resultEntry = { lead, status: "found", number: data.whatsapp_number };
        } else if (data?.skipped) {
          resultEntry = { lead, status: "skipped", message: data.message };
        } else if (data?.success) {
          resultEntry = { lead, status: "not_found" };
        } else {
          resultEntry = { lead, status: "failed", message: data?.error };
        }
      } catch (err) {
        resultEntry = { lead, status: "failed", message: err.message };
      }

      setResults(prev => prev.map((r, idx) => idx === prev.length - 1 ? resultEntry : r));
      setProgress(Math.round(((i + 1) / toScan.length) * 100));
    }

    setCurrentLead(null);
    setRunning(false);
    if (onComplete) onComplete();
  };

  const handleStop = () => {
    abortRef.current = true;
    setRunning(false);
    setCurrentLead(null);
  };

  const handleClose = () => {
    if (running) handleStop();
    setResults([]);
    setProgress(0);
    onClose();
  };

  const found = results.filter(r => r.status === "found").length;
  const failed = results.filter(r => r.status === "failed").length;
  const notFound = results.filter(r => r.status === "not_found").length;
  const skipped = results.filter(r => r.status === "skipped").length;

  const statusIcon = (status) => {
    if (status === "found") return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
    if (status === "not_found") return <span className="w-4 h-4 flex items-center justify-center text-slate-400 shrink-0">⚪</span>;
    if (status === "failed") return <XCircle className="w-4 h-4 text-red-400 shrink-0" />;
    if (status === "skipped") return <SkipForward className="w-4 h-4 text-amber-400 shrink-0" />;
    return <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg bg-white max-h-[90vh] flex flex-col">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
            <MessageCircle className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Bulk WhatsApp Scan</h2>
            <p className="text-sm text-slate-500">{leadsWithWebsite.length} leads with website · {leadsWithoutWebsite.length} without</p>
          </div>
        </div>

        {/* Pre-run info */}
        {results.length === 0 && !running && (
          <div className="space-y-3 mb-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">
              <p className="font-medium mb-1">What this does:</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs text-blue-600">
                <li>Scans up to 3 pages per lead (homepage + /contact, /about)</li>
                <li>Skips leads already scanned within 7 days</li>
                <li>Skips leads with existing WhatsApp numbers</li>
                <li>3-second delay between each lead to be respectful</li>
              </ul>
            </div>
            {leadsWithoutWebsite.length > 0 && (
              <div className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                {leadsWithoutWebsite.length} lead(s) have no website and will be skipped.
              </div>
            )}
          </div>
        )}

        {/* Progress */}
        {(running || results.length > 0) && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-slate-700">
                {running ? `Scanning ${currentLead?.company_name || '...'}` : "Scan complete"}
              </span>
              <span className="text-sm text-slate-500">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            {results.length > 0 && (
              <div className="flex gap-3 mt-2 text-xs">
                <span className="text-emerald-600 font-medium">🟢 {found} found</span>
                <span className="text-slate-500">⚪ {notFound} not found</span>
                <span className="text-amber-500">⏭ {skipped} skipped</span>
                {failed > 0 && <span className="text-red-500">🔴 {failed} failed</span>}
              </div>
            )}
          </div>
        )}

        {/* Results list */}
        {results.length > 0 && (
          <div className="flex-1 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50 mb-4 max-h-64">
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                {statusIcon(r.status)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{r.lead.company_name}</p>
                  {r.status === "found" && (
                    <p className="text-xs text-emerald-600">{r.number}</p>
                  )}
                  {r.status === "skipped" && (
                    <p className="text-xs text-amber-500 truncate">{r.message}</p>
                  )}
                  {r.status === "failed" && (
                    <p className="text-xs text-red-400 truncate">{r.message || "Failed"}</p>
                  )}
                  {r.status === "not_found" && (
                    <p className="text-xs text-slate-400">No WhatsApp found</p>
                  )}
                  {r.status === "scanning" && (
                    <p className="text-xs text-blue-500">Scanning...</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {!running && results.length === 0 && (
            <>
              <Button
                onClick={handleStart}
                disabled={leadsWithWebsite.length === 0}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                <Play className="w-4 h-4 mr-2" />
                Start Scan ({leadsWithWebsite.length} leads)
              </Button>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
            </>
          )}
          {running && (
            <Button variant="destructive" onClick={handleStop} className="flex-1">
              <X className="w-4 h-4 mr-2" />
              Stop Scan
            </Button>
          )}
          {!running && results.length > 0 && (
            <Button onClick={handleClose} className="flex-1 bg-slate-900 hover:bg-slate-800">
              Done — {found} WhatsApp number{found !== 1 ? "s" : ""} found
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}