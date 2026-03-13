import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Clock, Flame, Zap, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow, isPast, isToday, parseISO } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const TASK_TYPE_ICONS = {
  call: "📞",
  email: "✉️",
  follow_up: "🔄",
  send_document: "📄",
  schedule_meeting: "📅",
  internal: "📝",
};

const PRIORITY_COLORS = {
  urgent: "text-red-600 bg-red-50 border-red-200",
  high: "text-orange-600 bg-orange-50 border-orange-200",
  medium: "text-amber-600 bg-amber-50 border-amber-200",
  low: "text-slate-500 bg-slate-50 border-slate-200",
};

function TaskItem({ task, lead, onComplete }) {
  const isOverdue = task.due_date && isPast(parseISO(task.due_date)) && !task.completed;
  const isDueToday = task.due_date && isToday(parseISO(task.due_date));

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
        task.completed
          ? "bg-slate-50 border-slate-100 opacity-50"
          : isOverdue
          ? "bg-red-50 border-red-200"
          : isDueToday
          ? "bg-amber-50 border-amber-200"
          : "bg-white border-slate-200 hover:border-slate-300"
      }`}
    >
      <button
        onClick={() => onComplete(task)}
        className="mt-0.5 flex-shrink-0 hover:scale-110 transition-transform"
      >
        {task.completed ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        ) : (
          <Circle className="w-5 h-5 text-slate-300 hover:text-emerald-400" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-base">{TASK_TYPE_ICONS[task.type] || "📝"}</span>
          <span className={`text-sm font-medium ${task.completed ? "line-through text-slate-400" : "text-slate-800"}`}>
            {task.title}
          </span>
        </div>
        {lead && (
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            {lead.first_name} {lead.last_name} · {lead.company_name}
          </p>
        )}
        {task.due_date && (
          <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${isOverdue ? "text-red-600" : isDueToday ? "text-amber-600" : "text-slate-400"}`}>
            <Clock className="w-3 h-3" />
            {isOverdue ? "Overdue · " : ""}
            {formatDistanceToNow(parseISO(task.due_date), { addSuffix: true })}
          </div>
        )}
      </div>

      {task.priority === "urgent" || task.priority === "high" ? (
        <Flame className={`w-4 h-4 flex-shrink-0 mt-0.5 ${task.priority === "urgent" ? "text-red-500" : "text-orange-400"}`} />
      ) : null}
    </motion.div>
  );
}

export default function MITWidget() {
  const queryClient = useQueryClient();
  const [showAll, setShowAll] = useState(false);

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => base44.entities.Task.filter({ completed: false }),
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["leads"],
    queryFn: () => base44.entities.Lead.list("-created_date"),
  });

  const completeMutation = useMutation({
    mutationFn: (task) =>
      base44.entities.Task.update(task.id, {
        completed: true,
        completed_at: new Date().toISOString(),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const leadsMap = Object.fromEntries(leads.map((l) => [l.id, l]));

  // Sort: overdue first, then by priority, then by due date
  const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 };
  const sortedTasks = [...tasks].sort((a, b) => {
    const aOverdue = a.due_date && isPast(parseISO(a.due_date));
    const bOverdue = b.due_date && isPast(parseISO(b.due_date));
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    const pa = PRIORITY_ORDER[a.priority] ?? 2;
    const pb = PRIORITY_ORDER[b.priority] ?? 2;
    if (pa !== pb) return pa - pb;
    if (a.due_date && b.due_date) return new Date(a.due_date) - new Date(b.due_date);
    return 0;
  });

  const mits = sortedTasks.slice(0, 3);
  const displayTasks = showAll ? sortedTasks : mits;

  const todayTotal = tasks.filter((t) => t.due_date && isToday(parseISO(t.due_date))).length;
  const overdueCount = tasks.filter((t) => t.due_date && isPast(parseISO(t.due_date))).length;

  return (
    <Card className="bg-white border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900">Today's 3 MITs</CardTitle>
              <p className="text-xs text-slate-400">Most Important Tasks</p>
            </div>
          </div>
          {overdueCount > 0 && (
            <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">
              {overdueCount} overdue
            </Badge>
          )}
        </div>

        {/* Progress Bar */}
        {tasks.length > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Today's Progress</span>
              <span>{todayTotal} task{todayTotal !== 1 ? "s" : ""} due today</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${tasks.length === 0 ? 0 : Math.min(100, (mits.filter(t => t.completed).length / mits.length) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-2 pt-0">
        {displayTasks.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-400" />
            <p className="font-medium text-emerald-600">All clear!</p>
            <p className="text-xs mt-1">No pending tasks</p>
          </div>
        ) : (
          <AnimatePresence>
            {displayTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                lead={leadsMap[task.lead_id]}
                onComplete={completeMutation.mutate}
              />
            ))}
          </AnimatePresence>
        )}

        {sortedTasks.length > 3 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full text-xs text-slate-400 hover:text-slate-600 py-1 transition-colors flex items-center justify-center gap-1"
          >
            {showAll ? "Show top 3 only" : `+${sortedTasks.length - 3} more tasks`}
            <ChevronRight className={`w-3 h-3 transition-transform ${showAll ? "rotate-90" : ""}`} />
          </button>
        )}

        <Link
          to="/Tasks"
          className="block w-full text-center text-xs text-teal-600 hover:text-teal-700 font-medium py-1 mt-1"
        >
          Manage all tasks →
        </Link>
      </CardContent>
    </Card>
  );
}