import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Clock, Plus, Trash2 } from "lucide-react";
import { formatDistanceToNow, isPast, isToday, parseISO, format } from "date-fns";
import AddTaskForm from "../components/tasks/AddTaskForm";

const TASK_TYPE_ICONS = {
  call: "📞",
  email: "✉️",
  follow_up: "🔄",
  send_document: "📄",
  schedule_meeting: "📅",
  internal: "📝",
};

const PRIORITY_COLORS = {
  urgent: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function Tasks() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("pending");
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks_all"],
    queryFn: () => base44.entities.Task.list("-created_date"),
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["leads"],
    queryFn: () => base44.entities.Lead.list("-created_date"),
  });

  const leadsMap = Object.fromEntries(leads.map((l) => [l.id, l]));

  const completeMutation = useMutation({
    mutationFn: (task) =>
      base44.entities.Task.update(task.id, {
        completed: !task.completed,
        completed_at: !task.completed ? new Date().toISOString() : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks_all"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Task.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks_all"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const filteredTasks = tasks.filter((t) => {
    if (filter === "pending") return !t.completed;
    if (filter === "today") return !t.completed && t.due_date && isToday(parseISO(t.due_date));
    if (filter === "overdue") return !t.completed && t.due_date && isPast(parseISO(t.due_date));
    if (filter === "completed") return t.completed;
    return true;
  });

  const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 };
  const sorted = [...filteredTasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const aOverdue = a.due_date && isPast(parseISO(a.due_date));
    const bOverdue = b.due_date && isPast(parseISO(b.due_date));
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    return (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2);
  });

  const counts = {
    pending: tasks.filter((t) => !t.completed).length,
    today: tasks.filter((t) => !t.completed && t.due_date && isToday(parseISO(t.due_date))).length,
    overdue: tasks.filter((t) => !t.completed && t.due_date && isPast(parseISO(t.due_date))).length,
    completed: tasks.filter((t) => t.completed).length,
    all: tasks.length,
  };

  const FILTERS = [
    { key: "pending", label: "Pending" },
    { key: "today", label: "Today" },
    { key: "overdue", label: "Overdue" },
    { key: "completed", label: "Completed" },
    { key: "all", label: "All" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Tasks</h1>
            <p className="text-slate-500 mt-1">Your action queue — auto-generated from pipeline stages</p>
          </div>
          <Button
            onClick={() => setShowAddForm(true)}
            className="bg-slate-900 hover:bg-slate-800 text-white gap-2"
          >
            <Plus className="w-4 h-4" /> Add Task
          </Button>
        </div>

        {/* Add Task Form */}
        {showAddForm && <AddTaskForm onClose={() => setShowAddForm(false)} />}

        {/* Filter Tabs */}
        <div className="flex gap-2 flex-wrap mb-6">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                filter === f.key
                  ? "bg-slate-900 text-white shadow"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {f.label}
              {counts[f.key] > 0 && (
                <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                  filter === f.key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                }`}>
                  {counts[f.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Task List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-white rounded-xl animate-pulse border border-slate-100" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-400" />
            <p className="font-medium text-emerald-600 text-lg">All clear!</p>
            <p className="text-sm mt-1">No tasks in this view</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {sorted.map((task) => {
                const lead = leadsMap[task.lead_id];
                const isOverdue = task.due_date && isPast(parseISO(task.due_date)) && !task.completed;
                const dueToday = task.due_date && isToday(parseISO(task.due_date));

                return (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                  >
                    <Card
                      className={`border transition-all ${
                        task.completed
                          ? "bg-slate-50 border-slate-100 opacity-60"
                          : isOverdue
                          ? "bg-red-50 border-red-200"
                          : dueToday
                          ? "bg-amber-50 border-amber-200"
                          : "bg-white border-slate-200"
                      }`}
                    >
                      <CardContent className="p-4 flex items-start gap-4">
                        <button
                          onClick={() => completeMutation.mutate(task)}
                          className="mt-0.5 flex-shrink-0 hover:scale-110 transition-transform"
                        >
                          {task.completed ? (
                            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                          ) : (
                            <Circle className="w-6 h-6 text-slate-300 hover:text-emerald-400" />
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-lg">{TASK_TYPE_ICONS[task.type] || "📝"}</span>
                            <span className={`font-medium text-slate-900 ${task.completed ? "line-through text-slate-400" : ""}`}>
                              {task.title}
                            </span>
                            {task.priority && (
                              <Badge className={`text-xs border ${PRIORITY_COLORS[task.priority]}`}>
                                {task.priority}
                              </Badge>
                            )}
                            {task.auto_generated && (
                              <Badge className="text-xs bg-teal-50 text-teal-700 border-teal-200 border">auto</Badge>
                            )}
                          </div>

                          {lead && (
                            <p className="text-sm text-slate-500 mt-0.5">
                              {lead.first_name} {lead.last_name} · {lead.company_name}
                            </p>
                          )}

                          <div className="flex items-center gap-4 mt-2 flex-wrap">
                            {task.due_date && (
                              <div className={`flex items-center gap-1 text-xs font-medium ${
                                isOverdue ? "text-red-600" : dueToday ? "text-amber-600" : "text-slate-400"
                              }`}>
                                <Clock className="w-3 h-3" />
                                {isOverdue ? "⚠️ Overdue · " : ""}
                                {format(parseISO(task.due_date), "MMM d, h:mm a")}
                              </div>
                            )}
                            {task.completed && task.completed_at && (
                              <span className="text-xs text-emerald-600">
                                ✓ Completed {formatDistanceToNow(parseISO(task.completed_at), { addSuffix: true })}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => deleteMutation.mutate(task.id)}
                          className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}