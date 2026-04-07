import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Search, SlidersHorizontal, X, ChevronUp, ChevronDown, ArrowUpDown,
  Save, Bookmark, Trash2, Check, LayoutGrid, List
} from "lucide-react";

const SAVED_VIEWS_KEY = "leads_saved_filter_views";

const SORT_OPTIONS = [
  { value: "created_date", label: "Date Added" },
  { value: "first_name", label: "Name" },
  { value: "company_name", label: "Company" },
  { value: "status", label: "Status" },
  { value: "priority", label: "Priority" },
  { value: "next_follow_up", label: "Follow Up Date" },
  { value: "last_contacted", label: "Last Contacted" },
  { value: "estimated_value", label: "Deal Value" },
  { value: "enrichment_score", label: "Enrichment Score" },
];

const ENRICHMENT_OPTIONS = [
  { value: "all", label: "Any Enrichment" },
  { value: "complete", label: "Fully Enriched" },
  { value: "partial", label: "Partially Enriched" },
  { value: "empty", label: "Not Enriched" },
];

const COMPANY_SIZE_OPTIONS = [
  { value: "all", label: "Any Size" },
  { value: "1-10", label: "1–10" },
  { value: "11-50", label: "11–50" },
  { value: "51-200", label: "51–200" },
  { value: "201-500", label: "201–500" },
  { value: "501-1000", label: "501–1000" },
  { value: "1000+", label: "1000+" },
];

const PRIORITY_OPTIONS = [
  { value: "all", label: "Any Priority" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const CONTACTED_OPTIONS = [
  { value: "all", label: "Any Time" },
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "overdue", label: "Overdue Follow-up" },
  { value: "never", label: "Never Contacted" },
];

const LANGUAGE_OPTIONS = [
  { value: "all", label: "Any Language" },
  { value: "english", label: "English" },
  { value: "spanish", label: "Spanish" },
  { value: "portuguese", label: "Portuguese" },
  { value: "french", label: "French" },
  { value: "german", label: "German" },
  { value: "other", label: "Other" },
];

const DEFAULT_FILTERS = {
  search: "",
  status: "all",
  source: "all",
  priority: "all",
  companySize: "all",
  enrichment: "all",
  contacted: "all",
  language: "all",
  country: "",
  industry: "",
  jobTitle: "",
  companyName: "",
  hasEmail: "all",
  hasPhone: "all",
  hasWebsite: "all",
  hasWhatsApp: "all",
  hasDecisionMaker: "all",
  minValue: "",
  maxValue: "",
  createdFrom: "",
  createdTo: "",
  sortField: "created_date",
  sortDir: "desc",
};

function computeEnrichmentScore(lead) {
  const fields = ["email", "phone", "job_title", "linkedin_url", "website", "industry", "company_size", "location"];
  return fields.filter(f => lead[f]).length;
}

export function applyFilters(leads, filters) {
  const now = new Date();
  return leads
    .filter(lead => {
      // Search
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const haystack = `${lead.first_name} ${lead.last_name} ${lead.company_name} ${lead.email || ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      // Status
      if (filters.status !== "all" && lead.status !== filters.status) return false;
      // Source
      if (filters.source !== "all" && lead.source !== filters.source) return false;
      // Priority
      if (filters.priority !== "all" && lead.priority !== filters.priority) return false;
      // Company size
      if (filters.companySize !== "all" && lead.company_size !== filters.companySize) return false;
      // Enrichment
      if (filters.enrichment !== "all") {
        const score = computeEnrichmentScore(lead);
        if (filters.enrichment === "complete" && score < 7) return false;
        if (filters.enrichment === "partial" && (score < 1 || score >= 7)) return false;
        if (filters.enrichment === "empty" && score > 0) return false;
      }
      // Language
      if (filters.language !== "all" && lead.language !== filters.language) return false;
      // Country (text match)
      if (filters.country && !(lead.country || "").toLowerCase().includes(filters.country.toLowerCase()) &&
          !(lead.location || "").toLowerCase().includes(filters.country.toLowerCase())) return false;
      // Industry (text match)
      if (filters.industry && !(lead.industry || "").toLowerCase().includes(filters.industry.toLowerCase())) return false;
      // Job title (text match)
      if (filters.jobTitle && !(lead.job_title || "").toLowerCase().includes(filters.jobTitle.toLowerCase())) return false;
      // Company name (text match)
      if (filters.companyName && !(lead.company_name || "").toLowerCase().includes(filters.companyName.toLowerCase())) return false;
      // Has email
      if (filters.hasEmail === "yes" && !lead.email) return false;
      if (filters.hasEmail === "no" && lead.email) return false;
      // Has phone
      if (filters.hasPhone === "yes" && !lead.phone) return false;
      if (filters.hasPhone === "no" && lead.phone) return false;
      // Has website
      if (filters.hasWebsite === "yes" && !lead.website) return false;
      if (filters.hasWebsite === "no" && lead.website) return false;
      // Has WhatsApp
      if (filters.hasWhatsApp === "yes" && !lead.whatsapp_detected) return false;
      if (filters.hasWhatsApp === "no" && lead.whatsapp_detected) return false;
      // Has Decision Maker (notes contain "decision maker research" OR tags include it)
      if (filters.hasDecisionMaker === "yes") {
        const hasIt = (lead.notes || "").toLowerCase().includes("decision maker") ||
          (lead.tags || []).some(t => (t || "").toLowerCase().includes("decision maker"));
        if (!hasIt) return false;
      }
      if (filters.hasDecisionMaker === "no") {
        const hasIt = (lead.notes || "").toLowerCase().includes("decision maker") ||
          (lead.tags || []).some(t => (t || "").toLowerCase().includes("decision maker"));
        if (hasIt) return false;
      }
      // Deal value range
      if (filters.minValue !== "" && (lead.estimated_value || 0) < Number(filters.minValue)) return false;
      if (filters.maxValue !== "" && (lead.estimated_value || 0) > Number(filters.maxValue)) return false;
      // Created date range
      if (filters.createdFrom && lead.created_date) {
        if (new Date(lead.created_date) < new Date(filters.createdFrom)) return false;
      }
      if (filters.createdTo && lead.created_date) {
        const toDate = new Date(filters.createdTo);
        toDate.setHours(23, 59, 59, 999);
        if (new Date(lead.created_date) > toDate) return false;
      }
      // Last contacted / follow-up
      if (filters.contacted !== "all") {
        if (filters.contacted === "never") {
          if (lead.last_contacted) return false;
        } else if (filters.contacted === "overdue") {
          if (!lead.next_follow_up) return false;
          if (new Date(lead.next_follow_up) >= now) return false;
        } else {
          if (!lead.last_contacted) return false;
          const d = new Date(lead.last_contacted);
          const diff = (now - d) / 86400000;
          if (filters.contacted === "today" && diff > 1) return false;
          if (filters.contacted === "week" && diff > 7) return false;
          if (filters.contacted === "month" && diff > 30) return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      let aVal, bVal;
      if (filters.sortField === "enrichment_score") {
        aVal = computeEnrichmentScore(a);
        bVal = computeEnrichmentScore(b);
      } else {
        aVal = a[filters.sortField] ?? "";
        bVal = b[filters.sortField] ?? "";
      }
      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();
      if (aVal < bVal) return filters.sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return filters.sortDir === "asc" ? 1 : -1;
      return 0;
    });
}

function loadSavedViews() {
  try { return JSON.parse(localStorage.getItem(SAVED_VIEWS_KEY) || "[]"); }
  catch { return []; }
}
function saveSavedViews(views) {
  localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(views));
}

export default function LeadFilterBar({ filters, onChange, viewMode, onViewModeChange, totalCount, filteredCount }) {
  const [savedViews, setSavedViews] = useState(loadSavedViews);
  const [saveViewName, setSaveViewName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const activeFilterCount = [
    filters.status !== "all",
    filters.source !== "all",
    filters.priority !== "all",
    filters.companySize !== "all",
    filters.enrichment !== "all",
    filters.contacted !== "all",
    filters.language !== "all",
    !!filters.country,
    !!filters.industry,
    !!filters.jobTitle,
    !!filters.companyName,
    filters.hasEmail !== "all",
    filters.hasPhone !== "all",
    filters.hasWebsite !== "all",
    filters.hasWhatsApp !== "all",
    filters.hasDecisionMaker !== "all",
    filters.minValue !== "",
    filters.maxValue !== "",
    !!filters.createdFrom,
    !!filters.createdTo,
  ].filter(Boolean).length;

  const set = (key, value) => onChange({ ...filters, [key]: value });

  const clearAll = () => onChange({ ...DEFAULT_FILTERS });

  const handleSaveView = () => {
    if (!saveViewName.trim()) return;
    const newView = { name: saveViewName.trim(), filters: { ...filters } };
    const updated = [...savedViews, newView];
    setSavedViews(updated);
    saveSavedViews(updated);
    setSaveViewName("");
    setShowSaveInput(false);
  };

  const handleDeleteView = (idx) => {
    const updated = savedViews.filter((_, i) => i !== idx);
    setSavedViews(updated);
    saveSavedViews(updated);
  };

  const handleApplyView = (view) => {
    onChange({ ...view.filters });
  };

  const isDefault = JSON.stringify(filters) === JSON.stringify(DEFAULT_FILTERS);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-4 space-y-3">
      {/* Saved Views */}
      {savedViews.length > 0 && (
        <div className="flex flex-wrap gap-2 pb-2 border-b border-slate-100">
          <span className="text-xs text-slate-400 font-medium self-center flex items-center gap-1">
            <Bookmark className="w-3 h-3" /> Saved Views:
          </span>
          {savedViews.map((view, idx) => (
            <div key={idx} className="flex items-center gap-0.5 bg-slate-100 rounded-full pl-3 pr-1 py-0.5">
              <button
                onClick={() => handleApplyView(view)}
                className="text-xs font-medium text-slate-700 hover:text-slate-900 pr-1"
              >
                {view.name}
              </button>
              <button
                onClick={() => handleDeleteView(idx)}
                className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 hover:text-rose-500 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main filter row */}
      <div className="flex flex-col gap-2">
        {/* Top row: search + controls */}
        <div className="flex gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search leads..."
              value={filters.search}
              onChange={e => set("search", e.target.value)}
              className="pl-10"
            />
            {filters.search && (
              <button onClick={() => set("search", "")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Advanced filters toggle */}
          <Popover open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <PopoverTrigger asChild>
              <Button variant={activeFilterCount > 0 ? "default" : "outline"} size="sm" className={`shrink-0 gap-1.5 ${activeFilterCount > 0 ? "bg-slate-900 text-white" : ""}`}>
                <SlidersHorizontal className="w-4 h-4" />
                <span className="hidden sm:inline">Filters</span>
                {activeFilterCount > 0 && (
                  <span className="bg-teal-400 text-slate-900 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
          <PopoverContent className="w-80 p-4 space-y-4 max-h-[80vh] overflow-y-auto" align="end">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-slate-900">Advanced Filters</h3>
              {activeFilterCount > 0 && (
                <button onClick={clearAll} className="text-xs text-rose-500 hover:text-rose-700 flex items-center gap-1">
                  <X className="w-3 h-3" /> Clear all
                </button>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">Priority</label>
                <Select value={filters.priority} onValueChange={v => set("priority", v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">Company Size</label>
                <Select value={filters.companySize} onValueChange={v => set("companySize", v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_SIZE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">Enrichment Status</label>
                <Select value={filters.enrichment} onValueChange={v => set("enrichment", v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENRICHMENT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">Last Contacted</label>
                <Select value={filters.contacted} onValueChange={v => set("contacted", v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTACTED_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">Lead Source</label>
                <Select value={filters.source} onValueChange={v => set("source", v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="leadiq">LeadIQ</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="trade_show">Trade Show</SelectItem>
                    <SelectItem value="cold_outreach">Cold Outreach</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">Language</label>
                <Select value={filters.language} onValueChange={v => set("language", v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LANGUAGE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">Country</label>
                <div className="relative">
                  <Input placeholder="Filter by country..." value={filters.country} onChange={e => set("country", e.target.value)} className="text-sm pr-7" />
                  {filters.country && <button onClick={() => set("country", "")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">Industry</label>
                <div className="relative">
                  <Input placeholder="Filter by industry..." value={filters.industry} onChange={e => set("industry", e.target.value)} className="text-sm pr-7" />
                  {filters.industry && <button onClick={() => set("industry", "")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">Job Title</label>
                <div className="relative">
                  <Input placeholder="Filter by job title..." value={filters.jobTitle} onChange={e => set("jobTitle", e.target.value)} className="text-sm pr-7" />
                  {filters.jobTitle && <button onClick={() => set("jobTitle", "")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">Company Name</label>
                <div className="relative">
                  <Input placeholder="Filter by company name..." value={filters.companyName} onChange={e => set("companyName", e.target.value)} className="text-sm pr-7" />
                  {filters.companyName && <button onClick={() => set("companyName", "")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">Deal Value (USD)</label>
                <div className="flex gap-2">
                  <Input placeholder="Min" type="number" value={filters.minValue} onChange={e => set("minValue", e.target.value)} className="text-sm" />
                  <Input placeholder="Max" type="number" value={filters.maxValue} onChange={e => set("maxValue", e.target.value)} className="text-sm" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">Contact Data</label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Has Email</span>
                    <Select value={filters.hasEmail} onValueChange={v => set("hasEmail", v)}>
                      <SelectTrigger className="w-24 h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any</SelectItem>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Has Phone</span>
                    <Select value={filters.hasPhone} onValueChange={v => set("hasPhone", v)}>
                      <SelectTrigger className="w-24 h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any</SelectItem>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Has Website</span>
                    <Select value={filters.hasWebsite} onValueChange={v => set("hasWebsite", v)}>
                      <SelectTrigger className="w-24 h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any</SelectItem>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">💬 Has WhatsApp</span>
                    <Select value={filters.hasWhatsApp} onValueChange={v => set("hasWhatsApp", v)}>
                      <SelectTrigger className="w-24 h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any</SelectItem>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">👤 Decision Maker</span>
                    <Select value={filters.hasDecisionMaker} onValueChange={v => set("hasDecisionMaker", v)}>
                      <SelectTrigger className="w-24 h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any</SelectItem>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">Date Created</label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400 mb-0.5 block">From</label>
                    <input
                      type="date"
                      value={filters.createdFrom}
                      onChange={e => set("createdFrom", e.target.value)}
                      className="w-full text-xs border border-input rounded-md px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400 mb-0.5 block">To</label>
                    <input
                      type="date"
                      value={filters.createdTo}
                      onChange={e => set("createdTo", e.target.value)}
                      className="w-full text-xs border border-input rounded-md px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Save view */}
            <div className="pt-3 border-t border-slate-100">
              {showSaveInput ? (
                <div className="flex gap-2">
                  <Input
                    placeholder="View name..."
                    value={saveViewName}
                    onChange={e => setSaveViewName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSaveView()}
                    className="text-sm h-8"
                    autoFocus
                  />
                  <Button size="sm" onClick={handleSaveView} className="h-8 bg-slate-900 hover:bg-slate-800 shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowSaveInput(false)} className="h-8 shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs gap-1.5"
                  onClick={() => setShowSaveInput(true)}
                  disabled={isDefault}
                >
                  <Save className="w-3.5 h-3.5" />
                  Save current view
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* View mode toggle */}
        <div className="flex border border-slate-200 rounded-lg overflow-hidden shrink-0">
          <button onClick={() => onViewModeChange("grid")} className={`px-3 py-2 ${viewMode === "grid" ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button onClick={() => onViewModeChange("list")} className={`px-3 py-2 ${viewMode === "list" ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

        {/* Second row: status + sort */}
        <div className="flex gap-2 flex-wrap">
          {/* Status */}
          <Select value={filters.status} onValueChange={v => set("status", v)}>
            <SelectTrigger className="w-32 sm:w-36 shrink-0">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="qualified">Qualified</SelectItem>
              <SelectItem value="proposal">Proposal</SelectItem>
              <SelectItem value="negotiation">Negotiation</SelectItem>
              <SelectItem value="won">Won</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort */}
          <div className="flex gap-1 shrink-0">
            <Select value={filters.sortField} onValueChange={v => set("sortField", v)}>
              <SelectTrigger className="w-36 sm:w-40">
                <ArrowUpDown className="w-3.5 h-3.5 mr-1.5 text-slate-400 shrink-0" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => set("sortDir", filters.sortDir === "asc" ? "desc" : "asc")}>
              {filters.sortDir === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {filters.status !== "all" && <FilterChip label={`Status: ${filters.status}`} onRemove={() => set("status", "all")} />}
          {filters.source !== "all" && <FilterChip label={`Source: ${filters.source}`} onRemove={() => set("source", "all")} />}
          {filters.priority !== "all" && <FilterChip label={`Priority: ${filters.priority}`} onRemove={() => set("priority", "all")} />}
          {filters.companySize !== "all" && <FilterChip label={`Size: ${filters.companySize}`} onRemove={() => set("companySize", "all")} />}
          {filters.enrichment !== "all" && <FilterChip label={`Enrichment: ${ENRICHMENT_OPTIONS.find(o => o.value === filters.enrichment)?.label}`} onRemove={() => set("enrichment", "all")} />}
          {filters.contacted !== "all" && <FilterChip label={`Contacted: ${CONTACTED_OPTIONS.find(o => o.value === filters.contacted)?.label}`} onRemove={() => set("contacted", "all")} />}
          {filters.language !== "all" && <FilterChip label={`Language: ${filters.language}`} onRemove={() => set("language", "all")} />}
          {filters.country && <FilterChip label={`Country: ${filters.country}`} onRemove={() => set("country", "")} />}
          {filters.industry && <FilterChip label={`Industry: ${filters.industry}`} onRemove={() => set("industry", "")} />}
          {filters.jobTitle && <FilterChip label={`Title: ${filters.jobTitle}`} onRemove={() => set("jobTitle", "")} />}
          {filters.companyName && <FilterChip label={`Company: ${filters.companyName}`} onRemove={() => set("companyName", "")} />}
          {filters.hasEmail !== "all" && <FilterChip label={`Email: ${filters.hasEmail}`} onRemove={() => set("hasEmail", "all")} />}
          {filters.hasPhone !== "all" && <FilterChip label={`Phone: ${filters.hasPhone}`} onRemove={() => set("hasPhone", "all")} />}
          {filters.hasWebsite !== "all" && <FilterChip label={`Website: ${filters.hasWebsite}`} onRemove={() => set("hasWebsite", "all")} />}
          {filters.hasWhatsApp !== "all" && <FilterChip label={`WhatsApp: ${filters.hasWhatsApp}`} onRemove={() => set("hasWhatsApp", "all")} />}
          {filters.hasDecisionMaker !== "all" && <FilterChip label={`Decision Maker: ${filters.hasDecisionMaker}`} onRemove={() => set("hasDecisionMaker", "all")} />}
          {filters.minValue !== "" && <FilterChip label={`Min $${filters.minValue}`} onRemove={() => set("minValue", "")} />}
          {filters.maxValue !== "" && <FilterChip label={`Max $${filters.maxValue}`} onRemove={() => set("maxValue", "")} />}
          {filters.createdFrom && <FilterChip label={`From: ${filters.createdFrom}`} onRemove={() => set("createdFrom", "")} />}
          {filters.createdTo && <FilterChip label={`To: ${filters.createdTo}`} onRemove={() => set("createdTo", "")} />}
          <button onClick={clearAll} className="text-xs text-slate-400 hover:text-rose-500 ml-1 flex items-center gap-0.5">
            <X className="w-3 h-3" /> Clear all
          </button>
        </div>
      )}

      {/* Result count */}
      <div className="flex items-center justify-between text-xs text-slate-400 pt-0.5">
        <span>
          Showing <span className="font-semibold text-slate-600">{filteredCount}</span> of <span className="font-semibold text-slate-600">{totalCount}</span> leads
          {activeFilterCount > 0 && <span className="ml-1 text-teal-600">· {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active</span>}
        </span>
      </div>
    </div>
  );
}

function FilterChip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 bg-teal-50 border border-teal-200 text-teal-700 text-xs rounded-full px-2.5 py-0.5 font-medium">
      {label}
      <button onClick={onRemove} className="hover:text-rose-500 transition-colors">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}