import React, { useState, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Trash2, CheckCircle, Copy } from "lucide-react";

function findDuplicates(leads) {
  const groups = [];

  // Group by email
  const byEmail = {};
  leads.forEach(lead => {
    if (lead.email) {
      const key = lead.email.toLowerCase().trim();
      if (!byEmail[key]) byEmail[key] = [];
      byEmail[key].push(lead);
    }
  });

  // Group by full name + company
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
  const [deletingId, setDeletingId] = useState(null);
  const [dismissed, setDismissed] = useState(new Set());

  const duplicateGroups = useMemo(() => findDuplicates(leads), [leads]);
  const visibleGroups = duplicateGroups.filter(g =>
    !g.leads.every(l => dismissed.has(l.id))
  );

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Lead.delete(id),
    onSuccess: (_, id) => {
      setDeletingId(null);
      setDismissed(prev => new Set([...prev, id]));
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      onComplete?.();
    }
  });

  const handleDelete = (id) => {
    setDeletingId(id);
    deleteMutation.mutate(id);
  };

  const handleDismissGroup = (group) => {
    setDismissed(prev => new Set([...prev, ...group.leads.map(l => l.id)]));
  };

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
                  Keep the record you want and delete the others.
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
                      <div key={lead.id} className="flex items-center justify-between px-4 py-3 gap-3">
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
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="text-xs capitalize">{lead.status}</Badge>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={deletingId === lead.id}
                            onClick={() => handleDelete(lead.id)}
                            className="h-7 px-2 text-xs"
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            {deletingId === lead.id ? "Deleting..." : "Delete"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}