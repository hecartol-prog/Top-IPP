import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Trash2, Building2, MapPin, Mail, Phone } from "lucide-react";
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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Table Header */}
      <div className="grid grid-cols-[40px_2fr_2fr_1.2fr_1fr_1fr_120px] gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">
        <div className="flex items-center">
          <Checkbox
            checked={allSelected}
            ref={el => { if (el) el.indeterminate = someSelected; }}
            onCheckedChange={onToggleAll}
          />
        </div>
        <div>Name / Company</div>
        <div>Contact</div>
        <div>Status</div>
        <div>Priority</div>
        <div>Follow Up</div>
        <div className="text-right">Actions</div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-slate-50">
        {leads.map((lead) => {
          const isSelected = selectedIds.includes(lead.id);
          return (
            <div
              key={lead.id}
              className={`grid grid-cols-[40px_2fr_2fr_1.2fr_1fr_1fr_120px] gap-3 px-4 py-3 items-center hover:bg-slate-50 transition-colors group ${isSelected ? "bg-teal-50/40" : ""}`}
            >
              {/* Checkbox */}
              <div onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggleSelect(lead.id)}
                />
              </div>

              {/* Name / Company */}
              <div
                className="cursor-pointer min-w-0"
                onClick={() => onRowClick(lead)}
              >
                <p className="font-semibold text-slate-900 text-sm truncate group-hover:text-teal-600 transition-colors">
                  {lead.first_name} {lead.last_name}
                </p>
                <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                  <Building2 className="w-3 h-3 shrink-0" />
                  <span className="truncate">{lead.company_name || "—"}</span>
                </div>
              </div>

              {/* Contact */}
              <div className="min-w-0 space-y-0.5">
                {lead.email && (
                  <div className="flex items-center gap-1 text-xs text-slate-500 truncate">
                    <Mail className="w-3 h-3 shrink-0 text-slate-400" />
                    <span className="truncate">{lead.email}</span>
                  </div>
                )}
                {lead.phone && (
                  <div className="flex items-center gap-1 text-xs text-slate-500 truncate">
                    <Phone className="w-3 h-3 shrink-0 text-slate-400" />
                    <span className="truncate">{lead.phone}</span>
                  </div>
                )}
                {lead.location && !lead.email && !lead.phone && (
                  <div className="flex items-center gap-1 text-xs text-slate-500 truncate">
                    <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                    <span className="truncate">{lead.location}</span>
                  </div>
                )}
              </div>

              {/* Status */}
              <div>
                <Badge className={`${statusColors[lead.status]} border text-xs font-medium`}>
                  {lead.status?.replace("_", " ") || "new"}
                </Badge>
              </div>

              {/* Priority */}
              <div>
                <Badge className={`${priorityColors[lead.priority] || priorityColors.medium} border-0 text-xs font-medium`}>
                  {lead.priority || "medium"}
                </Badge>
              </div>

              {/* Follow Up */}
              <div className="text-xs text-slate-400">
                {lead.next_follow_up
                  ? format(new Date(lead.next_follow_up), "MMM d, yyyy")
                  : "—"}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-400 hover:text-slate-700"
                  onClick={() => onEdit(lead)}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-400 hover:text-rose-600"
                  onClick={() => onDelete(lead)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}