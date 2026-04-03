import React, { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { base44 } from "@/api/base44Client";
import { Loader2, CheckCircle2, Edit3, Plus, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const EDITABLE_FIELDS = [
  {
    key: "country",
    label: "Country",
    type: "text",
    placeholder: "e.g. Mexico",
  },
  {
    key: "industry",
    label: "Industry",
    type: "text",
    placeholder: "e.g. Automotive",
  },
  {
    key: "language",
    label: "Language",
    type: "select",
    options: ["english", "spanish", "portuguese", "french", "german", "other"],
  },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"],
  },
  {
    key: "priority",
    label: "Priority",
    type: "select",
    options: ["low", "medium", "high", "urgent"],
  },
  {
    key: "source",
    label: "Source",
    type: "select",
    options: ["apollo", "linkedin", "referral", "manual", "leadiq", "website", "trade_show", "cold_outreach", "other"],
  },
  {
    key: "temperature",
    label: "Temperature",
    type: "select",
    options: ["cold", "warm", "hot", "at_risk", "opportunity"],
  },
  {
    key: "company_size",
    label: "Company Size",
    type: "select",
    options: ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"],
  },
  {
    key: "location",
    label: "Location",
    type: "text",
    placeholder: "e.g. Monterrey, Mexico",
  },
  {
    key: "assigned_to",
    label: "Assigned To",
    type: "text",
    placeholder: "Email of team member",
  },
  {
    key: "tags",
    label: "Add Tags",
    type: "tags",
    placeholder: "Type and press Enter",
  },
];

export default function BatchEditDialog({ open, onClose, leads, onComplete }) {
  const [activeFields, setActiveFields] = useState({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [tagInput, setTagInput] = useState("");

  const toggleField = (key) => {
    setActiveFields(prev => {
      const next = { ...prev };
      if (next[key] !== undefined) {
        delete next[key];
      } else {
        next[key] = key === "tags" ? [] : "";
      }
      return next;
    });
  };

  const setValue = (key, value) => {
    setActiveFields(prev => ({ ...prev, [key]: value }));
  };

  const addTag = (key) => {
    const tag = tagInput.trim();
    if (!tag) return;
    const current = activeFields[key] || [];
    if (!current.includes(tag)) {
      setValue(key, [...current, tag]);
    }
    setTagInput("");
  };

  const removeTag = (key, tag) => {
    setValue(key, (activeFields[key] || []).filter(t => t !== tag));
  };

  const handleSave = async () => {
    const fieldsToPatch = Object.entries(activeFields).filter(([, v]) =>
      Array.isArray(v) ? true : v !== ""
    );
    if (fieldsToPatch.length === 0) return;

    setSaving(true);
    const BATCH_SIZE = 25;
    const delay = (ms) => new Promise(r => setTimeout(r, ms));

    for (let i = 0; i < leads.length; i += BATCH_SIZE) {
      const batch = leads.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(lead => {
        const patch = {};
        for (const [key, value] of fieldsToPatch) {
          if (key === "tags") {
            patch.tags = [...new Set([...(lead.tags || []), ...value])];
          } else {
            patch[key] = value;
          }
        }
        return base44.entities.Lead.update(lead.id, patch);
      }));
      if (i + BATCH_SIZE < leads.length) await delay(500);
    }
    setSaving(false);
    setDone(true);
  };

  const handleClose = () => {
    if (saving) return;
    setActiveFields({});
    setDone(false);
    setTagInput("");
    onClose();
  };

  const activeCount = Object.keys(activeFields).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg bg-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Edit3 className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Batch Edit</h2>
            <p className="text-sm text-slate-500">
              Apply changes to {leads.length} selected lead{leads.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {done ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-3">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <span>
                Updated {leads.length} lead{leads.length !== 1 ? "s" : ""} successfully!
              </span>
            </div>
            <Button className="w-full" variant="outline" onClick={() => { if (onComplete) onComplete(); handleClose(); }}>
              Close
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Field selection */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Select fields to edit
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {EDITABLE_FIELDS.map((f) => (
                  <label
                    key={f.key}
                    className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border transition-all ${
                      activeFields[f.key] !== undefined
                        ? "border-emerald-400 bg-emerald-50"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <Checkbox
                      checked={activeFields[f.key] !== undefined}
                      onCheckedChange={() => toggleField(f.key)}
                    />
                    <span className="text-sm text-slate-700">{f.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Value inputs for active fields */}
            {activeCount > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Set values
                </p>
                {EDITABLE_FIELDS.filter((f) => activeFields[f.key] !== undefined).map((f) => (
                  <div key={f.key} className="flex items-start gap-2">
                    <label className="text-sm font-medium text-slate-600 w-32 pt-2 shrink-0">
                      {f.label}
                    </label>
                    <div className="flex-1">
                      {f.type === "select" ? (
                        <Select
                          value={activeFields[f.key]}
                          onValueChange={(v) => setValue(f.key, v)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={`Select ${f.label.toLowerCase()}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {f.options.map((o) => (
                              <SelectItem key={o} value={o}>
                                {o.replace(/_/g, " ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : f.type === "tags" ? (
                        <div className="space-y-1.5">
                          <div className="flex gap-1">
                            <Input
                              value={tagInput}
                              onChange={(e) => setTagInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") { e.preventDefault(); addTag(f.key); }
                              }}
                              placeholder={f.placeholder}
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => addTag(f.key)}
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                          {(activeFields[f.key] || []).length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {(activeFields[f.key] || []).map((tag) => (
                                <Badge
                                  key={tag}
                                  variant="secondary"
                                  className="text-xs flex items-center gap-1"
                                >
                                  {tag}
                                  <button onClick={() => removeTag(f.key, tag)}>
                                    <X className="w-3 h-3" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <Input
                          value={activeFields[f.key]}
                          onChange={(e) => setValue(f.key, e.target.value)}
                          placeholder={f.placeholder}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button
                onClick={handleSave}
                disabled={
                  saving ||
                  activeCount === 0 ||
                  Object.entries(activeFields).every(([k, v]) =>
                    Array.isArray(v) ? v.length === 0 : v === ""
                  )
                }
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                ) : (
                  <><Edit3 className="w-4 h-4 mr-2" />Apply to {leads.length} Lead{leads.length !== 1 ? "s" : ""}</>
                )}
              </Button>
              <Button variant="outline" onClick={handleClose} disabled={saving}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}