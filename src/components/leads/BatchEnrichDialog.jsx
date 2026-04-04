import React, { useState, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import {
  Zap, CheckCircle2, XCircle, Loader2, AlertCircle,
  Rocket, RefreshCw, Users, ChevronRight, UserPlus, Building2, Mail, Phone, Linkedin, ArrowLeft
} from "lucide-react";

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

// ── Decision Makers sub-components ─────────────────────────────────────────

function DecisionMakerCard({ person, companyName, checked, onChange }) {
  return (
    <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors">
      <Checkbox
        checked={checked}
        onCheckedChange={onChange}
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-800 text-sm">
            {person.first_name} {person.last_name}
          </span>
          {person.job_title && (
            <Badge variant="outline" className="text-xs text-slate-600">{person.job_title}</Badge>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5">{companyName}</p>
        <div className="flex flex-wrap gap-2 mt-1.5">
          {person.email && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Mail className="w-3 h-3" />{person.email}
            </span>
          )}
          {person.phone && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Phone className="w-3 h-3" />{person.phone}
            </span>
          )}
          {person.linkedin_url && (
            <span className="flex items-center gap-1 text-xs text-blue-600">
              <Linkedin className="w-3 h-3" />LinkedIn
            </span>
          )}
        </div>
      </div>
    </label>
  );
}

function DecisionMakerSelectionStep({ results, onBack, onImport, importing }) {
  // results: [{lead_id, company_name, country, website, decision_makers: [...]}]
  const allPeople = results.flatMap(r =>
    (r.decision_makers || []).map(p => ({
      ...p,
      _company_name: r.company_name,
      _country: r.country,
      _website: r.website,
      _lead_source_id: r.lead_id,
      _key: `${r.lead_id}::${p.first_name}::${p.last_name}`
    }))
  );

  const [selected, setSelected] = useState(new Set(allPeople.map(p => p._key)));

  const toggleAll = () => {
    if (selected.size === allPeople.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allPeople.map(p => p._key)));
    }
  };

  const togglePerson = (key) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const selectedPeople = allPeople.filter(p => selected.has(p._key));

  if (allPeople.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          No decision makers found across the selected companies.
        </div>
        <Button variant="outline" className="w-full" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800">
          {allPeople.length} decision maker{allPeople.length !== 1 ? 's' : ''} found
        </p>
        <button
          onClick={toggleAll}
          className="text-xs text-blue-600 hover:underline"
        >
          {selected.size === allPeople.length ? 'Deselect all' : 'Select all'}
        </button>
      </div>

      <div className="max-h-72 overflow-y-auto space-y-1.5 border border-slate-100 rounded-lg p-2">
        {results.map(r => {
          const makers = (r.decision_makers || []);
          if (makers.length === 0) return null;
          return (
            <div key={r.lead_id}>
              <div className="flex items-center gap-2 px-1 py-1 mb-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{r.company_name}</span>
              </div>
              {makers.map(p => {
                const key = `${r.lead_id}::${p.first_name}::${p.last_name}`;
                return (
                  <DecisionMakerCard
                    key={key}
                    person={p}
                    companyName={r.company_name}
                    checked={selected.has(key)}
                    onChange={() => togglePerson(key)}
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" onClick={onBack} className="gap-1">
          <ArrowLeft className="w-4 h-4" />Back
        </Button>
        <Button
          className="flex-1 bg-emerald-600 hover:bg-emerald-700"
          onClick={() => onImport(selectedPeople)}
          disabled={selected.size === 0 || importing}
        >
          {importing
            ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
            : <UserPlus className="w-4 h-4 mr-2" />
          }
          Import {selected.size} Lead{selected.size !== 1 ? 's' : ''}
        </Button>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function BatchEnrichDialog({ open, onClose, leads, onComplete }) {
  const [enrichMode, setEnrichMode] = useState("apollo"); // "apollo" | "ai" | "decision_makers"
  const [selectedFields, setSelectedFields] = useState(
    new Set(["email", "phone", "website", "industry"])
  );
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [results, setResults] = useState([]);
  const [current, setCurrent] = useState(0);

  // Decision makers state
  const [dmStep, setDmStep] = useState("config"); // "config" | "running" | "selection" | "importing" | "done"
  const [dmResults, setDmResults] = useState([]); // [{lead_id, company_name, decision_makers:[...]}]
  const [dmCurrent, setDmCurrent] = useState(0);
  const [dmImported, setDmImported] = useState(0);
  const [dmErrors, setDmErrors] = useState(0);

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

  // Decision Makers: find step
  const handleFindDecisionMakers = async () => {
    setDmStep("running");
    setDmCurrent(0);
    setDmResults([]);

    const res = [];
    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      setDmCurrent(i + 1);
      try {
        const response = await base44.functions.invoke("findDecisionMakers", { lead_id: lead.id });
        if (response?.data?.success) {
          res.push({
            lead_id: lead.id,
            company_name: response.data.company_name || lead.company_name,
            country: response.data.country,
            website: response.data.website,
            decision_makers: response.data.decision_makers || [],
          });
        }
      } catch {
        res.push({ lead_id: lead.id, company_name: lead.company_name, decision_makers: [] });
      }
      setDmResults([...res]);
      if (i < leads.length - 1) await delay(1000);
    }

    setDmStep("selection");
  };

  // Decision Makers: import selected people as new leads
  const handleImportDecisionMakers = async (people) => {
    setDmStep("importing");
    let imported = 0;
    let errors = 0;

    for (const p of people) {
      try {
        await base44.entities.Lead.create({
          first_name: p.first_name,
          last_name: p.last_name,
          job_title: p.job_title || '',
          email: p.email || '',
          phone: p.phone || '',
          linkedin_url: p.linkedin_url || '',
          company_name: p._company_name,
          country: p._country || '',
          website: p._website || '',
          status: 'new',
          source: 'manual',
          priority: 'medium',
        });
        imported++;
      } catch {
        errors++;
      }
    }

    setDmImported(imported);
    setDmErrors(errors);
    setDmStep("done");
    if (onComplete) onComplete();
  };

  const successCount = results.filter(r => r.status === "success" && r.fields_updated.length > 0).length;
  const totalUpdated = results.reduce((acc, r) => acc + r.fields_updated.length, 0);

  const handleClose = () => {
    if (running || dmStep === "running" || dmStep === "importing") return;
    setResults([]);
    setStarted(false);
    setCurrent(0);
    setDmStep("config");
    setDmResults([]);
    setDmCurrent(0);
    setDmImported(0);
    setDmErrors(0);
    onClose();
  };

  const isDecisionMakersMode = enrichMode === "decision_makers";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg bg-white">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isDecisionMakersMode ? 'bg-emerald-100' : 'bg-violet-100'
          }`}>
            {isDecisionMakersMode
              ? <Users className="w-5 h-5 text-emerald-600" />
              : <Zap className="w-5 h-5 text-violet-600" />
            }
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Batch AI Enrichment</h2>
            <p className="text-sm text-slate-500">{leads.length} lead{leads.length !== 1 ? "s" : ""} selected</p>
          </div>
        </div>

        {/* ── Decision Makers mode screens ── */}
        {isDecisionMakersMode && dmStep === "running" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
              <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
              Searching decision makers for company {dmCurrent} of {leads.length}…
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 border border-slate-100 rounded-lg p-2">
              {dmResults.map(r => (
                <div key={r.lead_id} className="flex items-center justify-between text-sm px-2 py-1">
                  <span className="text-slate-700 truncate">{r.company_name}</span>
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                    {r.decision_makers.length} found
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {isDecisionMakersMode && dmStep === "selection" && (
          <DecisionMakerSelectionStep
            results={dmResults}
            onBack={() => setDmStep("config")}
            onImport={handleImportDecisionMakers}
            importing={false}
          />
        )}

        {isDecisionMakersMode && dmStep === "importing" && (
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
            <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
            Importing decision makers as new leads…
          </div>
        )}

        {isDecisionMakersMode && dmStep === "done" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              Done! Imported {dmImported} new lead{dmImported !== 1 ? 's' : ''}.
              {dmErrors > 0 && ` (${dmErrors} failed)`}
            </div>
            <Button className="w-full" variant="outline" onClick={handleClose}>Close</Button>
          </div>
        )}

        {/* ── Config screen (shown for all modes when not started, or DM mode on config step) ── */}
        {(!started || (isDecisionMakersMode && dmStep === "config")) && !(isDecisionMakersMode && dmStep !== "config") && (
          <div className="space-y-4">
            {/* Mode selection */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Enrichment type</p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setEnrichMode("apollo")}
                  className={`p-3 rounded-lg border text-left transition-all ${enrichMode === "apollo" ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Rocket className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-semibold text-slate-800">Apollo.io</span>
                  </div>
                  <p className="text-xs text-slate-500">Verified contact data</p>
                </button>
                <button
                  onClick={() => setEnrichMode("ai")}
                  className={`p-3 rounded-lg border text-left transition-all ${enrichMode === "ai" ? "border-violet-500 bg-violet-50" : "border-slate-200 hover:bg-slate-50"}`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Zap className="w-4 h-4 text-violet-600" />
                    <span className="text-xs font-semibold text-slate-800">AI Search</span>
                  </div>
                  <p className="text-xs text-slate-500">Google AI research</p>
                </button>
                <button
                  onClick={() => { setEnrichMode("decision_makers"); setDmStep("config"); }}
                  className={`p-3 rounded-lg border text-left transition-all ${enrichMode === "decision_makers" ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:bg-slate-50"}`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Users className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-semibold text-slate-800">Decision Makers</span>
                  </div>
                  <p className="text-xs text-slate-500">Find key contacts</p>
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

            {/* Decision makers description */}
            {enrichMode === "decision_makers" && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 space-y-1">
                <p className="text-xs font-semibold text-emerald-800">What this does:</p>
                <ul className="text-xs text-emerald-700 space-y-0.5 list-disc pl-4">
                  <li>Searches the web for key contacts at each company (CEO, Procurement, Engineering)</li>
                  <li>Shows you all found contacts to review & select</li>
                  <li>Imports selected contacts as new leads in your CRM</li>
                </ul>
              </div>
            )}

            {/* Only missing toggle (not for DM mode) */}
            {enrichMode !== "decision_makers" && (
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={onlyMissing} onCheckedChange={setOnlyMissing} />
                <span className="text-sm text-slate-700">Only fill in <strong>missing</strong> fields</span>
              </label>
            )}

            {enrichMode !== "decision_makers" && (
              <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700">
                  {enrichMode === "apollo"
                    ? "Apollo.io enrichment uses verified data. Rate-limited to avoid throttling."
                    : "AI web search enriches each lead one at a time. May take a while for large batches."}
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              {enrichMode === "decision_makers" ? (
                <Button
                  onClick={handleFindDecisionMakers}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Find Decision Makers for {leads.length} Compan{leads.length !== 1 ? 'ies' : 'y'}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={() => handleRun(0)}
                  disabled={enrichMode === "ai" && selectedFields.size === 0}
                  className={`flex-1 ${enrichMode === "apollo" ? "bg-blue-600 hover:bg-blue-700" : "bg-violet-600 hover:bg-violet-700"}`}
                >
                  {enrichMode === "apollo" ? <Rocket className="w-4 h-4 mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                  Enrich {leads.length} Lead{leads.length !== 1 ? "s" : ""}
                </Button>
              )}
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
            </div>
          </div>
        )}

        {/* ── Standard enrichment results (Apollo / AI) ── */}
        {started && !isDecisionMakersMode && (
          <div className="space-y-3">
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
              {running && (
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