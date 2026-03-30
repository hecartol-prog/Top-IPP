import React from "react";
import { Flame, Zap, Snowflake, AlertTriangle, TrendingUp } from "lucide-react";

const CONFIG = {
  hot:         { label: "Hot",         icon: Flame,         className: "bg-red-100 text-red-700 border-red-200" },
  warm:        { label: "Warm",        icon: Zap,           className: "bg-orange-100 text-orange-700 border-orange-200" },
  cold:        { label: "Cold",        icon: Snowflake,     className: "bg-slate-100 text-slate-500 border-slate-200" },
  at_risk:     { label: "At Risk",     icon: AlertTriangle, className: "bg-amber-100 text-amber-700 border-amber-200" },
  opportunity: { label: "Opportunity", icon: TrendingUp,    className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

export default function LeadTemperatureBadge({ temperature, size = "sm" }) {
  if (!temperature) return null;
  const cfg = CONFIG[temperature] || CONFIG.cold;
  const Icon = cfg.icon;

  return (
    <span className={`inline-flex items-center gap-1 font-semibold border rounded-full ${cfg.className} ${
      size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1"
    }`}>
      <Icon className={size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3"} />
      {cfg.label}
    </span>
  );
}