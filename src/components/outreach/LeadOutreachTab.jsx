import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Mail, Eye, MousePointer, Send, Plus, RefreshCw, Zap, Linkedin,
  Play, Pause, CheckCircle2, Clock, AlertCircle, XCircle, ChevronRight,
  MessageSquareReply, CalendarDays
} from "lucide-react";
import { format, addDays, isPast, isFuture } from "date-fns";
import ComposeEmailDialog from "./ComposeEmailDialog";
import AddToSequenceDialog from "./AddToSequenceDialog";

const emailStatusConfig = {
  draft:   { label: "Draft",   cls: "bg-slate-100 text-slate-600" },
  sent:    { label: "Sent",    cls: "bg-blue-100 text-blue-700" },
  opened:  { label: "Opened",  cls: "bg-amber-100 text-amber-700" },
  clicked: { label: "Clicked", cls: "bg-emerald-100 text-emerald-700" },
  replied: { label: "Replied", cls: "bg-teal-100 text-teal-700" },
  bounced: { label: "Bounced", cls: "bg-rose-100 text-rose-700" },
};

function SequenceStatusBadge({ lead }) {
  if (!lead.sequence_id) return null;
  const isActive = !!lead.sequence_next_send && isFuture(new Date(lead.sequence_next_send));
  const isPaused = lead.temperature === "hot" || lead.status === "replied";

  if (isPaused) return (
    <Badge className="bg-amber-100 text-amber-700 border-0 gap-1">
      <Pause className="w-3 h-3" /> Paused (replied)
    </Badge>
  );
  if (isActive) return (
    <Badge className="bg-violet-100 text-violet-700 border-0 gap-1">
      <Play className="w-3 h-3" /> Active · Step {lead.sequence_step || 1}
    </Badge>
  );
  return (
    <Badge className="bg-slate-100 text-slate-600 border-0 gap-1">
      <CheckCircle2 className="w-3 h-3" /> Completed
    </Badge>
  );
}

function SequencePanel({ lead, campaigns, onUpdateLead }) {
  const queryClient = useQueryClient();
  const [showEnroll, setShowEnroll] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [resuming, setResuming] = useState(false);

  const enrolledCampaign = campaigns.find(c => c.id === lead.sequence_id);
  const steps = enrolledCampaign?.steps || [];

  const isEnrolled = !!lead.sequence_id;
  const isPaused = isEnrolled && (lead.temperature === "hot");
  const sequenceNextSend = lead.sequence_next_send ? new Date(lead.sequence_next_send) : null;

  const handlePause = async () => {
    setPausing(true);
    await base44.entities.Lead.update(lead.id, { sequence_next_send: null });
    onUpdateLead && onUpdateLead({ ...lead, sequence_next_send: null });
    queryClient.invalidateQueries({ queryKey: ['leads'] });
    setPausing(false);
  };

  const handleResume = async () => {
    setResuming(true);
    const nextSend = addDays(new Date(), 1).toISOString();
    await base44.entities.Lead.update(lead.id, { sequence_next_send: nextSend });
    onUpdateLead && onUpdateLead({ ...lead, sequence_next_send: nextSend });
    queryClient.invalidateQueries({ queryKey: ['leads'] });
    setResuming(false);
  };

  const handleUnenroll = async () => {
    await base44.entities.Lead.update(lead.id, {
      sequence_id: null, sequence_step: null, sequence_next_send: null
    });
    onUpdateLead && onUpdateLead({ ...lead, sequence_id: null, sequence_step: null, sequence_next_send: null });
    queryClient.invalidateQueries({ queryKey: ['leads'] });
  };

  if (!isEnrolled) {
    return (
      <div className="text-center py-10 space-y-3">
        <div className="w-12 h-12 bg-violet-50 rounded-full flex items-center justify-center mx-auto">
          <Zap className="w-5 h-5 text-violet-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-700">Not in any sequence</p>
          <p className="text-xs text-slate-400 mt-1">Enroll {lead.first_name} in a multi-step outreach sequence</p>
        </div>
        <Button onClick={() => setShowEnroll(true)} className="bg-violet-600 hover:bg-violet-700 gap-2">
          <Zap className="w-4 h-4" /> Enroll in Sequence
        </Button>
        <AddToSequenceDialog open={showEnroll} onClose={() => setShowEnroll(false)} lead={lead} />
      </div>
    );
  }

  const currentStepIdx = (lead.sequence_step || 1) - 1;

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-slate-800">{enrolledCampaign?.name || "Sequence"}</p>
          <div className="flex items-center gap-2 mt-1">
            <SequenceStatusBadge lead={lead} />
            {sequenceNextSend && isFuture(sequenceNextSend) && (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <CalendarDays className="w-3 h-3" />
                Next: {format(sequenceNextSend, 'MMM d')}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {sequenceNextSend && isFuture(sequenceNextSend) ? (
            <Button size="sm" variant="outline" onClick={handlePause} disabled={pausing} className="text-amber-600 border-amber-200 hover:bg-amber-50 gap-1 h-7 text-xs">
              {pausing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Pause className="w-3 h-3" />}
              Pause
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={handleResume} disabled={resuming} className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 gap-1 h-7 text-xs">
              {resuming ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              Resume
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handleUnenroll} className="text-rose-500 border-rose-200 hover:bg-rose-50 gap-1 h-7 text-xs">
            <XCircle className="w-3 h-3" /> Remove
          </Button>
        </div>
      </div>

      {/* Reply auto-pause notice */}
      {lead.temperature === "hot" && (
        <div className="flex items-start gap-2 text-xs bg-teal-50 border border-teal-200 rounded-lg p-3">
          <MessageSquareReply className="w-3.5 h-3.5 text-teal-600 mt-0.5 shrink-0" />
          <span className="text-teal-700">Sequence auto-paused because lead replied. Resume manually if needed.</span>
        </div>
      )}

      {/* Steps timeline */}
      {steps.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Sequence Steps</p>
          {steps.map((step, i) => {
            const isDone = i < currentStepIdx;
            const isCurrent = i === currentStepIdx;
            const isFutureStep = i > currentStepIdx;
            return (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${
                isCurrent ? "border-violet-200 bg-violet-50" :
                isDone ? "border-slate-100 bg-slate-50" :
                "border-slate-100 bg-white"
              }`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  isDone ? "bg-emerald-100 text-emerald-600" :
                  isCurrent ? "bg-violet-200 text-violet-700" :
                  "bg-slate-100 text-slate-400"
                }`}>
                  {isDone ? <CheckCircle2 className="w-4 h-4" /> : step.step_number || i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${isCurrent ? "text-violet-800" : isDone ? "text-slate-500 line-through" : "text-slate-700"}`}>
                    {step.label || `Step ${i + 1}`}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-400 flex items-center gap-0.5">
                      {step.channel === "linkedin" ? <Linkedin className="w-2.5 h-2.5" /> : <Mail className="w-2.5 h-2.5" />}
                      {step.channel}
                    </span>
                    <span className="text-xs text-slate-400">Day {step.delay_days}</span>
                  </div>
                </div>
                {isCurrent && (
                  <Badge className="bg-violet-100 text-violet-700 border-0 text-xs shrink-0">Current</Badge>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AddToSequenceDialog open={showEnroll} onClose={() => setShowEnroll(false)} lead={lead} />
    </div>
  );
}

function EmailHistoryPanel({ lead, onRefetch }) {
  const [showCompose, setShowCompose] = useState(false);
  const queryClient = useQueryClient();

  const { data: emails = [], isLoading, refetch } = useQuery({
    queryKey: ['outreach-lead', lead?.id],
    queryFn: () => base44.entities.EmailOutreach.filter({ lead_id: lead.id }, '-sent_at', 100),
    enabled: !!lead?.id
  });

  const handleReplyMark = async (email) => {
    // Mark as replied + auto-pause sequence
    await base44.entities.EmailOutreach.update(email.id, { status: "replied" });
    if (lead.sequence_id && lead.sequence_next_send) {
      await base44.entities.Lead.update(lead.id, {
        sequence_next_send: null,
        temperature: "hot",
      });
    }
    queryClient.invalidateQueries({ queryKey: ['outreach-lead', lead.id] });
    queryClient.invalidateQueries({ queryKey: ['leads'] });
  };

  const handleSent = () => {
    queryClient.invalidateQueries({ queryKey: ['outreach-lead', lead?.id] });
    queryClient.invalidateQueries({ queryKey: ['email-outreach'] });
  };

  if (isLoading) return (
    <div className="py-8 text-center">
      <RefreshCw className="w-5 h-5 mx-auto text-slate-400 animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-700">Email History</p>
          <p className="text-xs text-slate-400">{emails.length} email{emails.length !== 1 ? 's' : ''} tracked</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => refetch()} className="h-8 w-8 p-0">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" onClick={() => setShowCompose(true)} className="bg-teal-600 hover:bg-teal-700 h-8 gap-1.5">
            <Plus className="w-3.5 h-3.5" /> New Email
          </Button>
        </div>
      </div>

      {!lead.email && (
        <div className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          ⚠ No email address on this lead. Add an email to enable outreach.
        </div>
      )}

      {emails.length === 0 ? (
        <div className="py-8 text-center text-slate-400">
          <Mail className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No emails sent yet</p>
          <p className="text-xs mt-1">Click "New Email" to compose a tracked email</p>
        </div>
      ) : (
        <div className="space-y-2">
          {emails.map(email => {
            const cfg = emailStatusConfig[email.status] || emailStatusConfig.sent;
            return (
              <div key={email.id} className="border border-slate-200 rounded-xl p-3 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{email.subject}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge className={`${cfg.cls} border-0 text-xs`}>{cfg.label}</Badge>
                      {email.campaign_name && (
                        <span className="text-xs text-slate-400 truncate">{email.campaign_name}</span>
                      )}
                      {email.sequence_step > 0 && (
                        <span className="text-xs bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded-full">
                          Step {email.sequence_step}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-slate-400">
                      {email.sent_at ? format(new Date(email.sent_at), 'MMM d, HH:mm') : '—'}
                    </p>
                    {email.status !== "replied" && email.status !== "bounced" && (
                      <button
                        onClick={() => handleReplyMark(email)}
                        className="text-xs text-teal-600 hover:text-teal-800 mt-1 flex items-center gap-0.5 ml-auto"
                        title="Mark as replied (pauses sequence)"
                      >
                        <MessageSquareReply className="w-3 h-3" /> replied
                      </button>
                    )}
                  </div>
                </div>

                {/* Tracking metrics */}
                <div className="flex items-center gap-4 mt-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 text-xs">
                    <Eye className={`w-3.5 h-3.5 ${email.open_count > 0 ? 'text-amber-500' : 'text-slate-300'}`} />
                    <span className={email.open_count > 0 ? 'text-amber-700 font-medium' : 'text-slate-400'}>
                      {email.open_count || 0} open{email.open_count !== 1 ? 's' : ''}
                    </span>
                    {email.opened_at && (
                      <span className="text-slate-400">· {format(new Date(email.opened_at), 'MMM d')}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <MousePointer className={`w-3.5 h-3.5 ${email.click_count > 0 ? 'text-emerald-500' : 'text-slate-300'}`} />
                    <span className={email.click_count > 0 ? 'text-emerald-700 font-medium' : 'text-slate-400'}>
                      {email.click_count || 0} click{email.click_count !== 1 ? 's' : ''}
                    </span>
                    {email.clicked_at && (
                      <span className="text-slate-400">· {format(new Date(email.clicked_at), 'MMM d')}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ComposeEmailDialog
        open={showCompose}
        onClose={() => setShowCompose(false)}
        lead={lead}
        onSent={handleSent}
      />
    </div>
  );
}

function SchedulePanel({ lead, onUpdateLead }) {
  const queryClient = useQueryClient();
  const [newStepDate, setNewStepDate] = useState("");
  const [newStepNote, setNewStepNote] = useState("");
  const [newStepChannel, setNewStepChannel] = useState("email");
  const [saving, setSaving] = useState(false);

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks-lead', lead?.id],
    queryFn: () => base44.entities.Task.filter({ lead_id: lead.id }, '-due_date', 50),
    enabled: !!lead?.id
  });

  const sequenceTasks = tasks.filter(t => t.auto_generated);
  const upcomingTasks = sequenceTasks.filter(t => !t.completed).sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
  const completedTasks = sequenceTasks.filter(t => t.completed);

  const handleScheduleStep = async () => {
    if (!newStepDate) return;
    setSaving(true);
    await base44.entities.Task.create({
      lead_id: lead.id,
      title: `[Sequence] ${newStepChannel === "linkedin" ? "LinkedIn message" : "Email"} follow-up${newStepNote ? `: ${newStepNote}` : ""}`,
      type: newStepChannel === "linkedin" ? "follow_up" : "email",
      due_date: new Date(newStepDate).toISOString(),
      priority: "medium",
      auto_generated: true,
      completed: false,
      notes: newStepNote,
    });
    if (lead.sequence_id) {
      await base44.entities.Lead.update(lead.id, {
        sequence_next_send: new Date(newStepDate).toISOString(),
        sequence_step: (lead.sequence_step || 1) + 1,
      });
      onUpdateLead && onUpdateLead({ ...lead, sequence_next_send: new Date(newStepDate).toISOString() });
    }
    queryClient.invalidateQueries({ queryKey: ['tasks-lead', lead.id] });
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['leads'] });
    setNewStepDate("");
    setNewStepNote("");
    setSaving(false);
  };

  const toggleComplete = async (task) => {
    await base44.entities.Task.update(task.id, {
      completed: !task.completed,
      completed_at: !task.completed ? new Date().toISOString() : null,
    });
    queryClient.invalidateQueries({ queryKey: ['tasks-lead', lead.id] });
  };

  return (
    <div className="space-y-4">
      {/* Schedule new step */}
      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Schedule Follow-up Step</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Channel</label>
            <select
              value={newStepChannel}
              onChange={e => setNewStepChannel(e.target.value)}
              className="w-full h-9 px-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-slate-300"
            >
              <option value="email">Email</option>
              <option value="linkedin">LinkedIn</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Scheduled Date</label>
            <input
              type="datetime-local"
              value={newStepDate}
              onChange={e => setNewStepDate(e.target.value)}
              className="w-full h-9 px-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-slate-300"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Note (optional)</label>
          <input
            type="text"
            value={newStepNote}
            onChange={e => setNewStepNote(e.target.value)}
            placeholder="e.g. Send case study PDF"
            className="w-full h-9 px-3 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-slate-300"
          />
        </div>
        <Button
          size="sm"
          onClick={handleScheduleStep}
          disabled={!newStepDate || saving}
          className="w-full bg-slate-800 hover:bg-slate-900 gap-2"
        >
          {saving ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving...</> : <><CalendarDays className="w-3.5 h-3.5" /> Schedule Step</>}
        </Button>
      </div>

      {/* Upcoming */}
      {upcomingTasks.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Upcoming ({upcomingTasks.length})</p>
          {upcomingTasks.map(task => {
            const isOverdue = task.due_date && isPast(new Date(task.due_date));
            return (
              <div key={task.id} className={`flex items-start gap-3 p-3 rounded-lg border ${isOverdue ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-white"}`}>
                <button onClick={() => toggleComplete(task)} className="mt-0.5 shrink-0">
                  <div className={`w-4 h-4 rounded border-2 ${isOverdue ? "border-rose-400" : "border-slate-300"} hover:border-emerald-500`} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800 truncate">{task.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs flex items-center gap-0.5 ${isOverdue ? "text-rose-600 font-medium" : "text-slate-400"}`}>
                      {isOverdue ? <AlertCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {task.due_date ? format(new Date(task.due_date), 'MMM d, HH:mm') : '—'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Completed */}
      {completedTasks.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Completed ({completedTasks.length})</p>
          {completedTasks.map(task => (
            <div key={task.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <p className="text-sm text-slate-400 line-through truncate flex-1">{task.title}</p>
              {task.completed_at && (
                <span className="text-xs text-slate-300 shrink-0">{format(new Date(task.completed_at), 'MMM d')}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {upcomingTasks.length === 0 && completedTasks.length === 0 && (
        <div className="py-6 text-center text-slate-400">
          <CalendarDays className="w-7 h-7 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No scheduled steps yet</p>
        </div>
      )}
    </div>
  );
}

export default function LeadOutreachTab({ lead, onUpdateLead }) {
  const { data: campaigns = [] } = useQuery({
    queryKey: ["outreach-campaigns"],
    queryFn: () => base44.entities.OutreachCampaign.list(),
  });

  if (!lead) return null;

  return (
    <div className="space-y-1">
      {/* Sequence status summary */}
      {lead.sequence_id && (
        <div className="flex items-center justify-between px-1 pb-2">
          <SequenceStatusBadge lead={lead} />
          {lead.sequence_next_send && isFuture(new Date(lead.sequence_next_send)) && (
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              Next step: {format(new Date(lead.sequence_next_send), 'MMM d')}
            </span>
          )}
        </div>
      )}

      <Tabs defaultValue="sequence">
        <TabsList className="w-full rounded-lg bg-slate-100 p-1 h-auto gap-0.5">
          <TabsTrigger value="sequence" className="flex-1 text-xs rounded-md py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Zap className="w-3 h-3 mr-1" /> Sequence
          </TabsTrigger>
          <TabsTrigger value="emails" className="flex-1 text-xs rounded-md py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Mail className="w-3 h-3 mr-1" /> Emails
          </TabsTrigger>
          <TabsTrigger value="schedule" className="flex-1 text-xs rounded-md py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <CalendarDays className="w-3 h-3 mr-1" /> Schedule
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sequence" className="mt-3">
          <SequencePanel lead={lead} campaigns={campaigns} onUpdateLead={onUpdateLead} />
        </TabsContent>

        <TabsContent value="emails" className="mt-3">
          <EmailHistoryPanel lead={lead} />
        </TabsContent>

        <TabsContent value="schedule" className="mt-3">
          <SchedulePanel lead={lead} onUpdateLead={onUpdateLead} />
        </TabsContent>
      </Tabs>
    </div>
  );
}