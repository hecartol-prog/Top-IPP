import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Zap, Flame, Clock, AlertTriangle, UserPlus, ArrowRight } from "lucide-react";
import { differenceInDays, isToday, isPast, parseISO } from "date-fns";

const TEMPERATURE_COLORS = {
  hot: "bg-red-100 text-red-700 border-red-200",
  warm: "bg-orange-100 text-orange-700 border-orange-200",
  cold: "bg-slate-100 text-slate-600 border-slate-200",
  at_risk: "bg-amber-100 text-amber-700 border-amber-200",
  opportunity: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const TEMPERATURE_ICONS = {
  hot: <Flame className="w-3 h-3" />,
  at_risk: <AlertTriangle className="w-3 h-3" />,
  warm: <Zap className="w-3 h-3" />,
};

function ActionItem({ lead, reason, icon, urgency }) {
  const urgencyColors = {
    critical: "border-l-red-500",
    high: "border-l-orange-400",
    medium: "border-l-amber-400",
    low: "border-l-slate-300",
  };

  return (
    <Link
      to={createPageUrl("Leads") + `?id=${lead.id}`}
      className={`flex items-center gap-3 px-4 py-3 border-l-4 ${urgencyColors[urgency] || urgencyColors.medium} bg-white hover:bg-slate-50 rounded-r-lg transition-colors`}
    >
      <div className="shrink-0 text-slate-400">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 truncate">
          {lead.first_name} {lead.last_name}
        </p>
        <p className="text-xs text-slate-500 truncate">{lead.company_name}</p>
        <p className="text-xs text-slate-600 mt-0.5 font-medium">{reason}</p>
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1">
        {lead.temperature && TEMPERATURE_COLORS[lead.temperature] && (
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${TEMPERATURE_COLORS[lead.temperature]}`}>
            {TEMPERATURE_ICONS[lead.temperature]}
            {lead.temperature}
          </span>
        )}
        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
      </div>
    </Link>
  );
}

export default function TodayActionsWidget() {
  const { data: leads = [] } = useQuery({
    queryKey: ["leads"],
    queryFn: () => base44.entities.Lead.list("-created_date"),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => base44.entities.Task.list("-created_date", 200),
  });

  const actions = useMemo(() => {
    const today = new Date();
    const items = [];

    // 1. Hot leads
    leads
      .filter((l) => l.temperature === "hot")
      .slice(0, 3)
      .forEach((l) => items.push({ lead: l, reason: l.next_action || "Hot lead — take action now", icon: <Flame className="w-4 h-4 text-red-500" />, urgency: "critical", priority: 1 }));

    // 2. Follow-up due today or overdue
    leads
      .filter((l) => {
        if (!l.next_follow_up) return false;
        const d = parseISO(l.next_follow_up);
        return isToday(d) || isPast(d);
      })
      .filter((l) => l.temperature !== "hot") // already covered
      .slice(0, 4)
      .forEach((l) => {
        const d = parseISO(l.next_follow_up);
        const isOverdue = isPast(d) && !isToday(d);
        items.push({
          lead: l,
          reason: isOverdue ? `⚠ Overdue follow-up — ${l.next_action || "contact now"}` : `Follow-up due today`,
          icon: <Clock className={`w-4 h-4 ${isOverdue ? "text-orange-500" : "text-amber-500"}`} />,
          urgency: isOverdue ? "high" : "medium",
          priority: 2,
        });
      });

    // 3. Sequence steps due today
    leads
      .filter((l) => {
        if (!l.sequence_next_send) return false;
        const d = parseISO(l.sequence_next_send);
        return isToday(d) || isPast(d);
      })
      .slice(0, 3)
      .forEach((l) =>
        items.push({
          lead: l,
          reason: `Sequence step ${l.sequence_step || 1} due — send follow-up`,
          icon: <Zap className="w-4 h-4 text-violet-500" />,
          urgency: "high",
          priority: 2,
        })
      );

    // 4. At-risk leads
    leads
      .filter((l) => l.temperature === "at_risk")
      .slice(0, 3)
      .forEach((l) => {
        const days = l.last_activity_date ? differenceInDays(today, parseISO(l.last_activity_date)) : null;
        items.push({
          lead: l,
          reason: days ? `${days} days without activity — re-engage` : "No recent activity",
          icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
          urgency: "medium",
          priority: 3,
        });
      });

    // 5. New leads never contacted
    leads
      .filter((l) => l.status === "new" && !l.last_activity_date && !l.last_contacted)
      .slice(0, 3)
      .forEach((l) =>
        items.push({
          lead: l,
          reason: "New lead — not yet contacted",
          icon: <UserPlus className="w-4 h-4 text-teal-500" />,
          urgency: "low",
          priority: 4,
        })
      );

    // Deduplicate by lead id, keep highest priority
    const seen = new Set();
    return items
      .sort((a, b) => a.priority - b.priority)
      .filter((item) => {
        if (seen.has(item.lead.id)) return false;
        seen.add(item.lead.id);
        return true;
      })
      .slice(0, 8);
  }, [leads, tasks]);

  return (
    <Card className="bg-white border-0 shadow-sm">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">Today's Sales Actions</CardTitle>
            <p className="text-xs text-slate-500">{actions.length} action{actions.length !== 1 ? "s" : ""} need your attention</p>
          </div>
        </div>
        <Badge className={`${actions.length > 0 ? "bg-red-500" : "bg-slate-300"} text-white border-0 text-xs`}>
          {actions.length}
        </Badge>
      </CardHeader>
      <CardContent className="p-0 pb-2">
        {actions.length === 0 ? (
          <div className="text-center py-8 text-slate-400 px-4">
            <Zap className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium text-slate-500">All caught up! 🎉</p>
            <p className="text-xs mt-1">No urgent actions for today</p>
          </div>
        ) : (
          <div className="space-y-1.5 px-4">
            {actions.map((item, i) => (
              <ActionItem key={`${item.lead.id}-${i}`} {...item} />
            ))}
          </div>
        )}
        <div className="px-4 pt-3">
          <Link to={createPageUrl("Leads") + "?filter=today"}>
            <Button variant="outline" size="sm" className="w-full text-xs gap-1.5">
              <ArrowRight className="w-3.5 h-3.5" /> View All Leads
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}