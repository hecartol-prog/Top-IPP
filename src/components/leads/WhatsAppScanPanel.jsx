import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Loader2, RefreshCw, CheckCircle2, XCircle, AlertCircle, ExternalLink } from "lucide-react";
import { format, differenceInDays } from "date-fns";

const statusConfig = {
  not_scanned: { label: "Not Scanned", color: "bg-slate-100 text-slate-600", icon: null },
  scanning:    { label: "Scanning...", color: "bg-blue-100 text-blue-700", icon: Loader2 },
  completed:   { label: "Scan Complete", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  failed:      { label: "Scan Failed", color: "bg-red-100 text-red-700", icon: XCircle },
};

export default function WhatsAppScanPanel({ lead, onUpdateLead }) {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);

  const scanStatus = lead?.website_scan_status || "not_scanned";
  const hasNumber = !!lead?.whatsapp_number;
  const hasWebsite = !!lead?.website;

  const daysSinceScan = lead?.website_scanned_date
    ? differenceInDays(new Date(), new Date(lead.website_scanned_date))
    : null;

  const handleScan = async (force = false) => {
    setScanning(true);
    setResult(null);
    // Optimistically update UI
    if (onUpdateLead) onUpdateLead({ ...lead, website_scan_status: "scanning" });

    const res = await base44.functions.invoke("scanWebsiteWhatsApp", { lead_id: lead.id, force });
    const data = res.data;
    setScanning(false);
    setResult(data);

    if (data?.success || data?.skipped) {
      if (onUpdateLead) {
        onUpdateLead({
          ...lead,
          whatsapp_number: data.whatsapp_number || lead.whatsapp_number,
          whatsapp_detected: data.whatsapp_detected ?? lead.whatsapp_detected,
          whatsapp_source_url: data.whatsapp_source_url || lead.whatsapp_source_url,
          website_scan_status: data.skipped ? lead.website_scan_status : "completed",
          website_scanned_date: data.skipped ? lead.website_scanned_date : new Date().toISOString(),
        });
      }
    } else if (data?.error) {
      if (onUpdateLead) onUpdateLead({ ...lead, website_scan_status: "failed" });
    }
  };

  const statusCfg = statusConfig[scanning ? "scanning" : scanStatus] || statusConfig.not_scanned;
  const StatusIcon = statusCfg.icon;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-1">
          <MessageCircle className="w-4 h-4 text-emerald-600" />
          WhatsApp Detection
        </h3>
        <p className="text-xs text-slate-500">
          Automatically scan the company website to find a WhatsApp contact number.
        </p>
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusCfg.color}`}>
          {StatusIcon && <StatusIcon className={`w-3 h-3 ${scanning ? 'animate-spin' : ''}`} />}
          {statusCfg.label}
        </span>
        {daysSinceScan !== null && (
          <span className="text-xs text-slate-400">
            Last scan: {daysSinceScan === 0 ? "today" : `${daysSinceScan}d ago`}
          </span>
        )}
      </div>

      {/* WhatsApp number display */}
      {hasNumber ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center shrink-0">
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">WhatsApp Found 🟢</p>
              <p className="text-base font-bold text-slate-900">{lead.whatsapp_number}</p>
            </div>
          </div>
          <a
            href={`https://wa.me/${lead.whatsapp_number.replace(/[^\d]/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-emerald-700 hover:text-emerald-900 font-medium underline-offset-2 hover:underline"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open WhatsApp Chat
          </a>
          {lead.whatsapp_source_url && (
            <p className="text-xs text-slate-400 mt-2 truncate">
              Found on: {lead.whatsapp_source_url}
            </p>
          )}
        </div>
      ) : scanStatus === "completed" ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-300 rounded-full flex items-center justify-center shrink-0">
            <MessageCircle className="w-4 h-4 text-slate-500" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Not Found ⚪</p>
            <p className="text-sm text-slate-600">No WhatsApp contact detected on this website.</p>
          </div>
        </div>
      ) : scanStatus === "failed" ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Scan Failed 🔴</p>
            <p className="text-sm text-red-700">Website could not be reached. Please retry.</p>
          </div>
        </div>
      ) : null}

      {/* Result message */}
      {result && !result.success && !result.skipped && (
        <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          {result.error || "Scan failed. Please try again."}
        </div>
      )}
      {result?.skipped && (
        <div className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
          {result.message}
        </div>
      )}

      {/* Action buttons */}
      {!hasWebsite ? (
        <div className="text-sm text-slate-400 bg-slate-50 rounded-lg p-3 text-center">
          No company website set on this lead. Add a website URL to enable scanning.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Button
            onClick={() => handleScan(false)}
            disabled={scanning || !hasWebsite}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
          >
            {scanning ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scanning website...</>
            ) : scanStatus === "not_scanned" ? (
              <><MessageCircle className="w-4 h-4 mr-2" />Scan Website for WhatsApp</>
            ) : (
              <><RefreshCw className="w-4 h-4 mr-2" />Re-Scan Website</>
            )}
          </Button>
          {(scanStatus !== "not_scanned" || hasNumber) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleScan(true)}
              disabled={scanning}
              className="w-full text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Force Re-Scan (Override existing data)
            </Button>
          )}
        </div>
      )}

      {/* Website info */}
      {hasWebsite && (
        <div className="flex items-center gap-2 text-xs text-slate-400 pt-1">
          <span>Scanning:</span>
          <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline truncate max-w-xs">
            {lead.website}
          </a>
        </div>
      )}
    </div>
  );
}