import React, { useState, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Trash2, CheckCircle, Copy, Loader2 } from "lucide-react";

function findDuplicates(leads) {
  const groups = [];
  const byEmail = {};
  leads.forEach(lead => {
    if (lead.email) {
      const key = lead.email.toLowerCase().trim();
      if (!byEmail[key]) byEmail[key] = [];
      byEmail[key].push(lead);
    }
  });

  const byNameCompany = {};
  leads.forEach(lead => {
    const name = `${lead.first_name || ""} ${lead.last_name || ""}`.toLowerCase().trim();
    const company = (lead.company_name || "").toLowerCase().trim();
    if (name && company) {
      const key = `${name}||${company}`;
      if (!byNameCompany[key]) byNameCompany[key] = [];
      byNameCompany[key].push(lead);
    }
  });

  const seenIds = new Set();

  Object.entries(byEmail).forEach(([email, group]) => {
    if (group.length > 1) {
      const ids = group.map(l => l.id).sort().join(",");
      if (!seenIds.has(ids)) {
        seenIds.add(ids);
        groups.push({ reason: `Same email: ${email}`, leads: group });
      }
    }
  });

  Object.entries(byNameCompany).forEach(([key, group]) => {
    if (group.length > 1) {
      const ids = group.map(l => l.id).sort().join(",");
      if (!seenIds.has(ids)) {
        seenIds.add(ids);
        const [name] = key.split("||");
        groups.push({ reason: `Same name & company: ${name}`, leads: group });
      }
    }
  });

  return groups;
}

export default function DuplicateChecker({ open, onClose, leads, onComplete }) {
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState(new Set());
  const [selected, setSelected] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const duplicateGroups = useMemo(() => findDuplicates(leads), [leads]);
  const visibleGroups = duplicateGroups.filter(g =>
    !g.leads.every(l => dismissed.has(l.id))
  );

  // All visible lead IDs (excluding dismissed)
  const allVisibleIds = visibleGroups.flatMap(g => g.leads.filter(l => !dismissed.has(l.id)).map(l => l.id));

  const deleteMutation = useMutation({
    mutationFn: async (ids) => {
      for (const id of ids) await base44.entities.Lead.delete(id);
    },
    onSuccess: (_, ids) => {
      setDismissed(prev => new Set([...prev, ...ids]));
      setSelected(prev => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n; });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      onComplete?.();
      setBulkDeleting(false);
    }
  });

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allVisibleIds.every(id => selected.has(id))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allVisibleIds));
    }
  };

  const handleBulkDelete = () => {
    setBulkDeleting(true);
    deleteMutation.mutate([...selected]);
  };

  const handleDismissGroup = (group) => {
    setDismissed(prev => new Set([...prev, ...group.leads.map(l => l.id)]));
    setSelected(prev => { const n = new Set(prev); group.leads.forEach(l => n.delete(l.id)); return n; });
  };

  const selectedCount = selected.size;
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => selected.has(id));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white max-h-[80vh] flex flex-col">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Copy className="w-5 h-5 text-blue-600" /> Duplicate Contact Checker
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Detected by matching email addresses and name + company combinations.
          </p>
        </div>

        <div className="overflow-y-auto flex-1 space-y-4 pr-1">
          {visibleGroups.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-900">No duplicates found!</h3>
              <p className="text-slate-500 text-sm mt-1">All {leads.length} contacts appear to be unique.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <p className="text-sm text-amber-800">
                  Found <strong>{visibleGroups.length}</strong> duplicate group{visibleGroups.length > 1 ? "s" : ""}.
                  Check the contacts you want to delete, then click "Delete Selected".
                </p>
              </div>

              {visibleGroups.map((group, gi) => (
                <div key={gi} className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-600">{group.reason}</span>
                    <button
                      onClick={() => handleDismissGroup(group)}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      Dismiss
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {group.leads.filter(l => !dismissed.has(l.id)).map((lead, li) => (
                      <div
                        key={lead.id}
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors ${selected.has(lead.id) ? "bg-red-50" : ""}`}
                        onClick={() => toggleSelect(lead.id)}
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(lead.id)}
                          onChange={() => toggleSelect(lead.id)}
                          onClick={e => e.stopPropagation()}
                          className="w-4 h-4 accent-red-500 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-slate-900 text-sm truncate">
                              {lead.first_name} {lead.last_name}
                            </p>
                            {li === 0 && (
                              <Badge className="bg-blue-100 text-blue-700 border-0 text-[10px]">oldest</Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 truncate">{lead.company_name}</p>
                          {lead.email && <p className="text-xs text-slate-400 truncate">{lead.email}</p>}
                        </div>
                        <Badge variant="outline" className="text-xs capitalize shrink-0">{lead.status}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {visibleGroups.length > 0 && (
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 accent-red-500"
                />
                Select all ({allVisibleIds.length})
              </label>
              {selectedCount > 0 && (
                <span className="text-xs text-red-600 font-medium">{selectedCount} selected</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Close</Button>
              <Button
                variant="destructive"
                disabled={selectedCount === 0 || bulkDeleting}
                onClick={handleBulkDelete}
              >
                {bulkDeleting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting...</>
                ) : (
                  <><Trash2 className="w-4 h-4 mr-2" />Delete {selectedCount > 0 ? selectedCount : ""} Selected</>
                )}
              </Button>
            </div>
          </div>
        )}

        {visibleGroups.length === 0 && (
          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}