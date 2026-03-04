import React, { useRef, useState, useCallback } from "react";
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
  const allSelected = leads.length > 0 && selectedIds.length === leads.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < leads.length;

  // Drag selection state
  const isDragging = useRef(false);
  const dragStartIndex = useRef(null);
  const dragMode = useRef(null); // "select" | "deselect"
  const [dragRange, setDragRange] = useState(null); // { start, end }

  const getRange = (a, b) => {
    const min = Math.min(a, b);
    const max = Math.max(a, b);
    return { start: min, end: max };
  };

  const handleRowMouseDown = useCallback((e, index, leadId) => {
    // Only trigger on left mouse button, not on interactive elements
    if (e.button !== 0) return;
    if (e.target.closest("a, button, input, [data-no-drag]")) return;

    e.preventDefault();
    isDragging.current = true;
    dragStartIndex.current = index;
    dragMode.current = selectedIds.includes(leadId) ? "deselect" : "select";
    setDragRange({ start: index, end: index });

    // Apply to the start row immediately
    onToggleSelect(leadId);
  }, [selectedIds, onToggleSelect]);

  const handleRowMouseEnter = useCallback((e, index) => {
    if (!isDragging.current) return;
    setDragRange(getRange(dragStartIndex.current, index));

    // Select/deselect everything in the current drag range
    const { start, end } = getRange(dragStartIndex.current, index);
    for (let i = start; i <= end; i++) {
      const id = leads[i]?.id;
      if (!id) continue;
      const isSelected = selectedIds.includes(id);
      if (dragMode.current === "select" && !isSelected) onToggleSelect(id);
      if (dragMode.current === "deselect" && isSelected) onToggleSelect(id);
    }
  }, [leads, selectedIds, onToggleSelect]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    dragStartIndex.current = null;
    dragMode.current = null;
    setDragRange(null);
  }, []);

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden select-none"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Drag hint */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-xs text-slate-400 flex items-center gap-1.5">
        <span>💡 Tip: Click & drag rows to select multiple leads</span>
      </div>

      {/* Scrollable table wrapper */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          {/* Header */}
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="w-10 px-4 py-3 text-left" data-no-drag>
                <Checkbox
                  checked={allSelected}
                  ref={el => { if (el) el.indeterminate = someSelected; }}
                  onCheckedChange={onToggleAll}
                />
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Name / Company</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Email</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Phone</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Location</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Website</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Status</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Priority</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Follow Up</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Actions</th>
            </tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-slate-100">
            {leads.map((lead, index) => {
              const isSelected = selectedIds.includes(lead.id);
              const isInDragRange = dragRange && index >= dragRange.start && index <= dragRange.end;

              return (
                <tr
                  key={lead.id}
                  className={`group transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-teal-50/60 border-l-2 border-l-teal-400"
                      : isInDragRange
                      ? "bg-teal-50/30"
                      : "hover:bg-slate-50"
                  }`}
                  onMouseDown={(e) => handleRowMouseDown(e, index, lead.id)}
                  onMouseEnter={(e) => handleRowMouseEnter(e, index)}
                >
                  {/* Checkbox */}
                  <td className="px-4 py-3" data-no-drag onClick={(e) => { e.stopPropagation(); onToggleSelect(lead.id); }}>
                    <Checkbox checked={isSelected} onCheckedChange={() => onToggleSelect(lead.id)} />
                  </td>

                  {/* Name / Company */}
                  <td
                    className="px-3 py-3 min-w-[160px]"
                    onClick={() => onRowClick(lead)}
                  >
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

                  {/* Email */}
                  <td className="px-3 py-3 min-w-[160px]">
                    {lead.email ? (
                      <a
                        href={`mailto:${lead.email}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-teal-600 transition-colors max-w-[200px]"
                      >
                        <Mail className="w-3 h-3 shrink-0 text-slate-400" />
                        <span className="truncate">{lead.email}</span>
                      </a>
                    ) : <span className="text-xs text-slate-300">—</span>}
                  </td>

                  {/* Phone */}
                  <td className="px-3 py-3 min-w-[130px]">
                    {lead.phone ? (
                      <a
                        href={`tel:${lead.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-teal-600 transition-colors"
                      >
                        <Phone className="w-3 h-3 shrink-0 text-slate-400" />
                        <span className="truncate">{lead.phone}</span>
                      </a>
                    ) : <span className="text-xs text-slate-300">—</span>}
                  </td>

                  {/* Location */}
                  <td className="px-3 py-3 min-w-[130px]">
                    {lead.location ? (
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                        <span className="truncate max-w-[140px]">{lead.location}</span>
                      </div>
                    ) : <span className="text-xs text-slate-300">—</span>}
                  </td>

                  {/* Website */}
                  <td className="px-3 py-3 min-w-[130px]">
                    {lead.website ? (
                      <a
                        href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-teal-600 transition-colors"
                      >
                        <Globe className="w-3 h-3 shrink-0 text-slate-400" />
                        <span className="truncate max-w-[130px]">{lead.website.replace(/^https?:\/\//, "")}</span>
                      </a>
                    ) : <span className="text-xs text-slate-300">—</span>}
                  </td>

                  {/* Status */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <Badge className={`${statusColors[lead.status] || statusColors.new} border text-xs font-medium`}>
                      {lead.status?.replace("_", " ") || "new"}
                    </Badge>
                  </td>

                  {/* Priority */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <Badge className={`${priorityColors[lead.priority] || priorityColors.medium} border-0 text-xs font-medium`}>
                      {lead.priority || "medium"}
                    </Badge>
                  </td>

                  {/* Follow Up */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    {lead.next_follow_up ? (
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <Calendar className="w-3 h-3 shrink-0 text-slate-400" />
                        {format(new Date(lead.next_follow_up), "MMM d, yyyy")}
                      </div>
                    ) : <span className="text-xs text-slate-300">—</span>}
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-3" data-no-drag onClick={(e) => e.stopPropagation()}>
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
    </div>
  );
}