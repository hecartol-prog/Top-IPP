import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { RefreshCw, CheckCircle2, XCircle, Zap, Clock } from "lucide-react";
import { format } from "date-fns";

const emailStatusColors = {
  verified: "bg-emerald-100 text-emerald-700",
  likely_to_engage: "bg-blue-100 text-blue-700",
  risky: "bg-amber-100 text-amber-700",
  do_not_email: "bg-rose-100 text-rose-700",
  unknown: "bg-slate-100 text-slate-600",
};

export default function ApolloEnrichPanel({ lead, onUpdateLead }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleEnrich = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke("apolloEnrich", {
        lead_id: lead.id,
        only_missing: true,
      });
      setResult(res.data);
      if (res.data?.fields_updated?.length > 0 && onUpdateLead) {
        // Reload the full lead from server
        const updated = await base44.entities.Lead.filter({ id: lead.id });
        if (updated[0]) onUpdateLead(updated[0]);
      }
    } catch (e) {
      setResult({ error: e.message });
    }
    setLoading(false);
  };

  const handleForceEnrich = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke("apolloEnrich", {
        lead_id: lead.id,
        only_missing: false,
      });
      setResult(res.data);
      if (res.data?.fields_updated?.length > 0 && onUpdateLead) {
        const updated = await base44.entities.Lead.filter({ id: lead.id });
        if (updated[0]) onUpdateLead(updated[0]);
      }
    } catch (e) {
      setResult({ error: e.message });
    }
    setLoading(false);
  };

  const status = lead.apollo_enrichment_status || "not_enriched";

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div className={`flex items-center justify-between p-3 rounded-xl border ${
        status === "enriched"
          ? "bg-emerald-50 border-emerald-200"
          : status === "failed"
          ? "bg-rose-50 border-rose-200"
          : "bg-slate-50 border-slate-200"
      }`}>
        <div className="flex items-center gap-2">
          {status === "enriched" && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
          {status === "failed" && <XCircle className="w-4 h-4 text-rose-500" />}
          {status === "not_enriched" && <Zap className="w-4 h-4 text-slate-400" />}
          <div>
            <p className={`text-sm font-semibold ${
              status === "enriched" ? "text-emerald-700" :
              status === "failed" ? "text-rose-700" : "text-slate-600"
            }`}>
              {status === "enriched" ? "Enriched via Apollo.io" :
               status === "failed" ? "Enrichment failed — no match found" :
               "Not yet enriched"}
            </p>
            {lead.apollo_last_enriched && (
              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3" />
                Last enriched: {format(new Date(lead.apollo_last_enriched), "MMM d, yyyy HH:mm")}
              </p>
            )}
          </div>
        </div>
        <p className="text-xs text-slate-400 italic">Data powered by Apollo</p>
      </div>

      {/* Apollo data fields */}
      {status === "enriched" && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Apollo Data</p>
          <div className="grid grid-cols-1 gap-2">
            {lead.apollo_email_status && (
              <div className="flex items-center justify-between p-2.5 bg-white border border-slate-100 rounded-lg">
                <span className="text-xs text-slate-500">Email Status</span>
                <Badge className={`${emailStatusColors[lead.apollo_email_status]} border-0 text-xs`}>
                  {lead.apollo_email_status?.replace(/_/g, " ")}
                </Badge>
              </div>
            )}
            {lead.revenue_range && (
              <div className="flex items-center justify-between p-2.5 bg-white border border-slate-100 rounded-lg">
                <span className="text-xs text-slate-500">Revenue Range</span>
                <span className="text-sm font-medium text-slate-700">{lead.revenue_range}</span>
              </div>
            )}
            {lead.technologies_used && (
              <div className="p-2.5 bg-white border border-slate-100 rounded-lg">
                <p className="text-xs text-slate-500 mb-1.5">Technologies Used</p>
                <div className="flex flex-wrap gap-1">
                  {lead.technologies_used.split(",").map(t => (
                    <Badge key={t} variant="secondary" className="text-xs">{t.trim()}</Badge>
                  ))}
                </div>
              </div>
            )}
            {lead.company_description && (
              <div className="p-2.5 bg-white border border-slate-100 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Company Description</p>
                <p className="text-sm text-slate-700">{lead.company_description}</p>
              </div>
            )}
            {lead.company_linkedin && (
              <div className="flex items-center justify-between p-2.5 bg-white border border-slate-100 rounded-lg">
                <span className="text-xs text-slate-500">Company LinkedIn</span>
                <a href={lead.company_linkedin} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline truncate max-w-[180px]">
                  View Page
                </a>
              </div>
            )}
            {(lead.apollo_contact_id || lead.apollo_org_id) && (
              <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                <p className="text-xs text-slate-400">
                  {lead.apollo_contact_id && `Contact ID: ${lead.apollo_contact_id}`}
                  {lead.apollo_contact_id && lead.apollo_org_id && " · "}
                  {lead.apollo_org_id && `Org ID: ${lead.apollo_org_id}`}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Result feedback */}
      {result && !loading && (
        <div className={`flex items-start gap-2 text-sm rounded-lg p-3 ${
          result.error
            ? "bg-rose-50 text-rose-700"
            : result.fields_updated?.length > 0
            ? "bg-emerald-50 text-emerald-700"
            : "bg-slate-50 text-slate-600"
        }`}>
          {result.error
            ? <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            : <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          }
          <div>
            <p className="font-medium">{result.error || result.message}</p>
            {result.fields_updated?.length > 0 && (
              <p className="text-xs mt-0.5 opacity-80">
                Updated: {result.fields_updated.filter(f => !f.startsWith("apollo_")).join(", ")}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          onClick={handleEnrich}
          disabled={loading}
          className="flex-1 bg-blue-600 hover:bg-blue-700"
        >
          {loading ? (
            <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Enriching...</>
          ) : (
            <><Zap className="w-4 h-4 mr-2" /> Enrich with Apollo</>
          )}
        </Button>
        {status === "enriched" && (
          <Button
            onClick={handleForceEnrich}
            disabled={loading}
            variant="outline"
            className="text-xs"
          >
            Force Refresh
          </Button>
        )}
      </div>

      <p className="text-xs text-slate-400 text-center">
        Fills missing fields only · Won't overwrite your existing data
      </p>
    </div>
  );
}