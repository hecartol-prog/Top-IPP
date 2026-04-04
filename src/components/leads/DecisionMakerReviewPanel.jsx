import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { UserPlus, CheckCircle2, Building2, Mail, Phone, Linkedin, Loader2, AlertCircle } from "lucide-react";

// confidence color
const confColor = {
  high: "bg-emerald-100 text-emerald-700 border-emerald-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-slate-100 text-slate-500 border-slate-200",
};

export default function DecisionMakerReviewPanel({ findings, leads, onSaved, onBack }) {
  // findings: array of { lead_id, company_name, decision_makers: [...] }
  // Build flat list of all candidates with selection state
  const allCandidates = findings.flatMap(f =>
    (f.decision_makers || []).map((dm, idx) => ({
      key: `${f.lead_id}_${idx}`,
      lead_id: f.lead_id,
      company_name: f.company_name,
      ...dm,
    }))
  );

  const [selected, setSelected] = useState(() => new Set(
    allCandidates.filter(c => c.confidence !== "low").map(c => c.key)
  ));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const toggle = (key) => setSelected(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const toggleAll = () => {
    if (selected.size === allCandidates.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allCandidates.map(c => c.key)));
    }
  };

  const handleSave = async () => {
    const toSave = allCandidates.filter(c => selected.has(c.key));
    if (toSave.length === 0) return;

    setSaving(true);
    let count = 0;

    for (const dm of toSave) {
      // Find the source lead to inherit company info
      const sourceLead = leads.find(l => l.id === dm.lead_id);

      const newLead = {
        first_name: dm.first_name || "",
        last_name: dm.last_name || "",
        job_title: dm.job_title || "",
        email: (dm.email || "").includes("@") ? dm.email.trim().toLowerCase() : "",
        phone: /\d{4,}/.test(dm.phone || "") ? dm.phone.trim() : "",
        linkedin_url: dm.linkedin_url || "",
        company_name: dm.company_name,
        website: sourceLead?.website || "",
        industry: sourceLead?.industry || "",
        company_size: sourceLead?.company_size || "",
        location: sourceLead?.location || "",
        country: sourceLead?.country || "",
        language: sourceLead?.language || "english",
        status: "new",
        source: "other",
        priority: "medium",
        notes: dm.source_note ? `Found via AI decision maker research: ${dm.source_note}` : "Found via AI decision maker research",
      };

      await base44.entities.Lead.create(newLead);
      count++;
    }

    setSavedCount(count);
    setSaving(false);
    setSaved(true);
    if (onSaved) onSaved(count);
  };

  if (saved) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">
              {savedCount} new lead{savedCount !== 1 ? "s" : ""} created successfully!
            </p>
            <p className="text-xs text-emerald-600">Decision makers have been added to your leads database.</p>
          </div>
        </div>
        <Button className="w-full" variant="outline" onClick={onBack}>Done</Button>
      </div>
    );
  }

  if (allCandidates.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-700">No decision makers could be found for the selected companies. Try companies with websites.</p>
        </div>
        <Button className="w-full" variant="outline" onClick={onBack}>Back</Button>
      </div>
    );
  }

  // Group by company for display
  const byCompany = findings
    .filter(f => (f.decision_makers || []).length > 0)
    .map(f => ({
      ...f,
      candidates: allCandidates.filter(c => c.lead_id === f.lead_id)
    }));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800">
            Found {allCandidates.length} decision maker{allCandidates.length !== 1 ? "s" : ""} across {byCompany.length} compan{byCompany.length !== 1 ? "ies" : "y"}
          </p>
          <p className="text-xs text-slate-500">{selected.size} selected to import as new leads</p>
        </div>
        <button onClick={toggleAll} className="text-xs text-blue-600 hover:underline">
          {selected.size === allCandidates.length ? "Deselect all" : "Select all"}
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto space-y-3 border border-slate-100 rounded-xl p-2">
        {byCompany.map(group => (
          <div key={group.lead_id}>
            <div className="flex items-center gap-1.5 px-2 py-1 mb-1">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{group.company_name}</span>
            </div>
            <div className="space-y-1.5 pl-1">
              {group.candidates.map(c => (
                <label
                  key={c.key}
                  className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                    selected.has(c.key) ? "border-violet-200 bg-violet-50" : "border-slate-100 hover:bg-slate-50"
                  }`}
                >
                  <Checkbox
                    checked={selected.has(c.key)}
                    onCheckedChange={() => toggle(c.key)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-800">
                        {[c.first_name, c.last_name].filter(Boolean).join(" ") || "Unknown"}
                      </span>
                      {c.confidence && (
                        <Badge className={`text-[10px] px-1.5 py-0 ${confColor[c.confidence] || confColor.low}`}>
                          {c.confidence}
                        </Badge>
                      )}
                    </div>
                    {c.job_title && <p className="text-xs text-slate-500 mt-0.5">{c.job_title}</p>}
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                      {c.email && (
                        <span className="flex items-center gap-1 text-[11px] text-slate-500">
                          <Mail className="w-3 h-3" />{c.email}
                        </span>
                      )}
                      {c.phone && (
                        <span className="flex items-center gap-1 text-[11px] text-slate-500">
                          <Phone className="w-3 h-3" />{c.phone}
                        </span>
                      )}
                      {c.linkedin_url && (
                        <span className="flex items-center gap-1 text-[11px] text-blue-500">
                          <Linkedin className="w-3 h-3" />LinkedIn
                        </span>
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-700">
          Selected contacts will be created as <strong>new leads</strong>. Existing leads will not be modified.
        </p>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} className="shrink-0">Back</Button>
        <Button
          onClick={handleSave}
          disabled={selected.size === 0 || saving}
          className="flex-1 bg-violet-600 hover:bg-violet-700"
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
          ) : (
            <><UserPlus className="w-4 h-4 mr-2" />Import {selected.size} Lead{selected.size !== 1 ? "s" : ""}</>
          )}
        </Button>
      </div>
    </div>
  );
}