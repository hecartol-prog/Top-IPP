import React, { useRef, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Trash2, Building2, MapPin, Mail, Phone, Globe, Calendar } from "lucide-react";
import { format } from "date-fns";

const statusColors = {
  new: "bg-blue-100 text-blue-700 border-blue-200",
  contacted: "bg-purple-100 text-purple-700 border-purple-200",
  qualified: "bg-amber-100 text-amber-700 border-amber-200",
  proposal: "bg-cyan-100 text-cyan-700 border-cyan-200",
  negotiation: "bg-orange-100 text-orange-700 border-orange-200",
  won: "bg-emerald-100 text-emerald-700 border-emerald-200",
  lost: "bg-slate-100 text-slate-700 border-slate-200"
};

const priorityColors = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-blue-100 text-blue-600",
  high: "bg-amber-100 text-amber-600",
  urgent: "bg-rose-100 text-rose-600"
};

export default function LeadListView({ leads, selectedIds, onToggleSelect, onToggleAll, onEdit, onDelete, onRowClick }) {
  const allSelected = leads.length > 0 && leads.every(l => selectedIds.includes(l.id));
  const someSelected = leads.some(l => selectedIds.includes(l.id)) && !allSelected;

  // Drag-to-select using refs to avoid stale closure issues
  const isDragging = useRef(false);
  const hasMoved = useRef(false); // only commit drag if mouse actually moved across rows
  const dragStartId = useRef(null);
  const dragMode = useRef("select");
  const dragRangeRef = useRef(new Set());
  const leadsRef = useRef(leads);
  const selectedIdsRef = useRef(selectedIds);
  leadsRef.current = leads;
  selectedIdsRef.current = selectedIds;

  const getLeadIndex = (id) => leadsRef.current.findIndex(l => l.id === id);

  const handleRowMouseDown = useCallback((e, leadId) => {
    // Only left-click, and only on the row itself (not checkbox td, buttons, or links)
    if (e.button !== 0) return;
    if (e.target.closest('[data-no-drag]')) return;
    if (e.target.closest("button") || e.target.closest("a")) return;

    e.preventDefault();
    isDragging.current = true;
    hasMoved.current = false;
    dragStartId.current = leadId;
    dragMode.current = selectedIdsRef.current.includes(leadId) ? "deselect" : "select";
    dragRangeRef.current = new Set([leadId]);
  }, []);

  const handleRowMouseEnter = useCallback((leadId) => {
    if (!isDragging.current) return;
    hasMoved.current = true; // mouse entered a different row = actual drag
    const startIdx = getLeadIndex(dragStartId.current);
    const endIdx = getLeadIndex(leadId);
    const min = Math.min(startIdx, endIdx);
    const max = Math.max(startIdx, endIdx);
    dragRangeRef.current = new Set(leadsRef.current.slice(min, max + 1).map(l => l.id));
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;

    // Only apply drag selection if the mouse actually moved across multiple rows
    if (hasMoved.current && dragRangeRef.current.size > 0) {
      dragRangeRef.current.forEach(id => {
        const alreadySelected = selectedIdsRef.current.includes(id);
        if (dragMode.current === "select" && !alreadySelected) onToggleSelect(id);
        if (dragMode.current === "deselect" && alreadySelected) onToggleSelect(id);
      });
    }

    dragRangeRef.current = new Set();
    dragStartId.current = null;
    hasMoved.current = false;
  }, [onToggleSelect]);

  return (
    <div
      className="select-none"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <table className="w-full min-w-[900px] text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="w-10 px-4 py-3 text-left">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={onToggleAll}
                />
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Name / Company</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Email</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Phone</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Location</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Website</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Country</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Language</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Status</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Priority</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Follow Up</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {leads.map((lead) => {
              const isSelected = selectedIds.includes(lead.id);
              return (
                <tr
                  key={lead.id}
                  className={`group transition-colors cursor-pointer ${isSelected ? "bg-teal-50/40" : "hover:bg-slate-50"}`}
                  onMouseDown={(e) => handleRowMouseDown(e, lead.id)}
                  onMouseEnter={() => handleRowMouseEnter(lead.id)}
                >
                  {/* data-no-drag prevents drag-select from starting on the checkbox cell */}
                  <td className="px-4 py-3" data-no-drag="true" onMouseDown={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleSelect(lead.id)}
                    />
                  </td>

                  <td className="px-3 py-3 min-w-[160px]" onClick={() => onRowClick(lead)}>
                    <p className="font-semibold text-slate-900 truncate group-hover:text-teal-600 transition-colors max-w-[180px]">
                      {lead.first_name} {lead.last_name}
                    </p>
                    {lead.company_name && (
                      <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                        <Building2 className="w-3 h-3 shrink-0" />
                        <span className="truncate max-w-[160px]">{lead.company_name}</span>
                      </div>
                    )}
                  </td>

                  <td className="px-3 py-3 min-w-[160px]">
                    {lead.email ? (
                      <a href={`mailto:${lead.email}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 text-xs text-slate-500 hover:text-teal-600 transition-colors max-w-[200px]">
                        <Mail className="w-3 h-3 shrink-0 text-slate-400" />
                        <span className="truncate">{lead.email}</span>
                      </a>
                    ) : <span className="text-xs text-slate-300">—</span>}
                  </td>

                  <td className="px-3 py-3 min-w-[130px]">
                    {lead.phone ? (
                      <a href={`tel:${lead.phone}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 text-xs text-slate-500 hover:text-teal-600 transition-colors">
                        <Phone className="w-3 h-3 shrink-0 text-slate-400" />
                        <span className="truncate">{lead.phone}</span>
                      </a>
                    ) : <span className="text-xs text-slate-300">—</span>}
                  </td>

                  <td className="px-3 py-3 min-w-[130px]">
                    {lead.location ? (
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                        <span className="truncate max-w-[140px]">{lead.location}</span>
                      </div>
                    ) : <span className="text-xs text-slate-300">—</span>}
                  </td>

                  <td className="px-3 py-3 min-w-[130px]">
                    {lead.website ? (
                      <a href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 text-xs text-slate-500 hover:text-teal-600 transition-colors">
                        <Globe className="w-3 h-3 shrink-0 text-slate-400" />
                        <span className="truncate max-w-[130px]">{lead.website.replace(/^https?:\/\//, "")}</span>
                      </a>
                    ) : <span className="text-xs text-slate-300">—</span>}
                  </td>

                  <td className="px-3 py-3 min-w-[110px]">
                    <span className="text-xs text-slate-500">{lead.country || <span className="text-slate-300">—</span>}</span>
                  </td>

                  <td className="px-3 py-3 min-w-[100px]">
                    <span className="text-xs text-slate-500 capitalize">{lead.language || <span className="text-slate-300">—</span>}</span>
                  </td>

                  <td className="px-3 py-3 whitespace-nowrap">
                    <Badge className={`${statusColors[lead.status] || statusColors.new} border text-xs font-medium`}>
                      {lead.status?.replace("_", " ") || "new"}
                    </Badge>
                  </td>

                  <td className="px-3 py-3 whitespace-nowrap">
                    <Badge className={`${priorityColors[lead.priority] || priorityColors.medium} border-0 text-xs font-medium`}>
                      {lead.priority || "medium"}
                    </Badge>
                  </td>

                  <td className="px-3 py-3 whitespace-nowrap">
                    {lead.next_follow_up ? (
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <Calendar className="w-3 h-3 shrink-0 text-slate-400" />
                        {format(new Date(lead.next_follow_up), "MMM d, yyyy")}
                      </div>
                    ) : <span className="text-xs text-slate-300">—</span>}
                  </td>

                  <td className="px-3 py-3" onMouseDown={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-700" onClick={() => onEdit(lead)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-rose-600" onClick={() => onDelete(lead)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
      </table>
    </div>
  );
}