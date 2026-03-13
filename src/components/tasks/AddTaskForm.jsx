import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";

export default function AddTaskForm({ onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: "",
    type: "call",
    priority: "medium",
    lead_id: "",
    due_date: "",
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["leads"],
    queryFn: () => base44.entities.Lead.list("-created_date"),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Task.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks_all"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      onClose();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    const payload = { ...form, completed: false };
    if (!payload.lead_id) delete payload.lead_id;
    if (!payload.due_date) delete payload.due_date;
    else payload.due_date = new Date(payload.due_date).toISOString();
    createMutation.mutate(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-4 mb-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="font-semibold text-slate-800">New Task</p>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      <Input
        placeholder="Task title..."
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        required
        autoFocus
      />

      <div className="grid grid-cols-2 gap-3">
        <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
          <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="call">📞 Call</SelectItem>
            <SelectItem value="email">✉️ Email</SelectItem>
            <SelectItem value="follow_up">🔄 Follow-up</SelectItem>
            <SelectItem value="send_document">📄 Send Document</SelectItem>
            <SelectItem value="schedule_meeting">📅 Schedule Meeting</SelectItem>
            <SelectItem value="internal">📝 Internal</SelectItem>
          </SelectContent>
        </Select>

        <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
          <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="urgent">🔴 Urgent</SelectItem>
            <SelectItem value="high">🟠 High</SelectItem>
            <SelectItem value="medium">🟡 Medium</SelectItem>
            <SelectItem value="low">⚪ Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Select value={form.lead_id} onValueChange={(v) => setForm({ ...form, lead_id: v })}>
          <SelectTrigger><SelectValue placeholder="Link to lead (optional)" /></SelectTrigger>
          <SelectContent>
            {leads.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.first_name} {l.last_name} · {l.company_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="datetime-local"
          value={form.due_date}
          onChange={(e) => setForm({ ...form, due_date: e.target.value })}
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button type="submit" size="sm" disabled={createMutation.isPending} className="bg-slate-900 hover:bg-slate-800 text-white">
          {createMutation.isPending ? "Saving..." : "Add Task"}
        </Button>
      </div>
    </form>
  );
}